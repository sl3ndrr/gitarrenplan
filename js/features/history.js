import { canRedo, canUndo, redo as redoState, undo as undoState } from "../state.js";
import { flushPendingTextEdits } from "../ui/text-edit.js";

export function undo() {
  const flushed = flushPendingTextEdits();
  return flushed.ok ? undoState() : flushed;
}

export function redo() {
  const flushed = flushPendingTextEdits();
  return flushed.ok ? redoState() : flushed;
}

export function updateUndoButton() {
  const button = document.getElementById("undoBtn");
  const redoButton = document.getElementById("redoBtn");
  if (button) button.disabled = !canUndo();
  if (redoButton) redoButton.disabled = !canRedo();
}

export function initialiseHistory() {
  const button = document.getElementById("undoBtn");
  const redoButton = document.getElementById("redoBtn");
  button.addEventListener("click", undo);
  redoButton?.addEventListener("click", redo);
  return () => {
    button.removeEventListener("click", undo);
    redoButton?.removeEventListener("click", redo);
  };
}
