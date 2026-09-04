import { APP_STATE_VERSION, MAX_UNDO_STEPS, STORAGE_KEYS } from "./config.js";
import { getCommandDefinition } from "./commands.js";
import {
  createDefaultAppState,
  DataValidationError,
  normalizeAppState
} from "./normalization.js";
import { persistState, readStoredState } from "./persistence.js";
import { clone } from "./utils.js";

const RENDER_ALL = Object.freeze({
  pages: true,
  planSelect: true,
  groupSelect: true,
  editor: true
});

export class StateConflictError extends Error {
  constructor(message = "Eine neuere Version wurde in einem anderen Tab gespeichert.") {
    super(message);
    this.name = "StateConflictError";
    this.code = "STATE_CONFLICT";
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function domainContent(state) {
  return JSON.stringify({
    plans: state.plans,
    activePlanId: state.activePlanId,
    minRows: state.minRows
  });
}

function isNewer(candidate, current) {
  if (candidate.revision !== current.revision) {
    return candidate.revision > current.revision;
  }
  return Date.parse(candidate.updatedAt) > Date.parse(current.updatedAt);
}

let appState = deepFreeze(createDefaultAppState());
let persistenceStorage;
let undoStack = [];
let undoSequence = 0;
const activeUndoGroups = new Map();
const pendingLocalEdits = new Set();
const subscribers = new Set();
let externalConflict = null;

function emit(event) {
  const safeEvent = { ...event, state: getStateSnapshot() };
  [...subscribers].forEach((listener) => {
    try {
      listener(safeEvent);
    } catch (error) {
      globalThis.console?.error?.("State-Subscriber fehlgeschlagen", error);
    }
  });
}

function installState(nextState) {
  appState = deepFreeze(nextState);
}

function finalizeGroup(groupKey) {
  if (!groupKey) {
    return;
  }
  const entry = activeUndoGroups.get(groupKey);
  if (entry) {
    entry.groupKey = null;
    activeUndoGroups.delete(groupKey);
  }
}

function finalizeAllGroups() {
  [...activeUndoGroups.keys()].forEach(finalizeGroup);
}

function pushUndo(label, snapshot, groupKey) {
  if (groupKey && activeUndoGroups.has(groupKey)) {
    return activeUndoGroups.get(groupKey);
  }

  const entry = {
    id: ++undoSequence,
    label,
    snapshot: clone(snapshot),
    groupKey: groupKey || null
  };
  undoStack.push(entry);

  if (undoStack.length > MAX_UNDO_STEPS) {
    const removed = undoStack.shift();
    if (removed?.groupKey) {
      activeUndoGroups.delete(removed.groupKey);
    }
  }
  if (groupKey) {
    activeUndoGroups.set(groupKey, entry);
  }
  return entry;
}

function registerConflict(state) {
  if (!externalConflict || isNewer(state, externalConflict)) {
    externalConflict = deepFreeze(clone(state));
  }
  emit({ type: "conflict", externalState: clone(externalConflict) });
}

function checkForNewerStoredState(storage = persistenceStorage) {
  const stored = readStoredState(storage);
  if (!stored.ok) {
    return { ok: false, error: stored.error };
  }
  if (stored.state && isNewer(stored.state, appState)) {
    registerConflict(stored.state);
    return { ok: false, error: new StateConflictError() };
  }
  return { ok: true, error: null };
}

function persistCandidate(candidate, {
  allowOverwrite = false,
  storage = persistenceStorage
} = {}) {
  if (!allowOverwrite) {
    const freshness = checkForNewerStoredState(storage);
    if (!freshness.ok) {
      return freshness;
    }
  }
  return persistState(candidate, storage);
}

function nextStateFromDraft(draft, baseRevision = appState.revision) {
  return normalizeAppState({
    ...draft,
    version: APP_STATE_VERSION,
    revision: baseRevision + 1,
    updatedAt: new Date().toISOString()
  });
}

export function initialiseState(initialState, { storage } = {}) {
  appState = deepFreeze(normalizeAppState(initialState));
  persistenceStorage = storage;
  undoStack = [];
  undoSequence = 0;
  activeUndoGroups.clear();
  pendingLocalEdits.clear();
  externalConflict = null;
}

export function subscribe(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("subscribe erwartet eine Listener-Funktion.");
  }
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getState() {
  return clone(appState);
}

export function getStateSnapshot() {
  return clone(appState);
}

// Kompatibilitätsselektoren: bewusst Snapshots statt interner Referenzen.
export function getPlans() {
  return clone(appState.plans);
}

export function getActivePlanId() {
  return appState.activePlanId;
}

export function getActivePlan() {
  const plan = appState.plans.find((item) => item.id === appState.activePlanId)
    || appState.plans[0];
  return clone(plan);
}

export function getMinRows() {
  return appState.minRows;
}

export function getUndoDepth() {
  return undoStack.length;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function hasPendingLocalChanges() {
  return pendingLocalEdits.size > 0 || activeUndoGroups.size > 0;
}

export function markLocalEditPending(key, pending = true) {
  if (!key) {
    return;
  }
  if (pending) {
    pendingLocalEdits.add(key);
  } else {
    pendingLocalEdits.delete(key);
  }
}

export function finalizeUndoGroup(groupKey) {
  finalizeGroup(groupKey);
}

export function runUndoable(label, mutation, {
  undoable = true,
  undoGroup = null,
  finalize = true,
  silent = false,
  preserveGroups = false,
  storage = persistenceStorage
} = {}) {
  const before = getStateSnapshot();

  try {
    if (typeof mutation !== "function") {
      throw new TypeError("runUndoable erwartet eine Mutation.");
    }

    const draft = clone(before);
    const descriptor = mutation(draft) || {};
    const candidate = nextStateFromDraft(draft);
    const changed = descriptor.changed !== false
      && domainContent(candidate) !== domainContent(before);
    const hadActiveGroup = Boolean(undoGroup && activeUndoGroups.has(undoGroup));

    if (!changed) {
      if (finalize) {
        finalizeGroup(undoGroup);
      }
      if (descriptor.notifyOnNoop || (hadActiveGroup && finalize)) {
        emit({
          type: "notice",
          commandType: descriptor.commandType,
          notification: silent ? null : descriptor.notification || null
        });
      }
      return { ok: true, changed: false, error: null, value: descriptor.value };
    }

    const persisted = persistCandidate(candidate, { storage });
    if (!persisted.ok) {
      if (persisted.error?.code !== "STATE_CONFLICT") {
        emit({ type: "error", error: persisted.error });
      }
      return { ok: false, changed: false, error: persisted.error };
    }

    if (!undoGroup && !preserveGroups) {
      finalizeAllGroups();
    }
    if (undoable) {
      pushUndo(label, before, undoGroup);
    }
    installState(candidate);
    if (finalize) {
      finalizeGroup(undoGroup);
    }

    emit({
      type: "change",
      commandType: descriptor.commandType,
      label,
      render: descriptor.render || {},
      notification: silent ? null : descriptor.notification || null,
      value: descriptor.value
    });
    return { ok: true, changed: true, error: null, value: descriptor.value };
  } catch (error) {
    emit({ type: "error", error });
    return { ok: false, changed: false, error };
  }
}

export function dispatch(command, options = {}) {
  const definition = command && getCommandDefinition(command.type);
  if (!definition) {
    const error = new DataValidationError("Unbekannter Command.");
    emit({ type: "error", error });
    return { ok: false, changed: false, error };
  }

  return runUndoable(definition.label, (draft) => {
    const descriptor = definition.mutate(draft, command.payload) || {};
    return { ...descriptor, commandType: command.type };
  }, options);
}

export function cancelUndoGroup(groupKey, restoreCommand) {
  const entry = activeUndoGroups.get(groupKey);
  if (!entry) {
    pendingLocalEdits.delete(groupKey);
    return { ok: true, changed: false, error: null };
  }

  const result = dispatch(restoreCommand, {
    undoable: false,
    undoGroup: groupKey,
    finalize: false,
    silent: true,
    preserveGroups: true
  });
  if (!result.ok) {
    return result;
  }

  undoStack = undoStack.filter((item) => item.id !== entry.id);
  activeUndoGroups.delete(groupKey);
  pendingLocalEdits.delete(groupKey);
  emit({ type: "undo-stack" });
  return result;
}

export function undo() {
  const entry = undoStack.at(-1);
  if (!entry) {
    return { ok: true, changed: false, error: null };
  }

  try {
    const candidate = nextStateFromDraft(entry.snapshot);
    const persisted = persistCandidate(candidate);
    if (!persisted.ok) {
      if (persisted.error?.code !== "STATE_CONFLICT") {
        emit({ type: "error", error: persisted.error });
      }
      return { ok: false, changed: false, error: persisted.error };
    }

    finalizeAllGroups();
    undoStack.pop();
    installState(candidate);
    emit({
      type: "change",
      commandType: "history/undo",
      label: entry.label,
      render: RENDER_ALL,
      notification: { message: "Rückgängig gemacht ✓", type: "success" }
    });
    return { ok: true, changed: true, error: null };
  } catch (error) {
    emit({ type: "error", error });
    return { ok: false, changed: false, error };
  }
}

export function handleExternalState(rawState) {
  let candidate;
  try {
    candidate = normalizeAppState(
      typeof rawState === "string" ? JSON.parse(rawState) : rawState
    );
  } catch (error) {
    return { ok: false, applied: false, error };
  }

  if (!isNewer(candidate, appState)) {
    return { ok: true, applied: false, ignored: true, error: null };
  }
  if (hasPendingLocalChanges()) {
    registerConflict(candidate);
    return { ok: true, applied: false, conflict: true, error: null };
  }

  installState(candidate);
  undoStack = [];
  activeUndoGroups.clear();
  externalConflict = null;
  emit({
    type: "change",
    commandType: "external/apply",
    render: RENDER_ALL,
    notification: {
      message: "Neuere Änderungen aus einem anderen Tab übernommen.",
      type: "success"
    }
  });
  return { ok: true, applied: true, error: null };
}

export function handleStorageEvent(event) {
  if (event?.key !== STORAGE_KEYS.state || !event.newValue) {
    return { ok: true, applied: false, ignored: true, error: null };
  }
  return handleExternalState(event.newValue);
}

export function getExternalConflict() {
  return externalConflict ? clone(externalConflict) : null;
}

export function resolveExternalConflict(strategy) {
  if (!externalConflict) {
    return { ok: true, changed: false, error: null };
  }

  if (strategy === "external") {
    installState(clone(externalConflict));
    undoStack = [];
    activeUndoGroups.clear();
    pendingLocalEdits.clear();
    externalConflict = null;
    emit({
      type: "change",
      commandType: "external/resolve",
      render: RENDER_ALL,
      notification: { message: "Externe Version übernommen.", type: "success" }
    });
    return { ok: true, changed: true, error: null };
  }

  if (strategy === "local") {
    const stored = readStoredState(persistenceStorage);
    if (!stored.ok) {
      emit({ type: "error", error: stored.error });
      return { ok: false, changed: false, error: stored.error };
    }
    if (stored.state && isNewer(stored.state, externalConflict)) {
      registerConflict(stored.state);
      return { ok: false, changed: false, error: new StateConflictError() };
    }

    const candidate = nextStateFromDraft(
      getStateSnapshot(),
      Math.max(appState.revision, externalConflict.revision)
    );
    const persisted = persistCandidate(candidate, { allowOverwrite: true });
    if (!persisted.ok) {
      emit({ type: "error", error: persisted.error });
      return { ok: false, changed: false, error: persisted.error };
    }

    installState(candidate);
    externalConflict = null;
    emit({
      type: "change",
      commandType: "local/resolve",
      render: {},
      notification: { message: "Lokale Version beibehalten.", type: "success" }
    });
    return { ok: true, changed: true, error: null };
  }

  const error = new DataValidationError("Unbekannte Konfliktentscheidung.");
  emit({ type: "error", error });
  return { ok: false, changed: false, error };
}
