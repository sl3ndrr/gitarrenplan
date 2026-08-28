import {
  canUndo,
  capturePlanSnapshot,
  discardLatestSnapshot,
  ensureActivePlanExists,
  getActivePlanId,
  getPlans,
  restorePreviousSnapshot
} from "../state.js";
import { saveAll } from "../storage.js";
import { render, updateEditorValues } from "../render.js";
import { showToast } from "../ui/feedback.js";

export function captureUndo() {
  capturePlanSnapshot();
  updateUndoButton();
}

export function discardLatestUndo() {
  discardLatestSnapshot();
  updateUndoButton();
}

export function undo() {
  if (!restorePreviousSnapshot()) {
    return;
  }

  ensureActivePlanExists();
  saveAll(getPlans(), getActivePlanId());
  updateEditorValues();
  render();
  updateUndoButton();
  showToast("Rückgängig gemacht ✓");
}

export function updateUndoButton() {
  const button = document.getElementById("undoBtn");

  if (button) {
    button.disabled = !canUndo();
  }
}
