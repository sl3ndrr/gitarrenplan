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
import {
  createPlanId,
  downloadJson,
  formatDate,
  normalizePlan,
  sanitizeFilename
} from "../utils.js";
import { showModal, showToast } from "../ui/feedback.js";

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
      version: 2,
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
      version: 2,
      exportedAt: new Date().toISOString(),
      plans: getPlans()
    },
    "alle_plaene_" + date + ".json"
  );

  showToast("Alle Pläne exportiert ✓");
}

function importPlans(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (imported.type === "gitarrenunterricht-plans" && Array.isArray(imported.plans)) {
        const importedPlans = imported.plans.map((plan) => {
          return normalizePlan({ ...plan, id: createPlanId() });
        });

        if (importedPlans.length === 0) {
          throw new Error("Keine Pläne gefunden.");
        }

        captureUndo();
        addImportedPlans(importedPlans);
        showToast(importedPlans.length + " Plan(e) importiert ✓");
        return;
      }

      let importedPlan;

      if (imported.type === "gitarrenunterricht-plan" && imported.plan) {
        importedPlan = imported.plan;
      } else if (imported.meta || imported.groups) {
        importedPlan = imported;
      } else {
        throw new Error("Unbekanntes Format.");
      }

      const normalisedPlan = normalizePlan({
        ...importedPlan,
        id: createPlanId(),
        name: importedPlan.name || "Importierter Plan"
      });

      captureUndo();
      addImportedPlans([normalisedPlan]);
      showToast("Plan „" + normalisedPlan.name + "“ importiert ✓");
    } catch {
      showModal({
        title: "Import fehlgeschlagen",
        message: "Die Datei konnte nicht importiert werden. Bitte eine gültige JSON-Exportdatei auswählen.",
        type: "alert"
      });
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function addImportedPlans(importedPlans) {
  const currentPlans = getPlans();

  if (currentPlans.length === 1 && currentPlans[0].groups.length === 0) {
    setPlans(importedPlans);
  } else {
    currentPlans.push(...importedPlans);
  }

  setActivePlanId(importedPlans[0].id);
  saveAll(getPlans(), getActivePlanId());
  updateEditorValues();
  render();
}
