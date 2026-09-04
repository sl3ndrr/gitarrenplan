import {
  canUndo,
  captureStateSnapshot,
  discardLatestSnapshot,
  peekPreviousSnapshot
} from "../state.js";
import { commitState } from "../storage.js";
import { render, updateEditorValues } from "../render.js";
import { showSaveError, showToast } from "../ui/feedback.js";

export function captureUndo() {
  captureStateSnapshot();
  updateUndoButton();
}

export function discardLatestUndo() {
  discardLatestSnapshot();
  updateUndoButton();
}

export function commitWithUndo(mutator) {
  captureUndo();
  const result = commitState(mutator);

  if (!result.ok) {
    discardLatestUndo();
  }

  return result;
}

export function undo() {
  const previous = peekPreviousSnapshot();
  if (!previous) {
    return;
  }

  const result = commitState((draft) => {
    draft.plans = previous.plans;
    draft.activePlanId = previous.activePlanId;
    draft.minRows = previous.minRows;
  });

  if (!result.ok) {
    showSaveError(result.error);
    return;
  }

  discardLatestUndo();
  updateEditorValues();
  render();
  showToast("Rückgängig gemacht ✓");
}

export function updateUndoButton() {
  const button = document.getElementById("undoBtn");

  if (button) {
    button.disabled = !canUndo();
  }
}
