import { DATA_LIMITS } from "../config.js";
import {
  dispatch,
  getActivePlan,
  getActivePlanId,
  getMinRows
} from "../state.js";
import { bindDebouncedTextInput } from "../ui/text-edit.js";

function bindPlanTextField(elementId, field, maxLength, selector) {
  const element = document.getElementById(elementId);
  element.maxLength = maxLength;
  return bindDebouncedTextInput(element, () => ({
    key: "plan:" + getActivePlanId() + ":" + field,
    getValue: () => selector(getActivePlan()),
    createCommand: (value) => ({
      type: field === "name" ? "plan/nameSet" : "meta/set",
      payload: field === "name" ? { name: value } : { field, value }
    })
  }));
}

export function initialiseEditor() {
  const cleanups = [];
  const planSelect = document.getElementById("planSelect");
  const onPlanChange = (event) => {
    const result = dispatch({
      type: "plan/select",
      payload: { planId: event.target.value }
    });
    if (!result.ok) {
      event.target.value = getActivePlanId();
    }
  };
  planSelect.addEventListener("change", onPlanChange);
  cleanups.push(() => planSelect.removeEventListener("change", onPlanChange));

  cleanups.push(bindPlanTextField(
    "planName",
    "name",
    DATA_LIMITS.planNameLength,
    (plan) => plan.name
  ));
  cleanups.push(bindPlanTextField(
    "metaTitle",
    "title",
    DATA_LIMITS.metadataLength,
    (plan) => plan.meta.title
  ));
  cleanups.push(bindPlanTextField(
    "metaTeacher",
    "teacher",
    DATA_LIMITS.personNameLength,
    (plan) => plan.meta.teacher
  ));
  cleanups.push(bindPlanTextField(
    "metaLocation",
    "location",
    DATA_LIMITS.metadataLength,
    (plan) => plan.meta.location
  ));
  cleanups.push(bindPlanTextField(
    "metaTerm",
    "term",
    DATA_LIMITS.metadataLength,
    (plan) => plan.meta.term
  ));

  const minRows = document.getElementById("minRows");
  cleanups.push(bindDebouncedTextInput(minRows, () => ({
    key: "state:minRows",
    getValue: () => String(getMinRows()),
    createCommand: (value) => ({
      type: "minRows/set",
      payload: { value }
    })
  })));

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}

