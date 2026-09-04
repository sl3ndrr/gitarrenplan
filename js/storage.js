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
import {
  getDefaultStorage,
  persistState,
  safeGetItem,
  safeSetItem
} from "./persistence.js";
import { runUndoable } from "./state.js";
import { clone } from "./utils.js";

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
    return buildMigratedState({
      plans: JSON.parse(rawPlans),
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
      meta = JSON.parse(rawMeta);
    }
  } catch {
    meta = clone(DEFAULT_META);
  }
  try {
    if (rawGroups !== null) {
      groups = JSON.parse(rawGroups);
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
      const state = normalizeAppState(JSON.parse(rawState), { now });
      const canonical = JSON.stringify(state);
      if (canonical !== rawState) {
        safeSetItem(STORAGE_KEYS.state, canonical, storage);
      }
      return state;
    } catch {
      // Ein beschädigter V3-Wert darf die Migration aus älteren Keys nicht blockieren.
    }
  }

  const migratedState = readV2State(storage, now) || readV1State(storage, now);
  const state = migratedState || createDefaultAppState({ now });
  const persisted = persistState(state, storage);

  if (migratedState && persisted.ok) {
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
