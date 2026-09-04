import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION, DEFAULT_MIN_ROWS, STORAGE_KEYS } from "../js/config.js";
import { importPlansFromText } from "../js/features/data-transfer.js";
import { createDefaultAppState } from "../js/normalization.js";
import {
  getState,
  getStateSnapshot,
  getUndoDepth,
  initialiseState
} from "../js/state.js";
import { commitState, loadState } from "../js/storage.js";

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("atomare Persistenz", () => {
  it("erzeugt aus leerem oder beschädigtem LocalStorage einen gültigen Standardzustand", () => {
    const emptyState = loadState();
    expect(emptyState).toMatchObject({
      version: APP_STATE_VERSION,
      revision: 0,
      minRows: DEFAULT_MIN_ROWS
    });
    expect(emptyState.plans).toHaveLength(1);
    expect(emptyState.activePlanId).toBe(emptyState.plans[0].id);

    localStorage.setItem(STORAGE_KEYS.state, "{beschädigt");
    const recoveredState = loadState();
    expect(recoveredState.version).toBe(APP_STATE_VERSION);
    expect(recoveredState.plans).toHaveLength(1);
    expect(recoveredState.activePlanId).toBe(recoveredState.plans[0].id);
  });

  it("rollt bei QuotaExceededError die gesamte Änderung zurück", () => {
    const initial = createDefaultAppState();
    const failingStorage = {
      getItem: () => null,
      setItem() {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
    };
    initialiseState(initial, { storage: failingStorage });
    const before = getStateSnapshot();

    const result = commitState((draft) => {
      draft.plans[0].name = "Darf nicht bleiben";
      draft.plans[0].groups.push({ time: "Neue Gruppe", students: [] });
    }, failingStorage);

    expect(result.ok).toBe(false);
    expect(result.error.name).toBe("QuotaExceededError");
    expect(getState()).toEqual(before);
    expect(getUndoDepth()).toBe(0);
  });

  it("verändert bei einer ungültigen Importdatei den Zustand nicht", () => {
    initialiseState(createDefaultAppState());
    const before = getStateSnapshot();

    const result = importPlansFromText(JSON.stringify({
      type: "gitarrenunterricht-plan",
      version: 999,
      plan: { name: "Zukunft" }
    }));

    expect(result.ok).toBe(false);
    expect(getState()).toEqual(before);
    expect(getUndoDepth()).toBe(0);
  });
});

describe("Migration", () => {
  it("migriert bestehende V2-Daten atomar in den V3-State", () => {
    localStorage.setItem(STORAGE_KEYS.plansV2, JSON.stringify([{
      id: "plan-v2",
      name: "Alter Plan",
      meta: { title: "Alt", teacher: "T", location: "L", term: 2025 },
      groups: [{
        id: "group-v2",
        day: "Montag",
        time: "15:00",
        students: [{ name: "Ada", className: "2 a" }]
      }]
    }]));
    localStorage.setItem(STORAGE_KEYS.activePlanV2, "plan-v2");
    localStorage.setItem(STORAGE_KEYS.minRowsV1, "9");

    const state = loadState();

    expect(state).toMatchObject({
      version: APP_STATE_VERSION,
      activePlanId: "plan-v2",
      minRows: 9
    });
    expect(state.plans[0].meta.term).toBe("2025");
    expect(state.plans[0].groups[0].students[0].id).toEqual(expect.any(String));
    expect(localStorage.getItem(STORAGE_KEYS.state)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.plansV2)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.activePlanV2)).toBeNull();
  });

  it("migriert bestehende V1-Metadaten und -Gruppen", () => {
    localStorage.setItem(STORAGE_KEYS.legacyMetaV1, JSON.stringify({
      title: "Legacy",
      teacher: "Frau Test",
      location: "Musikraum",
      term: "2024/25"
    }));
    localStorage.setItem(STORAGE_KEYS.legacyGroupsV1, JSON.stringify([{
      day: "Freitag",
      time: "14:00",
      students: [{ name: "Ben", className: "4 c" }]
    }]));

    const state = loadState();

    expect(state.version).toBe(APP_STATE_VERSION);
    expect(state.plans[0].meta.title).toBe("Legacy");
    expect(state.plans[0].groups[0]).toMatchObject({ day: "Freitag", time: "14:00" });
    expect(state.plans[0].groups[0].id).toEqual(expect.any(String));
    expect(state.plans[0].groups[0].students[0].id).toEqual(expect.any(String));
    expect(localStorage.getItem(STORAGE_KEYS.legacyMetaV1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.legacyGroupsV1)).toBeNull();
  });

  it("löscht alte Keys nicht, wenn der neue State nicht geschrieben werden kann", () => {
    const values = new Map([
      [STORAGE_KEYS.plansV2, JSON.stringify([{
        id: "p",
        name: "V2",
        meta: {},
        groups: []
      }])]
    ]);
    const removeItem = vi.fn((key) => values.delete(key));
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem() {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      removeItem
    };

    const state = loadState(storage);

    expect(state.version).toBe(APP_STATE_VERSION);
    expect(removeItem).not.toHaveBeenCalled();
    expect(values.has(STORAGE_KEYS.plansV2)).toBe(true);
  });
});
