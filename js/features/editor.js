import { DATA_LIMITS } from "../config.js";
import {
  dispatch,
  getActivePlan,
  getActivePlanId,
  getMinRows
} from "../state.js";
import { bindDebouncedTextInput } from "../ui/text-edit.js";

function updateRangeOutput(outputId, value, suffix) {
  const output = document.getElementById(outputId);
  if (output) {
    output.textContent = value + suffix;
  }
}

function bindAppearanceRange(elementId, field, outputId, suffix) {
  const element = document.getElementById(elementId);
  const updateOutput = () => updateRangeOutput(outputId, element.value, suffix);
  element.addEventListener("input", updateOutput);

  const disposeTextInput = bindDebouncedTextInput(element, () => ({
    key: "appearance:" + getActivePlanId() + ":" + field,
    getValue: () => String(getActivePlan().appearance[field]),
    createCommand: (value) => ({
      type: "appearance/set",
      payload: { field, value }
    })
  }));

  return () => {
    disposeTextInput();
    element.removeEventListener("input", updateOutput);
  };
}

function bindAppearanceToggle() {
  const element = document.getElementById("showOccupancy");
  const onChange = () => {
    const result = dispatch({
      type: "appearance/set",
      payload: { field: "showOccupancy", value: element.checked }
    });
    if (!result.ok) {
      element.checked = getActivePlan().appearance.showOccupancy;
    }
  };
  element.addEventListener("change", onChange);
  return () => element.removeEventListener("change", onChange);
}

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
  cleanups.push(bindAppearanceRange(
    "colorIntensity",
    "colorIntensity",
    "colorIntensityValue",
    " %"
  ));
  cleanups.push(bindAppearanceRange(
    "titleBoxPadding",
    "titleBoxPadding",
    "titleBoxPaddingValue",
    " px"
  ));
  cleanups.push(bindAppearanceToggle());

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}

