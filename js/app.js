import { initialiseEditor } from "./features/editor.js";
import { initialisePlanActions } from "./features/plan-actions.js";
import { initialiseScheduleActions } from "./features/schedule-actions.js";
import { initialiseDataTransfer } from "./features/data-transfer.js";
import { updateUndoButton } from "./features/history.js";
import { render, updateEditorValues } from "./render.js";
import {
  ensureActivePlanExists,
  getActivePlanId,
  initialiseState
} from "./state.js";
import {
  loadActivePlanId,
  loadMinRows,
  loadPlans,
  saveActivePlanId
} from "./storage.js";

function bootstrap() {
  const plans = loadPlans();

  initialiseState({
    initialPlans: plans,
    initialActivePlanId: loadActivePlanId(plans),
    initialMinRows: loadMinRows()
  });

  if (ensureActivePlanExists()) {
    saveActivePlanId(getActivePlanId());
  }

  initialiseEditor();
  initialisePlanActions();
  initialiseScheduleActions();
  initialiseDataTransfer();

  document.getElementById("printBtn").addEventListener("click", () => window.print());

  updateEditorValues();
  render();
  updateUndoButton();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
