import { DATA_LIMITS, EXPORT_VERSION } from "../config.js";
import { normalizeImportPayload, DataValidationError } from "../normalization.js";
import { dispatch, getPlans } from "../state.js";
import { downloadJson } from "../utils.js";
import { showModal, showToast } from "../ui/feedback.js";

export function buildBackupExport(date = new Date()) {
  const exportedAt = date.toISOString();
  return {
    data: {
      type: "gitarrenunterricht-plans",
      version: EXPORT_VERSION,
      exportedAt,
      plans: getPlans()
    },
    filename: "gitarrenplan_sicherung_" + exportedAt.slice(0, 10) + ".json"
  };
}

export function exportAllPlans(date = new Date()) {
  const backup = buildBackupExport(date);
  downloadJson(backup.data, backup.filename);
  showToast("JSON-Sicherung aller Pläne erstellt.");
  return backup;
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
  const importButton = document.getElementById("importBtn");
  const importInput = document.getElementById("importFile");
  const exportBackup = () => exportAllPlans();
  const openImport = () => importInput.click();

  exportButton.addEventListener("click", exportBackup);
  importButton.addEventListener("click", openImport);
  importInput.addEventListener("change", importPlans);

  return () => {
    exportButton.removeEventListener("click", exportBackup);
    importButton.removeEventListener("click", openImport);
    importInput.removeEventListener("change", importPlans);
  };
}
