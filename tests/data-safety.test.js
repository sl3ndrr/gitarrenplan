import { beforeEach, expect, it } from "vitest";
import { APP_STATE_VERSION, STORAGE_KEYS } from "../js/config.js";
import { buildBackupExport } from "../js/features/data-transfer.js";
import { normalizePlan } from "../js/normalization.js";
import { dispatch, getActivePlan, initialiseState, undo } from "../js/state.js";
import { loadState } from "../js/storage.js";

beforeEach(() => localStorage.clear());

const legacy = (groups = []) => ({
  version: 3,
  revision: 5,
  minRows: 11,
  activePlanId: "p",
  plans: [{ id: "p", groups }, { id: "q", groups: [] }]
});

it("speichert keine Platzhalter als Daten", () => {
  const plan = normalizePlan({ meta: { teacher: "", location: "" },
    groups: [{ students: [{ name: "", className: "" }] }] });
  expect(plan.meta).toMatchObject({ teacher: "", location: "" });
  expect(plan.groups[0].students[0]).toMatchObject({ name: "", className: "" });
});

it("bewahrt einen neueren Zustand bytegenau auf", () => {
  const raw = JSON.stringify({ ...legacy(), version: APP_STATE_VERSION + 1 });
  localStorage.setItem(STORAGE_KEYS.state, raw);
  const issues = [];
  initialiseState(loadState(localStorage, (issue) => issues.push(issue)));
  expect(localStorage.getItem(STORAGE_KEYS.state)).toBe(raw);
  expect(issues[0]).toMatchObject({ raw, future: true, saved: true });
  expect(dispatch({ type: "meta/set", payload: { field: "title", value: "Test" } }).ok).toBe(false);
  expect(localStorage.getItem(STORAGE_KEYS.state)).toBe(raw);
});

it("rettet lesbare Einträge und sichert die Rohdaten vor dem Speichern", () => {
  const raw = JSON.stringify(legacy([{ students: [null, "Ada"] }, false]));
  localStorage.setItem(STORAGE_KEYS.state, raw);
  const issues = [];
  const state = loadState(localStorage, (issue) => issues.push(issue));
  expect(state.plans[0].groups[0].students[0].name).toBe("Ada");
  expect(issues[0]).toMatchObject({ discarded: { groups: 1, students: 1 }, saved: true });
  expect(localStorage.getItem(issues[0].backupKey)).toBe(raw);
});

it("migriert und exportiert Mindestzeilen für jeden Plan und erhält sie beim Ersetzen und Undo", () => {
  localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(legacy()));
  initialiseState(loadState());
  dispatch({ type: "minRows/set", payload: { value: 9 } });
  const backup = buildBackupExport().data;
  expect(backup.version).toBe(3);
  expect(backup.plans.map((plan) => plan.layout.minRows)).toEqual([9, 11]);
  dispatch({ type: "import/add", payload: { plans: [backup.plans[1]], replace: true } });
  expect(getActivePlan().layout.minRows).toBe(11);
  undo();
  expect(getActivePlan().layout.minRows).toBe(9);
});
