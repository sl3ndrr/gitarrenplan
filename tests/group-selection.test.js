import { beforeEach, describe, expect, it } from "vitest";
import { APP_STATE_VERSION } from "../js/config.js";
import { initialiseEditor } from "../js/features/editor.js";
import { addGroup, addStudent } from "../js/features/schedule-actions.js";
import { normalizeAppState } from "../js/normalization.js";
import { render, updateEditorValues } from "../js/render.js";
import { getActivePlan, initialiseState } from "../js/state.js";
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

beforeEach(() => {
  localStorage.clear();
  mountAppFixture();
  initialiseState(createState());
  updateEditorValues();
  render();
});

describe("Gruppenauswahl", () => {
  it("behält die zweite Gruppe nach Render und Metadatenänderung bei", () => {
    initialiseEditor();
    const groupSelect = document.getElementById("groupSelect");
    groupSelect.value = "group-2";

    render();
    expect(groupSelect.value).toBe("group-2");

    const termInput = document.getElementById("metaTerm");
    termInput.value = "2. Halbjahr 2026";
    termInput.dispatchEvent(new Event("input", { bubbles: true }));

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

    expect(groupSelect.value).toBe("group-2");

    nameInput.value = "Berta";
    classInput.value = "3 b";
    addStudent();

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

    const newGroup = getActivePlan().groups.at(-1);
    expect(newGroup.time).toBe("17:00");
    expect(document.getElementById("groupSelect").value).toBe(newGroup.id);
  });

  it("deaktiviert Gruppenauswahl und Schüler-Button ohne Gruppen", () => {
    initialiseState(normalizeAppState({
      ...createState(),
      plans: [{ ...createState().plans[0], groups: [] }]
    }));

    render();

    expect(document.getElementById("groupSelect").disabled).toBe(true);
    expect(document.getElementById("addStudentBtn").disabled).toBe(true);
  });
});
