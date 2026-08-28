import {
  getActivePlan,
  getMinRows,
  getPlans,
  setActivePlanId,
  setMinRows
} from "../state.js";
import { render, renderPlanSelect, updateEditorValues } from "../render.js";
import { saveActivePlanId, saveMinRows, savePlans } from "../storage.js";

export function initialiseEditor() {
  document.getElementById("planSelect").addEventListener("change", (event) => {
    setActivePlanId(event.target.value);
    saveActivePlanId(event.target.value);
    updateEditorValues();
    render();
  });

  document.getElementById("planName").addEventListener("input", (event) => {
    const plan = getActivePlan();
    plan.name = event.target.value.trim() || "Unbenannter Plan";
    savePlans(getPlans());
    renderPlanSelect();
  });

  document.getElementById("metaTitle").addEventListener("input", (event) => {
    const plan = getActivePlan();
    plan.meta.title = event.target.value.trim() || "Gitarrenunterricht";
    savePlans(getPlans());
    render();
  });

  document.getElementById("metaTeacher").addEventListener("input", (event) => {
    const plan = getActivePlan();
    plan.meta.teacher = event.target.value.trim() || "Lehrkraft";
    savePlans(getPlans());
    render();
  });

  document.getElementById("metaLocation").addEventListener("input", (event) => {
    const plan = getActivePlan();
    plan.meta.location = event.target.value.trim() || "Ort";
    savePlans(getPlans());
    render();
  });

  document.getElementById("metaTerm").addEventListener("input", (event) => {
    const plan = getActivePlan();
    plan.meta.term = event.target.value.trim();
    savePlans(getPlans());
    render();
  });

  document.getElementById("minRows").addEventListener("input", (event) => {
    setMinRows(event.target.value);
    event.target.value = getMinRows();
    saveMinRows(getMinRows());
    render();
  });
}
