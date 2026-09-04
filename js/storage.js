import {
  APP_STATE_VERSION,
  DEFAULT_META,
  DEFAULT_MIN_ROWS,
  STORAGE_KEYS
} from "./config.js";
import {
  createDefaultAppState,
  createDefaultPlan,
  normalizeAppState
} from "./normalization.js";
import { getStateSnapshot, replaceState } from "./state.js";
import { clone } from "./utils.js";

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function safeGetItem(key, storage = getDefaultStorage()) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSetItem(key, value, storage = getDefaultStorage()) {
  try {
    if (!storage) {
      throw new DOMException("LocalStorage ist nicht verfügbar.", "SecurityError");
    }

    storage.setItem(key, value);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

function safeRemoveItem(key, storage) {
  try {
    storage?.removeItem(key);
  } catch {
    // Cleanup is best-effort. A valid v3 state has already been persisted.
  }
}

function parseJson(value) {
  return JSON.parse(value);
}

function buildMigratedState({ plans, activePlanId, minRows, now }) {
  return normalizeAppState({
    version: APP_STATE_VERSION,
    revision: 0,
    updatedAt: now,
    plans,
    activePlanId,
    minRows
  }, { now });
}

function readV2State(storage, now) {
  const rawPlans = safeGetItem(STORAGE_KEYS.plansV2, storage);
  if (rawPlans === null) {
    return null;
  }

  try {
    const plans = parseJson(rawPlans);
    return buildMigratedState({
      plans,
      activePlanId: safeGetItem(STORAGE_KEYS.activePlanV2, storage),
      minRows: safeGetItem(STORAGE_KEYS.minRowsV1, storage) ?? DEFAULT_MIN_ROWS,
      now
    });
  } catch {
    return null;
  }
}

function readV1State(storage, now) {
  const rawMeta = safeGetItem(STORAGE_KEYS.legacyMetaV1, storage);
  const rawGroups = safeGetItem(STORAGE_KEYS.legacyGroupsV1, storage);

  if (rawMeta === null && rawGroups === null) {
    return null;
  }

  let meta = clone(DEFAULT_META);
  let groups = [];

  try {
    if (rawMeta !== null) {
      meta = parseJson(rawMeta);
    }
  } catch {
    meta = clone(DEFAULT_META);
  }

  try {
    if (rawGroups !== null) {
      groups = parseJson(rawGroups);
    }
  } catch {
    groups = [];
  }

  try {
    const plan = createDefaultPlan("Gitarrenunterricht Montag");
    plan.meta = meta;
    plan.groups = groups;

    return buildMigratedState({
      plans: [plan],
      activePlanId: plan.id,
      minRows: safeGetItem(STORAGE_KEYS.minRowsV1, storage) ?? DEFAULT_MIN_ROWS,
      now
    });
  } catch {
    return null;
  }
}

function persistLoadedState(state, storage) {
  let serialized;

  try {
    serialized = JSON.stringify(state);
  } catch (error) {
    return { ok: false, error };
  }

  return safeSetItem(STORAGE_KEYS.state, serialized, storage);
}

function removeLegacyKeys(storage) {
  [
    STORAGE_KEYS.plansV2,
    STORAGE_KEYS.activePlanV2,
    STORAGE_KEYS.minRowsV1,
    STORAGE_KEYS.legacyGroupsV1,
    STORAGE_KEYS.legacyMetaV1
  ].forEach((key) => safeRemoveItem(key, storage));
}

export function loadState(storage = getDefaultStorage()) {
  const now = new Date().toISOString();
  const rawState = safeGetItem(STORAGE_KEYS.state, storage);

  if (rawState !== null) {
    try {
      const state = normalizeAppState(parseJson(rawState), { now });
      const canonical = JSON.stringify(state);

      if (canonical !== rawState) {
        safeSetItem(STORAGE_KEYS.state, canonical, storage);
      }

      return state;
    } catch {
      // A damaged v3 value must not prevent recovery from older keys.
    }
  }

  const migratedState = readV2State(storage, now) || readV1State(storage, now);
  const state = migratedState || createDefaultAppState({ now });
  const persisted = persistLoadedState(state, storage);

  if (migratedState && persisted.ok) {
    removeLegacyKeys(storage);
  }

  return state;
}

export function commitState(mutator, storage = getDefaultStorage()) {
  const before = getStateSnapshot();

  try {
    if (typeof mutator !== "function") {
      throw new TypeError("commitState erwartet eine Mutator-Funktion.");
    }

    const draft = clone(before);
    mutator(draft);

    const nextState = normalizeAppState({
      ...draft,
      version: APP_STATE_VERSION,
      revision: before.revision + 1,
      updatedAt: new Date().toISOString()
    });
    const serialized = JSON.stringify(nextState);
    const persisted = safeSetItem(STORAGE_KEYS.state, serialized, storage);

    if (!persisted.ok) {
      return persisted;
    }

    replaceState(nextState);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}
