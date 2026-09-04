import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION } from "../js/config.js";
import { initialiseEditor } from "../js/features/editor.js";
import {
  addGroup,
  addStudent
} from "../js/features/schedule-actions.js";
import { normalizeAppState } from "../js/normalization.js";
import {
  disposeRenderScheduler,
  flushRender,
  render,
  requestRender
} from "../js/render.js";
import {
  getActivePlan,
  initialiseState,
  subscribe
} from "../js/state.js";
import { disposeTextEdits } from "../js/ui/text-edit.js";
import { mountAppFixture } from "./dom-fixture.js";

function createState() {
  return normalizeAppState({
    version: APP_STATE_VERSION,
    revision: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    activePlanId: "plan-1",
    minRows: 2,
    plans: [{
      id: "plan-1",
      name: "Testplan",
      meta: {
        title: "Gitarrenunterricht",
        teacher: "Lehrkraft",
        location: "Raum 1",
        term: ""
      },
      groups: [
        { id: "group-1", day: "Montag", time: "15:00", students: [] },
        { id: "group-2", day: "Dienstag", time: "16:00", students: [] }
      ]
    }]
  });
}

let cleanups;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mountAppFixture();
  initialiseState(createState());
  cleanups = [subscribe((event) => {
    if (event.type === "change") {
      const scope = { ...(event.render || {}) };
      if (event.commandType === "group/add" && event.value?.groupId) {
        scope.preferredGroupId = event.value.groupId;
      }
      requestRender(scope);
    }
  })];
  render();
});

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  disposeTextEdits();
  disposeRenderScheduler();
  vi.useRealTimers();
});

describe("Gruppenauswahl", () => {
  it("behält die zweite Gruppe nach Render und Metadatenänderung bei", () => {
    cleanups.push(initialiseEditor());
    const groupSelect = document.getElementById("groupSelect");
    groupSelect.value = "group-2";

    render();
    expect(groupSelect.value).toBe("group-2");

    const termInput = document.getElementById("metaTerm");
    termInput.focus();
    termInput.value = "2. Halbjahr 2026";
    termInput.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(300);
    flushRender();

    expect(groupSelect.value).toBe("group-2");
    expect(getActivePlan().meta.term).toBe("2. Halbjahr 2026");
  });

  it("fügt zwei Schüler nacheinander weiterhin der zweiten Gruppe hinzu", () => {
    const groupSelect = document.getElementById("groupSelect");
    const nameInput = document.getElementById("studentName");
    const classInput = document.getElementById("studentClass");
    groupSelect.value = "group-2";

    nameInput.value = "Ada";
    classInput.value = "2 a";
    addStudent();
    flushRender();
    expect(groupSelect.value).toBe("group-2");

    nameInput.value = "Berta";
    classInput.value = "3 b";
    addStudent();
    flushRender();

    const [firstGroup, secondGroup] = getActivePlan().groups;
    expect(firstGroup.students).toHaveLength(0);
    expect(secondGroup.students.map((student) => student.name)).toEqual(["Ada", "Berta"]);
    expect(new Set(secondGroup.students.map((student) => student.id)).size).toBe(2);
    expect(groupSelect.value).toBe("group-2");
  });

  it("wählt eine neu erstellte Gruppe aus", () => {
    document.getElementById("groupSelect").value = "group-2";
    document.getElementById("newGroupDay").value = "Montag";
    document.getElementById("newGroupTime").value = "17:00";

    addGroup();
    flushRender();

    const newGroup = getActivePlan().groups.at(-1);
    expect(newGroup.time).toBe("17:00");
    expect(document.getElementById("groupSelect").value).toBe(newGroup.id);
  });

  it("deaktiviert Gruppenauswahl und Schüler-Button ohne Gruppen", () => {
    const state = createState();
    initialiseState(normalizeAppState({
      ...state,
      plans: [{ ...state.plans[0], groups: [] }]
    }));
    render();

    expect(document.getElementById("groupSelect").disabled).toBe(true);
    expect(document.getElementById("addStudentBtn").disabled).toBe(true);
  });

  it("baut Select-Optionen bei reinen Metadatenänderungen nicht neu", () => {
    cleanups.push(initialiseEditor());
    const planOption = document.querySelector("#planSelect option");
    const groupOption = document.querySelector("#groupSelect option");
    const input = document.getElementById("metaLocation");
    input.focus();
    input.value = "Neuer Raum";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    flushRender();

    expect(document.querySelector("#planSelect option")).toBe(planOption);
    expect(document.querySelector("#groupSelect option")).toBe(groupOption);
  });
});

