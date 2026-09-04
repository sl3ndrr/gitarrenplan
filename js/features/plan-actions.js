import { dispatch, getActivePlan, getPlans } from "../state.js";
import { showModal } from "../ui/feedback.js";

function createPlan() {
  showModal({
    title: "Neuer Plan",
    message: "Wie soll der neue Plan heißen?",
    type: "prompt",
    inputValue: "Neuer Gitarrenunterricht-Plan",
    inputPlaceholder: "Planname",
    confirmLabel: "Erstellen",
    onConfirm(name) {
      dispatch({ type: "plan/create", payload: { name } });
    }
  });
}

function duplicatePlan() {
  dispatch({
    type: "plan/duplicate",
    payload: { planId: getActivePlan().id }
  });
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
      dispatch({ type: "plan/delete", payload: { planId: currentPlan.id } });
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
      dispatch({ type: "plan/clear", payload: { planId: plan.id } });
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
      dispatch({ type: "plan/reset", payload: { planId: plan.id } });
    }
  });
}

export function initialisePlanActions() {
  const bindings = [
    ["newPlanBtn", createPlan],
    ["duplicatePlanBtn", duplicatePlan],
    ["deletePlanBtn", deletePlan],
    ["clearPlanBtn", clearPlan],
    ["resetBtn", resetPlan]
  ];
  bindings.forEach(([id, listener]) => {
    document.getElementById(id).addEventListener("click", listener);
  });
  return () => bindings.forEach(([id, listener]) => {
    document.getElementById(id)?.removeEventListener("click", listener);
  });
}

