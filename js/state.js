import { MAX_UNDO_STEPS } from "./config.js";
import {
  createDefaultAppState,
  normalizeAppState
} from "./normalization.js";
import { clone } from "./utils.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

let appState = deepFreeze(createDefaultAppState());
let undoStack = [];

export function initialiseState(initialState) {
  appState = deepFreeze(normalizeAppState(initialState));
  undoStack = [];
}

export function replaceState(nextState) {
  appState = deepFreeze(nextState);
}

export function getState() {
  return appState;
}

export function getStateSnapshot() {
  return clone(appState);
}

export function getPlans() {
  return appState.plans;
}

export function getActivePlanId() {
  return appState.activePlanId;
}

export function getActivePlan() {
  return appState.plans.find((plan) => plan.id === appState.activePlanId)
    || appState.plans[0];
}

export function getMinRows() {
  return appState.minRows;
}

export function captureStateSnapshot() {
  undoStack.push(getStateSnapshot());

  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
}

export function peekPreviousSnapshot() {
  const snapshot = undoStack.at(-1);
  return snapshot ? clone(snapshot) : null;
}

export function discardLatestSnapshot() {
  undoStack.pop();
}

export function canUndo() {
  return undoStack.length > 0;
}
