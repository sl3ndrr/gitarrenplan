import { DATA_LIMITS, EXPORT_VERSION } from "../config.js";
import { getActivePlan, getPlans } from "../state.js";
import { render, updateEditorValues } from "../render.js";
import { normalizeImportPayload, DataValidationError } from "../normalization.js";
import { commitWithUndo } from "./history.js";
import { downloadJson, formatDate, sanitizeFilename } from "../utils.js";
import { showModal, showSaveError, showToast } from "../ui/feedback.js";

export function initialiseDataTransfer() {
  document.getElementById("exportBtn").addEventListener("click", exportActivePlan);
  document.getElementById("exportAllBtn").addEventListener("click", exportAllPlans);
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", importPlans);
}

function exportActivePlan() {
  const plan = getActivePlan();

  downloadJson(
    {
      type: "gitarrenunterricht-plan",
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      plan
    },
    sanitizeFilename(plan.name) + ".json"
  );

  showToast("Plan exportiert ✓");
}

function exportAllPlans() {
  const date = formatDate(new Date()).replace(/\./g, "-");

  downloadJson(
    {
      type: "gitarrenunterricht-plans",
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      plans: getPlans()
    },
    "alle_plaene_" + date + ".json"
  );

  showToast("Alle Pläne exportiert ✓");
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

export function importPlansFromText(text) {
  try {
    if (typeof text !== "string" || byteLength(text) > DATA_LIMITS.importBytes) {
      throw new DataValidationError(
        "Die Importdatei darf höchstens " + DATA_LIMITS.importBytes + " Bytes groß sein."
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new DataValidationError("Die Importdatei enthält kein gültiges JSON.");
    }

    const imported = normalizeImportPayload(parsed);
    const firstPlanId = imported.plans[0].id;
    const result = commitWithUndo((draft) => {
      if (draft.plans.length === 1 && draft.plans[0].groups.length === 0) {
        draft.plans = imported.plans;
      } else {
        draft.plans.push(...imported.plans);
      }

      draft.activePlanId = firstPlanId;
    });

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      error: null,
      count: imported.plans.length,
      kind: imported.kind,
      planName: imported.plans[0].name
    };
  } catch (error) {
    return { ok: false, error };
  }
}

function showImportError(message = "Die Datei konnte nicht importiert werden. Bitte eine gültige JSON-Exportdatei auswählen.") {
  showModal({
    title: "Import fehlgeschlagen",
    message,
    type: "alert"
  });
}

function importPlans(event) {
  const input = event.target;
  const file = input.files[0];
  if (!file) {
    return;
  }

  if (file.size > DATA_LIMITS.importBytes) {
    input.value = "";
    showImportError("Die Datei ist zu groß. Maximal erlaubt sind 2 MiB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const result = importPlansFromText(String(reader.result ?? ""));
    input.value = "";

    if (!result.ok) {
      if (result.error?.code === "INVALID_DATA") {
        showImportError(result.error.message);
      } else {
        showSaveError(result.error);
      }
      return;
    }

    updateEditorValues();
    render();
    const message = result.kind === "all"
      ? result.count + " Plan(e) importiert ✓"
      : "Plan „" + result.planName + "“ importiert ✓";
    showToast(message);
  };

  reader.onerror = () => {
    input.value = "";
    showImportError("Die Datei konnte nicht gelesen werden.");
  };

  reader.onabort = () => {
    input.value = "";
    showImportError("Das Einlesen der Datei wurde abgebrochen.");
  };

  reader.readAsText(file);
}
