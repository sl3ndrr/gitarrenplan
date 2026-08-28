import { DEFAULT_MIN_ROWS, MAX_UNDO_STEPS } from "./config.js";

let plans = [];
let activePlanId = "";
let minRows = DEFAULT_MIN_ROWS;
let undoStack = [];

export function initialiseState({
  initialPlans,
  initialActivePlanId,
  initialMinRows = DEFAULT_MIN_ROWS
}) {
  plans = initialPlans;
  activePlanId = initialActivePlanId;
  minRows = initialMinRows;
  undoStack = [];
}

export function getPlans() {
  return plans;
}

export function setPlans(nextPlans) {
  plans = nextPlans;
}

export function getActivePlanId() {
  return activePlanId;
}

export function setActivePlanId(nextActivePlanId) {
  activePlanId = nextActivePlanId;
}

export function getActivePlan() {
  return plans.find((plan) => plan.id === activePlanId) || plans[0];
}

export function ensureActivePlanExists() {
  if (plans.some((plan) => plan.id === activePlanId)) {
    return false;
  }

  activePlanId = plans[0]?.id || "";
  return true;
}

export function getMinRows() {
  return minRows;
}

export function setMinRows(nextMinRows) {
  minRows = Math.max(0, Math.min(20, Number.parseInt(nextMinRows, 10) || 0));
}

export function capturePlanSnapshot() {
  undoStack.push(JSON.stringify(plans));

  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
}

export function restorePreviousSnapshot() {
  if (undoStack.length === 0) {
    return false;
  }

  plans = JSON.parse(undoStack.pop());
  return true;
}

export function discardLatestSnapshot() {
  undoStack.pop();
}

export function canUndo() {
  return undoStack.length > 0;
}
