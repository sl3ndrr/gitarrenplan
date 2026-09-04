import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_VERSION } from "../js/config.js";
import { initialiseEditor } from "../js/features/editor.js";
import { initialiseScheduleActions } from "../js/features/schedule-actions.js";
import { normalizeAppState } from "../js/normalization.js";
import {
  disposeRenderScheduler,
  flushRender,
  render,
  requestRender
} from "../js/render.js";
import {
  getActivePlan,
  getUndoDepth,
  initialiseState,
  subscribe,
  undo
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
      name: "Ursprünglicher Plan",
      meta: { title: "Titel", teacher: "L", location: "R", term: "" },
      groups: [{
        id: "group-1",
        day: "Montag",
        time: "15:00",
        students: [
          { id: "student-1", name: "Ada", className: "2 a" },
          { id: "student-2", name: "Berta", className: "3 b" }
        ]
      }]
    }]
  });
}

let cleanups;

function connectRenderer() {
  return subscribe((event) => {
    if (event.type === "change") {
      requestRender(event.render);
    }
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mountAppFixture();
  initialiseState(createState());
  cleanups = [connectRenderer()];
  render();
});

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  disposeTextEdits();
  disposeRenderScheduler();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("abgeschlossene Texteingaben", () => {
  it("erzeugen auch über mehrere Debounce-Speicherungen genau einen Undo-Schritt", () => {
    cleanups.push(initialiseEditor());
    const input = document.getElementById("planName");
    input.focus();
    input.value = "Zwischenstand";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(300);

    input.value = "Endstand";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(300);
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(getActivePlan().name).toBe("Endstand");
    expect(getUndoDepth()).toBe(1);

    undo();
    expect(getActivePlan().name).toBe("Ursprünglicher Plan");
  });

  it("bündelt mehrere schnelle Eingaben in einen Render-Frame", () => {
    const callbacks = [];
    const requestAnimationFrame = vi.fn((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    cleanups.push(initialiseEditor());

    const input = document.getElementById("metaTitle");
    input.focus();
    for (const value of ["N", "Ne", "Neu"]) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    vi.advanceTimersByTime(300);

    expect(getActivePlan().meta.title).toBe("Neu");
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);
  });
});

describe("native Inline-Bearbeitung", () => {
  it("verwendet Inputs mit stabilen IDs und reine Drucktexte", () => {
    expect(document.querySelector("[contenteditable]")).toBeNull();
    const input = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-1"][data-field="name"]'
    );
    expect(input.dataset.inlineKey).toBe("student:student-1:name");
    expect(input.closest("td").querySelector(".print-only").textContent).toBe("Ada");
  });

  it("entfernt beim focusout keinen gerade angeklickten Aktionsbutton", () => {
    const callbacks = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    cleanups.push(initialiseScheduleActions());

    const input = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-2"][data-field="name"]'
    );
    const moveUpButton = document.querySelector(
      'button[data-action="student-up"][data-student-id="student-2"]'
    );
    input.focus();
    input.value = "Berta Neu";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();

    expect(moveUpButton.isConnected).toBe(true);
    moveUpButton.click();
    expect(moveUpButton.isConnected).toBe(true);
    expect(callbacks).toHaveLength(1);

    flushRender();
    expect(getActivePlan().groups[0].students.map((student) => student.id))
      .toEqual(["student-2", "student-1"]);
    expect(getActivePlan().groups[0].students[0].name).toBe("Berta Neu");
  });

  it("erhält Fokus und Auswahl über einen gebündelten Inline-Render", () => {
    const callbacks = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    cleanups.push(initialiseScheduleActions());

    const input = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-1"][data-field="name"]'
    );
    input.focus();
    input.value = "Adalie";
    input.setSelectionRange(2, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(300);
    callbacks[0]();

    const restored = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-1"][data-field="name"]'
    );
    expect(document.activeElement).toBe(restored);
    expect([restored.selectionStart, restored.selectionEnd]).toEqual([2, 4]);
  });

  it("stellt mit Escape den Originalwert wieder her und entfernt den Undo-Schritt", () => {
    cleanups.push(initialiseScheduleActions());
    let input = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-1"][data-field="name"]'
    );
    input.focus();
    input.value = "Zwischenwert";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(300);
    flushRender();

    input = document.querySelector(
      'input[data-inline-type="student"][data-student-id="student-1"][data-field="name"]'
    );
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    }));
    flushRender();

    expect(getActivePlan().groups[0].students[0].name).toBe("Ada");
    expect(getUndoDepth()).toBe(0);
  });
});

