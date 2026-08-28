import {
  getActivePlan,
  getActivePlanId,
  getPlans,
  setActivePlanId,
  setPlans
} from "../state.js";
import { render, updateEditorValues } from "../render.js";
import { saveAll } from "../storage.js";
import { captureUndo } from "./history.js";
import { showModal, showToast } from "../ui/feedback.js";
import { clone, createDefaultPlan, createPlanId, normalizePlan } from "../utils.js";
import { DEFAULT_META } from "../config.js";

export function initialisePlanActions() {
  document.getElementById("newPlanBtn").addEventListener("click", createPlan);
  document.getElementById("duplicatePlanBtn").addEventListener("click", duplicatePlan);
  document.getElementById("deletePlanBtn").addEventListener("click", deletePlan);
  document.getElementById("clearPlanBtn").addEventListener("click", clearPlan);
  document.getElementById("resetBtn").addEventListener("click", resetPlan);
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
      const trimmedName = name.trim() || "Neuer Gitarrenunterricht-Plan";
      const newPlan = createDefaultPlan(trimmedName);

      getPlans().push(newPlan);
      setActivePlanId(newPlan.id);
      saveAll(getPlans(), getActivePlanId());
      updateEditorValues();
      render();
      showToast("Plan „" + trimmedName + "“ erstellt ✓");
    }
  });
}

function duplicatePlan() {
  const currentPlan = getActivePlan();
  const duplicate = normalizePlan({
    ...clone(currentPlan),
    id: createPlanId(),
    name: currentPlan.name + " – Kopie"
  });

  getPlans().push(duplicate);
  setActivePlanId(duplicate.id);
  saveAll(getPlans(), getActivePlanId());
  updateEditorValues();
  render();
  showToast("Plan dupliziert ✓");
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
      captureUndo();
      const remainingPlans = getPlans().filter((plan) => plan.id !== currentPlan.id);

      setPlans(remainingPlans);
      setActivePlanId(remainingPlans[0].id);
      saveAll(getPlans(), getActivePlanId());
      updateEditorValues();
      render();
      showToast("Plan gelöscht");
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
      captureUndo();
      plan.groups = [];
      saveAll(getPlans(), getActivePlanId());
      render();
      showToast("Plan geleert");
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
      captureUndo();
      plan.name = "Gitarrenunterricht";
      plan.meta = clone(DEFAULT_META);
      plan.groups = [];
      saveAll(getPlans(), getActivePlanId());
      updateEditorValues();
      render();
      showToast("Plan zurückgesetzt");
    }
  });
}
