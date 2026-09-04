import { canUndo, undo as undoState } from "../state.js";
import { flushPendingTextEdits } from "../ui/text-edit.js";

export function undo() {
  const flushed = flushPendingTextEdits();
  if (!flushed.ok) {
    return flushed;
  }
  return undoState();
}

export function updateUndoButton() {
  const button = document.getElementById("undoBtn");
  if (button) {
    button.disabled = !canUndo();
  }
}

export function initialiseHistory() {
  const button = document.getElementById("undoBtn");
  button.addEventListener("click", undo);
  return () => button.removeEventListener("click", undo);
}

