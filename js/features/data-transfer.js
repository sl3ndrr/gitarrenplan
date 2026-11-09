import { DATA_LIMITS, EXPORT_VERSION } from "../config.js";
import { normalizeImportPayload, DataValidationError } from "../normalization.js";
import { dispatch, getPlans } from "../state.js";
import { downloadJson } from "../utils.js";
import { showModal, showToast } from "../ui/feedback.js";
import { flushPendingTextEdits } from "../ui/text-edit.js";
import { markBackup } from "./backup-notices.js";

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
  if (!flushPendingTextEdits().ok) return null;
  const backup = buildBackupExport(date);
  downloadJson(backup.data, backup.filename);
  markBackup(date);
  showToast("JSON-Sicherung aller Pläne erstellt.");
  return backup;
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function parseImport(text) {
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
  return normalizeImportPayload(parsed);
}

function applyImport(imported, replace = false) {
  if (!flushPendingTextEdits().ok) return { ok: false, changed: false, reported: true };
  const result = dispatch({
    type: "import/add",
    payload: { ...imported, replace }
  });
  return {
    ...result,
    count: imported.plans.length,
    kind: imported.kind,
    planName: imported.plans[0].name,
    reported: !result.ok
  };
}

export function importPlansFromText(text) {
  try {
    return applyImport(parseImport(text));
  } catch (error) {
    return { ok: false, changed: false, error, reported: false };
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
    input.value = "";
    try {
      const imported = parseImport(String(reader.result ?? ""));
      const groups = imported.plans.flatMap((plan) => plan.groups);
      const count = groups.reduce((sum, group) => sum + group.students.length, 0);
      const planCount = imported.plans.length;
      const summary = planCount + (planCount === 1 ? " Plan" : " Pläne")
        + ", " + groups.length + (groups.length === 1 ? " Gruppe" : " Gruppen")
        + ", " + count + " Teilnehmende.";
      showModal({
        title: "Sicherung importieren",
        message: summary + " „Alles ersetzen“ entfernt die bisherigen Pläne. Du kannst das rückgängig machen.",
        type: "confirm",
        confirmLabel: "Hinzufügen",
        onConfirm: () => applyImport(imported),
        alternative: { label: "Alles ersetzen", action: () => applyImport(imported, true) }
      });
    } catch (error) {
      showImportError(error.message);
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
