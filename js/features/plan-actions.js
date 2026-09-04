import { DEFAULT_META } from "../config.js";
import { getActivePlan, getPlans } from "../state.js";
import { render, updateEditorValues } from "../render.js";
import { commitState } from "../storage.js";
import { commitWithUndo } from "./history.js";
import { showModal, showSaveError, showToast } from "../ui/feedback.js";
import { clone, createPlanId } from "../utils.js";
import { createDefaultPlan } from "../normalization.js";

export function initialisePlanActions() {
  document.getElementById("newPlanBtn").addEventListener("click", createPlan);
  document.getElementById("duplicatePlanBtn").addEventListener("click", duplicatePlan);
  document.getElementById("deletePlanBtn").addEventListener("click", deletePlan);
  document.getElementById("clearPlanBtn").addEventListener("click", clearPlan);
  document.getElementById("resetBtn").addEventListener("click", resetPlan);
}

function finishPlanAction(result, successMessage) {
  if (!result.ok) {
    showSaveError(result.error);
    return false;
  }

  updateEditorValues();
  render();
  showToast(successMessage);
  return true;
}

function createPlan() {
  showModal({
    title: "Neuer Plan",
    message: "Wie soll der neue Plan heißen?",
    type: "prompt",
    inputValue: "Neuer Gitarrenunterricht-Plan",
    inputPlaceholder: "Planname",
    confirmLabel: "Erstellen",
    onConfirm(name) {
      const newPlan = createDefaultPlan(name || "Neuer Gitarrenunterricht-Plan");
      const result = commitWithUndo((draft) => {
        draft.plans.push(newPlan);
        draft.activePlanId = newPlan.id;
      });

      finishPlanAction(result, "Plan „" + (result.ok ? getActivePlan().name : newPlan.name) + "“ erstellt ✓");
    }
  });
}

function duplicatePlan() {
  const currentPlan = getActivePlan();
  const duplicate = {
    ...clone(currentPlan),
    id: createPlanId(),
    name: currentPlan.name + " – Kopie"
  };
  const result = commitWithUndo((draft) => {
    draft.plans.push(duplicate);
    draft.activePlanId = duplicate.id;
  });

  finishPlanAction(result, "Plan dupliziert ✓");
}

function deletePlan() {
  const currentPlan = getActivePlan();

  if (getPlans().length <= 1) {
    showModal({
      title: "Plan kann nicht gelöscht werden",
      message: "Der letzte vorhandene Plan kann nicht gelöscht werden. Du kannst ihn stattdessen vollständig leeren oder zurücksetzen.",
      type: "alert"
    });
    return;
  }

  showModal({
    title: "Plan löschen",
    message: "Plan „" + currentPlan.name + "“ wirklich löschen? Diese Aktion entfernt den gesamten Plan dauerhaft aus diesem Browser.",
    type: "confirm",
    confirmLabel: "Löschen",
    confirmClass: "btn-danger",
    onConfirm() {
      const result = commitWithUndo((draft) => {
        draft.plans = draft.plans.filter((plan) => plan.id !== currentPlan.id);
        draft.activePlanId = draft.plans[0].id;
      });

      finishPlanAction(result, "Plan gelöscht");
    }
  });
}

function clearPlan() {
  const plan = getActivePlan();

  showModal({
    title: "Plan leeren",
    message: "Plan „" + plan.name + "“ vollständig leeren? Alle Gruppen und Schüler werden entfernt.",
    type: "confirm",
    confirmLabel: "Jetzt leeren",
    confirmClass: "btn-danger",
    onConfirm() {
      const result = commitWithUndo((draft) => {
        const target = draft.plans.find((item) => item.id === plan.id);
        target.groups = [];
      });

      finishPlanAction(result, "Plan geleert");
    }
  });
}

function resetPlan() {
  const plan = getActivePlan();

  showModal({
    title: "Plan zurücksetzen",
    message: "Plan „" + plan.name + "“ auf den leeren Grundzustand zurücksetzen?",
    type: "confirm",
    confirmLabel: "Zurücksetzen",
    confirmClass: "btn-danger",
    onConfirm() {
      const result = commitWithUndo((draft) => {
        const target = draft.plans.find((item) => item.id === plan.id);
        target.name = "Gitarrenunterricht";
        target.meta = clone(DEFAULT_META);
        target.groups = [];
      });

      finishPlanAction(result, "Plan zurückgesetzt");
    }
  });
}
