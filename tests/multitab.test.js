import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION, STORAGE_KEYS } from "../js/config.js";
import { normalizeAppState } from "../js/normalization.js";
import {
  dispatch,
  getExternalConflict,
  getState,
  handleStorageEvent,
  hasPendingLocalChanges,
  initialiseState,
  markLocalEditPending,
  resolveExternalConflict,
  subscribe
} from "../js/state.js";

function makeState({
  revision = 1,
  updatedAt = "2026-01-01T00:00:00.000Z",
  name = "Lokal"
} = {}) {
  return normalizeAppState({
    version: APP_STATE_VERSION,
    revision,
    updatedAt,
    activePlanId: "plan-1",
    minRows: 6,
    plans: [{
      id: "plan-1",
      name,
      meta: {},
      groups: []
    }]
  });
}

function createStorage(initialState) {
  const values = new Map([[STORAGE_KEYS.state, JSON.stringify(initialState)]]);
  return {
    values,
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key))
  };
}

let current;
let storage;

beforeEach(() => {
  current = makeState();
  storage = createStorage(current);
  initialiseState(current, { storage });
});

describe("Mehrtab-Schutz", () => {
  it("übernimmt einen neueren validen externen Zustand ohne lokale Änderungen ohne Schreibschleife", () => {
    dispatch({ type: "meta/set", payload: { field: "term", value: "lokal gespeichert" } });
    storage.setItem.mockClear();
    const external = makeState({
      revision: getState().revision + 1,
      updatedAt: "2026-01-01T00:01:00.000Z",
      name: "Extern"
    });
    storage.values.set(STORAGE_KEYS.state, JSON.stringify(external));

    const result = handleStorageEvent({
      key: STORAGE_KEYS.state,
      newValue: JSON.stringify(external)
    });

    expect(result).toMatchObject({ ok: true, applied: true });
    expect(getState().plans[0].name).toBe("Extern");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("fordert bei einer neueren externen Version und lokaler offener Bearbeitung eine Entscheidung", () => {
    const events = [];
    const unsubscribe = subscribe((event) => events.push(event.type));
    markLocalEditPending("plan:plan-1:name", true);
    const external = makeState({
      revision: 2,
      updatedAt: "2026-01-01T00:01:00.000Z",
      name: "Extern"
    });
    storage.values.set(STORAGE_KEYS.state, JSON.stringify(external));

    const result = handleStorageEvent({
      key: STORAGE_KEYS.state,
      newValue: JSON.stringify(external)
    });

    expect(result).toMatchObject({ ok: true, applied: false, conflict: true });
    expect(getState().plans[0].name).toBe("Lokal");
    expect(getExternalConflict().plans[0].name).toBe("Extern");
    expect(events).toContain("conflict");

    const resolved = resolveExternalConflict("external");
    unsubscribe();
    expect(resolved).toMatchObject({ ok: true, changed: true });
    expect(getState().plans[0].name).toBe("Extern");
    expect(hasPendingLocalChanges()).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("behält auf Entscheidung die lokale Version mit einer höheren Revision", () => {
    markLocalEditPending("plan:plan-1:name", true);
    const external = makeState({
      revision: 4,
      updatedAt: "2026-01-01T00:01:00.000Z",
      name: "Extern"
    });
    storage.values.set(STORAGE_KEYS.state, JSON.stringify(external));
    handleStorageEvent({
      key: STORAGE_KEYS.state,
      newValue: JSON.stringify(external)
    });
    storage.setItem.mockClear();

    const resolved = resolveExternalConflict("local");
    markLocalEditPending("plan:plan-1:name", false);

    expect(resolved).toMatchObject({ ok: true, changed: true });
    expect(getState().plans[0].name).toBe("Lokal");
    expect(getState().revision).toBe(5);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.values.get(STORAGE_KEYS.state)).revision).toBe(5);
  });

  it("überschreibt keine nochmals neuere Revision während der Konfliktentscheidung", () => {
    markLocalEditPending("plan:plan-1:name", true);
    const external = makeState({ revision: 4, name: "Extern 4" });
    storage.values.set(STORAGE_KEYS.state, JSON.stringify(external));
    handleStorageEvent({
      key: STORAGE_KEYS.state,
      newValue: JSON.stringify(external)
    });

    const newer = makeState({ revision: 5, name: "Extern 5" });
    storage.values.set(STORAGE_KEYS.state, JSON.stringify(newer));
    storage.setItem.mockClear();
    const resolved = resolveExternalConflict("local");

    expect(resolved.ok).toBe(false);
    expect(resolved.error.code).toBe("STATE_CONFLICT");
    expect(getState().plans[0].name).toBe("Lokal");
    expect(getExternalConflict().plans[0].name).toBe("Extern 5");
    expect(storage.setItem).not.toHaveBeenCalled();
    markLocalEditPending("plan:plan-1:name", false);
  });

  it("weist beschädigte externe Zustände ohne State-Mutation ab", () => {
    const before = getState();
    const result = handleStorageEvent({
      key: STORAGE_KEYS.state,
      newValue: JSON.stringify({ version: 999, plans: [] })
    });

    expect(result.ok).toBe(false);
    expect(getState()).toEqual(before);
  });
});

