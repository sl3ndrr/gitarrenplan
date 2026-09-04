import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION, STORAGE_KEYS } from "../js/config.js";
import { COMMAND_HANDLERS } from "../js/commands.js";
import { normalizeAppState } from "../js/normalization.js";
import {
  dispatch,
  getActivePlan,
  getPlans,
  getState,
  getUndoDepth,
  initialiseState,
  subscribe,
  undo
} from "../js/state.js";

function createRichState() {
  return normalizeAppState({
    version: APP_STATE_VERSION,
    revision: 4,
    updatedAt: "2026-01-01T00:00:00.000Z",
    activePlanId: "plan-1",
    minRows: 6,
    plans: [
      {
        id: "plan-1",
        name: "Plan Eins",
        meta: {
          title: "Alter Titel",
          teacher: "Lehrkraft",
          location: "Raum 1",
          term: "2025"
        },
        groups: [
          {
            id: "group-1",
            day: "Montag",
            time: "15:00",
            students: [
              { id: "student-1", name: "Zed", className: "3 a" },
              { id: "student-2", name: "Ada", className: "2 b" }
            ]
          },
          {
            id: "group-2",
            day: "Dienstag",
            time: "16:00",
            students: [{ id: "student-3", name: "Berta", className: "4 c" }]
          }
        ]
      },
      {
        id: "plan-2",
        name: "Plan Zwei",
        meta: {},
        groups: []
      }
    ]
  });
}

function memoryStorage(state) {
  const values = new Map([[STORAGE_KEYS.state, JSON.stringify(state)]]);
  return {
    values,
    fail: false,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.fail) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key)
  };
}

function domainState(state) {
  return {
    plans: state.plans,
    activePlanId: state.activePlanId,
    minRows: state.minRows
  };
}

const undoableCommands = [
  ["Plan auswählen", { type: "plan/select", payload: { planId: "plan-2" } }],
  ["Plan erstellen", { type: "plan/create", payload: { name: "Neu" } }],
  ["Plan duplizieren", { type: "plan/duplicate", payload: { planId: "plan-1" } }],
  ["Plan löschen", { type: "plan/delete", payload: { planId: "plan-1" } }],
  ["Plan leeren", { type: "plan/clear", payload: { planId: "plan-1" } }],
  ["Plan zurücksetzen", { type: "plan/reset", payload: { planId: "plan-1" } }],
  ["Planname", { type: "plan/nameSet", payload: { name: "Neuer Name" } }],
  ["Metadaten", { type: "meta/set", payload: { field: "title", value: "Neu" } }],
  ["Mindestzeilen", { type: "minRows/set", payload: { value: 9 } }],
  ["Gruppe hinzufügen", { type: "group/add", payload: { day: "Freitag", time: "18:00" } }],
  ["Gruppe verschieben", { type: "group/move", payload: { groupId: "group-2", offset: -1 } }],
  ["Gruppe sortieren", { type: "group/sort", payload: { groupId: "group-1" } }],
  ["Gruppe entfernen", { type: "group/remove", payload: { groupId: "group-1" } }],
  ["Gruppe bearbeiten", { type: "group/update", payload: { groupId: "group-1", field: "time", value: "19:00" } }],
  ["Schüler hinzufügen", { type: "student/add", payload: { groupId: "group-1", student: { name: "Clara", className: "5 a" } } }],
  ["Schüler verschieben", { type: "student/move", payload: { groupId: "group-1", studentId: "student-2", offset: -1 } }],
  ["Schüler in Gruppe verschieben", { type: "student/moveToGroup", payload: { sourceGroupId: "group-1", targetGroupId: "group-2", studentId: "student-1" } }],
  ["Schüler entfernen", { type: "student/remove", payload: { groupId: "group-1", studentId: "student-1" } }],
  ["Schüler bearbeiten", { type: "student/update", payload: { groupId: "group-1", studentId: "student-1", field: "name", value: "Zelda" } }],
  ["Import", {
    type: "import/add",
    payload: {
      kind: "single",
      plans: [{ id: "import-plan", name: "Import", meta: {}, groups: [] }]
    }
  }]
];

let storage;

beforeEach(() => {
  const state = createRichState();
  storage = memoryStorage(state);
  initialiseState(state, { storage });
});

describe("Command-Undo", () => {
  it("deckt jeden fachlichen Mutation-Command ab", () => {
    expect(new Set(undoableCommands.map(([, command]) => command.type)))
      .toEqual(new Set(Object.keys(COMMAND_HANDLERS)));
  });

  it.each(undoableCommands)("macht %s vollständig rückgängig", (_label, command) => {
    const before = domainState(getState());

    const result = dispatch(command);
    expect(result).toMatchObject({ ok: true, changed: true });
    expect(getUndoDepth()).toBe(1);

    const undone = undo();
    expect(undone).toMatchObject({ ok: true, changed: true });
    expect(domainState(getState())).toEqual(before);
    expect(getUndoDepth()).toBe(0);
  });

  it("stellt beim Undo eines gelöschten Plans auch dessen Aktivierung wieder her", () => {
    dispatch({ type: "plan/delete", payload: { planId: "plan-1" } });
    expect(getState().activePlanId).toBe("plan-2");

    undo();

    expect(getState().activePlanId).toBe("plan-1");
    expect(getPlans().some((plan) => plan.id === "plan-1")).toBe(true);
  });

  it("legt für wirkungslose oder fehlgeschlagene Commands keinen Undo-Schritt an", () => {
    const noop = dispatch({
      type: "group/move",
      payload: { groupId: "group-1", offset: -1 }
    });
    const failed = dispatch({
      type: "student/remove",
      payload: { groupId: "group-1", studentId: "fehlt" }
    });

    expect(noop).toMatchObject({ ok: true, changed: false });
    expect(failed).toMatchObject({ ok: false, changed: false });
    expect(getUndoDepth()).toBe(0);
  });

  it("hält State und Undo bei einem Persistenzfehler atomar", () => {
    const before = getState();
    storage.fail = true;

    const failedChange = dispatch({
      type: "meta/set",
      payload: { field: "title", value: "Darf nicht bleiben" }
    });

    expect(failedChange.ok).toBe(false);
    expect(getState()).toEqual(before);
    expect(getUndoDepth()).toBe(0);

    storage.fail = false;
    dispatch({ type: "meta/set", payload: { field: "title", value: "Gespeichert" } });
    const changed = getState();
    expect(getUndoDepth()).toBe(1);

    storage.fail = true;
    const failedUndo = undo();
    expect(failedUndo.ok).toBe(false);
    expect(getState()).toEqual(changed);
    expect(getUndoDepth()).toBe(1);
  });

  it("gibt über Selektoren und Subscription-Events nur unabhängige Snapshots heraus", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const plans = getPlans();
    const activePlan = getActivePlan();
    plans[0].name = "Extern mutiert";
    activePlan.meta.title = "Extern mutiert";

    dispatch({ type: "meta/set", payload: { field: "term", value: "2026" } });
    const eventState = listener.mock.calls[0][0].state;
    eventState.plans[0].name = "Auch extern mutiert";
    unsubscribe();

    expect(getActivePlan().name).toBe("Plan Eins");
    expect(getActivePlan().meta.title).toBe("Alter Titel");
  });
});
