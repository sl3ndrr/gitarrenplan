import { DATA_LIMITS, EXPORT_VERSION } from "../config.js";
import { normalizeImportPayload, DataValidationError } from "../normalization.js";
import { dispatch, getActivePlan, getPlans } from "../state.js";
import { downloadJson, formatDate, sanitizeFilename } from "../utils.js";
import { showModal, showToast } from "../ui/feedback.js";

function exportActivePlan() {
  const plan = getActivePlan();
  downloadJson({
    type: "gitarrenunterricht-plan",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    plan
  }, sanitizeFilename(plan.name) + ".json");
  showToast("Plan exportiert ✓");
}

function exportAllPlans() {
  const date = formatDate(new Date()).replace(/\./g, "-");
  downloadJson({
    type: "gitarrenunterricht-plans",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    plans: getPlans()
  }, "alle_plaene_" + date + ".json");
  showToast("Alle Pläne exportiert ✓");
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

export function importPlansFromText(text) {
  let dispatched = false;
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
    dispatched = true;
    const result = dispatch({
      type: "import/add",
      payload: { plans: imported.plans, kind: imported.kind }
    });
    return {
      ...result,
      count: imported.plans.length,
      kind: imported.kind,
      planName: imported.plans[0].name,
      reported: !result.ok
    };
  } catch (error) {
    return { ok: false, changed: false, error, reported: dispatched };
  }
}

function showImportError(message = "Die Datei konnte nicht importiert werden. Bitte eine gültige JSON-Exportdatei auswählen.") {
  showModal({ title: "Import fehlgeschlagen", message, type: "alert" });
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
    if (!result.ok && !result.reported && result.error?.code === "INVALID_DATA") {
      showImportError(result.error.message);
    }
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

export function initialiseDataTransfer() {
  const exportButton = document.getElementById("exportBtn");
  const exportAllButton = document.getElementById("exportAllBtn");
  const importButton = document.getElementById("importBtn");
  const importInput = document.getElementById("importFile");
  const openImport = () => importInput.click();

  exportButton.addEventListener("click", exportActivePlan);
  exportAllButton.addEventListener("click", exportAllPlans);
  importButton.addEventListener("click", openImport);
  importInput.addEventListener("change", importPlans);

  return () => {
    exportButton.removeEventListener("click", exportActivePlan);
    exportAllButton.removeEventListener("click", exportAllPlans);
    importButton.removeEventListener("click", openImport);
    importInput.removeEventListener("change", importPlans);
  };
}
