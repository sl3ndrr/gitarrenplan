import {
  APP_STATE_VERSION,
  DEFAULT_MIN_ROWS,
  STORAGE_KEYS
} from "./config.js";
import {
  createDefaultAppState,
  createDefaultPlan,
  normalizeAppState
} from "./normalization.js";
import {
  getDefaultStorage,
  persistState,
  safeGetItem,
  safeSetItem
} from "./persistence.js";
import { runUndoable } from "./state.js";
import { createPlanId } from "./utils.js";

export {
  getDefaultStorage,
  persistState,
  readStoredState,
  safeGetItem,
  safeSetItem
} from "./persistence.js";

function safeRemoveItem(key, storage) {
  try {
    storage?.removeItem(key);
  } catch {
    // Best effort: Der gültige V3-State ist zu diesem Zeitpunkt bereits gespeichert.
  }
}

function buildMigratedState({ plans, activePlanId, minRows, now }) {
  return normalizeAppState({
    version: 3,
    revision: 0,
    updatedAt: now,
    plans,
    activePlanId,
    minRows
  }, { now });
}

function readV2State(storage, now, report) {
  const rawPlans = safeGetItem(STORAGE_KEYS.plansV2, storage);
  if (rawPlans === null) {
    return null;
  }
  try {
    return buildMigratedState({
      plans: JSON.parse(rawPlans),
      activePlanId: safeGetItem(STORAGE_KEYS.activePlanV2, storage),
      minRows: safeGetItem(STORAGE_KEYS.minRowsV1, storage) ?? DEFAULT_MIN_ROWS,
      now
    });
  } catch {
    backupRaw(rawPlans, STORAGE_KEYS.plansV2, storage, now, report);
    return null;
  }
}

function readV1State(storage, now, report) {
  const rawMeta = safeGetItem(STORAGE_KEYS.legacyMetaV1, storage);
  const rawGroups = safeGetItem(STORAGE_KEYS.legacyGroupsV1, storage);
  if (rawMeta === null && rawGroups === null) {
    return null;
  }

  const meta = rawMeta === null ? {} : parseLegacy(rawMeta, STORAGE_KEYS.legacyMetaV1, {}, storage, now, report);
  const groups = rawGroups === null ? [] : parseLegacy(rawGroups, STORAGE_KEYS.legacyGroupsV1, [], storage, now, report);

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
    if (rawMeta !== null) backupRaw(rawMeta, STORAGE_KEYS.legacyMetaV1, storage, now, report);
    if (rawGroups !== null) backupRaw(rawGroups, STORAGE_KEYS.legacyGroupsV1, storage, now, report);
    return null;
  }
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

function backupRaw(raw, key, storage, now, report, extra = {}) {
  const prefix = key + "_defekt_";
  // Reuse the same copy after reload, including when a newer version is active.
  let backupKey = safeGetItem(prefix + "letzte", storage);
  let saved = Boolean(backupKey && safeGetItem(backupKey, storage) === raw);
  if (!saved) {
    backupKey = prefix + now + "_" + createPlanId();
    saved = safeSetItem(backupKey, raw, storage).ok;
    if (saved) safeSetItem(prefix + "letzte", backupKey, storage);
  }
  report({ raw, backupKey, saved, ...extra });
  return saved;
}

function parseLegacy(raw, key, fallback, storage, now, report) {
  try {
    return JSON.parse(raw);
  } catch {
    backupRaw(raw, key, storage, now, report);
    return fallback;
  }
}

export function loadState(storage = getDefaultStorage(), onIssue = () => {}) {
  const now = new Date().toISOString();
  const rawState = safeGetItem(STORAGE_KEYS.state, storage);
  let protectedData = false;
  const report = (issue) => {
    protectedData ||= !issue.saved;
    onIssue(issue);
  };

  if (rawState !== null) {
    let recovered;
    const discarded = { groups: 0, students: 0 };
    try {
      const parsed = JSON.parse(rawState);
      if (Number(parsed?.version) > APP_STATE_VERSION) {
        backupRaw(rawState, STORAGE_KEYS.state, storage, now, report, { future: true });
        return createDefaultAppState({ now });
      }
      recovered = normalizeAppState(parsed, { now, discarded });
    } catch {
      backupRaw(rawState, STORAGE_KEYS.state, storage, now, report);
    }
    if (recovered) {
      if (discarded.groups || discarded.students) {
        backupRaw(rawState, STORAGE_KEYS.state, storage, now, report, { discarded });
      }
      const canonical = JSON.stringify(recovered);
      if (!protectedData && canonical !== rawState) {
        safeSetItem(STORAGE_KEYS.state, canonical, storage);
      }
      return recovered;
    }
  }

  const migratedState = readV2State(storage, now, report) || readV1State(storage, now, report);
  const state = migratedState || createDefaultAppState({ now });
  if (!protectedData && persistState(state, storage).ok && migratedState) {
    removeLegacyKeys(storage);
  }
  return state;
}

// Kompatibilitätsadapter aus Phase 1. Neue Feature-Module verwenden dispatch().
export function commitState(mutator, storage = getDefaultStorage()) {
  return runUndoable("Direkte Änderung", (draft) => {
    mutator(draft);
    return {};
  }, {
    undoable: false,
    storage
  });
}
