import { DEFAULT_META, DEFAULT_MIN_ROWS, STORAGE_KEYS } from "./config.js";
import { showToast } from "./ui/feedback.js";
import {
  clone,
  createDefaultPlan,
  createPlanId,
  normalizeGroups,
  normalizePlan
} from "./utils.js";

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    showToast("Speichern fehlgeschlagen – Browserspeicher möglicherweise voll.", "error");
    return false;
  }
}

export function loadPlans() {
  const savedPlans = safeGetItem(STORAGE_KEYS.plans);

  if (savedPlans) {
    try {
      const parsedPlans = JSON.parse(savedPlans);

      if (Array.isArray(parsedPlans) && parsedPlans.length > 0) {
        return parsedPlans.map(normalizePlan);
      }
    } catch {
      return [createDefaultPlan()];
    }
  }

  const legacyMeta = safeGetItem(STORAGE_KEYS.legacyMeta);
  const legacyGroups = safeGetItem(STORAGE_KEYS.legacyGroups);

  if (legacyMeta || legacyGroups) {
    let migratedMeta = clone(DEFAULT_META);
    let migratedGroups = [];

    try {
      if (legacyMeta) {
        migratedMeta = { ...clone(DEFAULT_META), ...JSON.parse(legacyMeta) };
      }
    } catch {
      migratedMeta = clone(DEFAULT_META);
    }

    try {
      if (legacyGroups) {
        migratedGroups = normalizeGroups(JSON.parse(legacyGroups));
      }
    } catch {
      migratedGroups = [];
    }

    return [{
      id: createPlanId(),
      name: "Gitarrenunterricht Montag",
      meta: migratedMeta,
      groups: migratedGroups
    }];
  }

  return [createDefaultPlan()];
}

export function loadActivePlanId(plans) {
  return safeGetItem(STORAGE_KEYS.activePlan) || plans[0]?.id || "";
}

export function loadMinRows() {
  const storedValue = Number.parseInt(safeGetItem(STORAGE_KEYS.minRows), 10);

  if (Number.isNaN(storedValue)) {
    return DEFAULT_MIN_ROWS;
  }

  return Math.max(0, Math.min(20, storedValue));
}

export function savePlans(plans) {
  return safeSetItem(STORAGE_KEYS.plans, JSON.stringify(plans));
}

export function saveActivePlanId(activePlanId) {
  return safeSetItem(STORAGE_KEYS.activePlan, activePlanId);
}

export function saveMinRows(minRows) {
  return safeSetItem(STORAGE_KEYS.minRows, String(minRows));
}

export function saveAll(plans, activePlanId) {
  savePlans(plans);
  saveActivePlanId(activePlanId);
}
