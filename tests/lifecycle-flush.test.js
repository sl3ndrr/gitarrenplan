import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION, STORAGE_KEYS } from "../js/config.js";
import { initialiseEditor } from "../js/features/editor.js";
import { initialiseLifecycle } from "../js/features/lifecycle.js";
import { normalizeAppState } from "../js/normalization.js";
import {
  disposeRenderScheduler,
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
      name: "Plan",
      meta: { title: "Alt", teacher: "L", location: "R", term: "" },
      groups: []
    }]
  });
}

let cleanups;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mountAppFixture();
  initialiseState(createState());
  cleanups = [
    subscribe((event) => {
      if (event.type === "change") {
        requestRender(event.render);
      }
    }),
    initialiseEditor(),
    initialiseLifecycle()
  ];
  render();
});

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  disposeTextEdits();
  disposeRenderScheduler();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sofortiges Flush", () => {
  it("speichert und rendert offene Texteingaben vor window.print()", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const input = document.getElementById("metaTitle");
    input.focus();
    input.value = "Vor dem Druck";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    document.getElementById("printBtn").click();

    expect(print).toHaveBeenCalledOnce();
    expect(getActivePlan().meta.title).toBe("Vor dem Druck");
    expect(document.querySelector(".preview-document-title").textContent).toBe("Vor dem Druck");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.state));
    expect(stored.plans[0].meta.title).toBe("Vor dem Druck");
  });

  it("speichert offene Texteingaben synchron bei pagehide", () => {
    const input = document.getElementById("metaLocation");
    input.focus();
    input.value = "Raum 9";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    window.dispatchEvent(new Event("pagehide"));

    expect(getActivePlan().meta.location).toBe("Raum 9");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.state));
    expect(stored.plans[0].meta.location).toBe("Raum 9");
  });

  it("speichert bei change ohne auf den Debounce-Timer zu warten", () => {
    const input = document.getElementById("metaTeacher");
    input.focus();
    input.value = "Frau Sofort";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(getActivePlan().meta.teacher).toBe("Frau Sofort");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.state))
      .plans[0].meta.teacher).toBe("Frau Sofort");
  });
});
