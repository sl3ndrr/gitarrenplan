import { getActivePlan, getActivePlanId, getMinRows } from "../state.js";
import { render, renderPlanSelect, updateEditorValues } from "../render.js";
import { commitState } from "../storage.js";
import { showSaveError } from "../ui/feedback.js";

function findDraftActivePlan(draft) {
  return draft.plans.find((plan) => plan.id === draft.activePlanId) || draft.plans[0];
}

function commitEditorChange(mutator) {
  const result = commitState(mutator);

  if (!result.ok) {
    showSaveError(result.error);
  }

  return result.ok;
}

export function initialiseEditor() {
  document.getElementById("planSelect").addEventListener("change", (event) => {
    if (!commitEditorChange((draft) => {
      draft.activePlanId = event.target.value;
    })) {
      event.target.value = getActivePlanId();
      return;
    }

    updateEditorValues();
    render();
  });

  document.getElementById("planName").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      findDraftActivePlan(draft).name = event.target.value;
    })) {
      event.target.value = getActivePlan().name;
      return;
    }

    event.target.value = getActivePlan().name;
    renderPlanSelect();
  });

  document.getElementById("metaTitle").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      findDraftActivePlan(draft).meta.title = event.target.value;
    })) {
      event.target.value = getActivePlan().meta.title;
      return;
    }

    event.target.value = getActivePlan().meta.title;
    render();
  });

  document.getElementById("metaTeacher").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      findDraftActivePlan(draft).meta.teacher = event.target.value;
    })) {
      event.target.value = getActivePlan().meta.teacher;
      return;
    }

    event.target.value = getActivePlan().meta.teacher;
    render();
  });

  document.getElementById("metaLocation").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      findDraftActivePlan(draft).meta.location = event.target.value;
    })) {
      event.target.value = getActivePlan().meta.location;
      return;
    }

    event.target.value = getActivePlan().meta.location;
    render();
  });

  document.getElementById("metaTerm").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      findDraftActivePlan(draft).meta.term = event.target.value;
    })) {
      event.target.value = getActivePlan().meta.term;
      return;
    }

    event.target.value = getActivePlan().meta.term;
    render();
  });

  document.getElementById("minRows").addEventListener("input", (event) => {
    if (!commitEditorChange((draft) => {
      draft.minRows = event.target.value;
    })) {
      event.target.value = getMinRows();
      return;
    }

    event.target.value = getMinRows();
    render();
  });
}
