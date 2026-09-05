import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION, EXPORT_VERSION } from "../js/config.js";
import {
  buildBackupExport,
  importPlansFromText
} from "../js/features/data-transfer.js";
import { initialiseScheduleActions } from "../js/features/schedule-actions.js";
import { normalizeAppState } from "../js/normalization.js";
import { disposeRenderScheduler, render } from "../js/render.js";
import {
  getActivePlan,
  getPlans,
  initialiseState
} from "../js/state.js";
import { disposeFeedback, showModal } from "../js/ui/feedback.js";
import { disposeTextEdits } from "../js/ui/text-edit.js";
import { mountAppFixture } from "./dom-fixture.js";

function plan(id, name, groups = []) {
  return {
    id,
    name,
    meta: {
      title: name,
      teacher: "Lehrkraft",
      location: "Musikraum",
      term: "2026/27"
    },
    groups
  };
}

function stateWith(plans) {
  return normalizeAppState({
    version: APP_STATE_VERSION,
    revision: 4,
    updatedAt: "2026-09-04T08:00:00.000Z",
    plans,
    activePlanId: plans[0].id,
    minRows: 2
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mountAppFixture();
  initialiseState(stateWith([plan("plan-1", "Montag")]));
});

afterEach(() => {
  disposeFeedback();
  disposeTextEdits();
  disposeRenderScheduler();
  vi.useRealTimers();
});

describe("vereinfachter Export", () => {
  it("zeigt genau einen Exportbutton mit eindeutigem zugänglichem Namen", () => {
    const html = readFileSync("index.html", "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const exportButtons = [...parsed.querySelectorAll("button")]
      .filter((button) => button.textContent.trim() === "⬇ Exportieren");

    expect(exportButtons).toHaveLength(1);
    expect(parsed.getElementById("exportAllBtn")).toBeNull();
    expect(exportButtons[0].getAttribute("aria-label"))
      .toBe("Alle Pläne als JSON-Sicherung exportieren");
    expect(parsed.querySelectorAll("h1")).toHaveLength(1);
  });

  it("sichert immer alle Pläne mit Version, Zeitpunkt und verständlichem Dateinamen", () => {
    initialiseState(stateWith([
      plan("plan-1", "Montag"),
      plan("plan-2", "Dienstag")
    ]));
    const backup = buildBackupExport(new Date("2026-09-04T10:11:12.000Z"));

    expect(backup.filename).toBe("gitarrenplan_sicherung_2026-09-04.json");
    expect(backup.data).toMatchObject({
      type: "gitarrenunterricht-plans",
      version: EXPORT_VERSION,
      exportedAt: "2026-09-04T10:11:12.000Z"
    });
    expect(backup.data.plans.map((item) => item.name))
      .toEqual(["Montag", "Dienstag"]);
  });

  it("importiert historische Einzelplan-Dateien weiterhin", () => {
    const result = importPlansFromText(JSON.stringify({
      type: "gitarrenunterricht-plan",
      version: 1,
      exportedAt: "2024-01-01T00:00:00.000Z",
      plan: plan("legacy-plan", "Historischer Einzelplan", [{
        id: "legacy-group",
        day: "Freitag",
        time: "15:00",
        students: [{ id: "legacy-student", name: "Ada", className: "2 a" }]
      }])
    }));

    expect(result.ok).toBe(true);
    expect(result.kind).toBe("single");
    expect(getPlans()).toHaveLength(1);
    expect(getActivePlan().name).toBe("Historischer Einzelplan");
  });
});

describe("zugänglicher Dialog", () => {
  it("hält den Fokus im Dialog und stellt den Ausgangsfokus nach Escape wieder her", () => {
    const origin = document.getElementById("newPlanBtn");
    const cancel = vi.fn();
    origin.focus();

    showModal({
      title: "Neuer Plan",
      message: "Planname eingeben",
      type: "prompt",
      onCancel: cancel
    });
    vi.advanceTimersByTime(0);

    const overlay = document.getElementById("modal-overlay");
    const input = document.getElementById("modal-input");
    const confirm = document.getElementById("modal-confirm");
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(overlay.getAttribute("aria-describedby")).toBe("modal-message");
    expect(document.getElementById("app-shell").hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(input);

    confirm.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(input);

    input.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(confirm);

    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    }));
    expect(overlay.classList.contains("hidden")).toBe(true);
    expect(document.getElementById("app-shell").hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(origin);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe("Dokumentsemantik und Empty State", () => {
  it("erzeugt pro Gruppe Caption und Spaltenüberschriften", () => {
    initialiseState(stateWith([plan("plan-1", "Test", [{
      id: "group-1",
      day: "Montag",
      time: "15:00",
      students: [{ id: "student-1", name: "Ada", className: "2 a" }]
    }])]));
    render();

    const table = document.querySelector(".student-table");
    expect(table.querySelector("caption").textContent)
      .toContain("Montag · 15:00");
    expect([...table.querySelectorAll("thead th")].map((cell) => [
      cell.textContent,
      cell.getAttribute("scope")
    ])).toEqual([
      ["Name", "col"],
      ["Klasse", "col"],
      ["Aktionen", "col"]
    ]);
    expect([...table.querySelectorAll(".empty-row")]
      .every((row) => row.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("deaktiviert den Schülerworkflow ohne Gruppe und fokussiert per CTA das Gruppenfeld", () => {
    render();
    const cleanup = initialiseScheduleActions();

    expect(document.getElementById("studentForm").disabled).toBe(true);
    expect(document.getElementById("groupSelect").disabled).toBe(true);
    expect(document.getElementById("addStudentBtn").disabled).toBe(true);
    expect(document.getElementById("studentFormHint").classList.contains("hidden"))
      .toBe(false);

    document.querySelector('[data-action="focus-group-form"]').click();
    expect(document.activeElement).toBe(document.getElementById("newGroupTime"));
    cleanup();
  });
});
