import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, disposeRenderScheduler } from "../js/render.js";
import { initialiseState } from "../js/state.js";
import { normalizeAppState } from "../js/normalization.js";
import { mountAppFixture } from "./dom-fixture.js";

function show(days, counts = days.map(() => 0), minRows = 6) {
  initialiseState(normalizeAppState({
    version: 3, revision: 0, updatedAt: "2026-09-05T00:00:00.000Z",
    activePlanId: "plan", minRows,
    plans: [{ id: "plan", name: "Test", meta: { title: "Test", teacher: "", location: "", term: "" },
      groups: days.map((day, index) => ({ id: "g" + index, day, time: "15:00 Uhr",
        students: Array.from({ length: counts[index] }, (_, i) => ({ id: "s" + index + "-" + i, name: "Test " + i, className: "5a" })) }))
    }]
  }));
  render();
}

beforeEach(() => { localStorage.clear(); mountAppFixture(); });
afterEach(disposeRenderScheduler);

describe("Druckübersicht", () => {
  it("fasst passende Tagespaare zusammen und erhält gemischte Reihenfolgen", () => {
    show(["Montag", "Montag", "Freitag", "Dienstag"]);
    expect([...document.querySelectorAll(".day-heading")].map((node) => node.textContent))
      .toEqual(["Montag", "Freitag", "Dienstag"]);
    expect([...document.querySelectorAll(".timeslot")].map((node) => node.dataset.groupId))
      .toEqual(["g0", "g1", "g2", "g3"]);
    expect(document.querySelectorAll('input[data-field="day"]')).toHaveLength(4);
  });

  it("wiederholt eine Tagesüberschrift nicht in der direkt folgenden Zeile", () => {
    show(["Montag", "Montag", "Montag", "Montag"]);

    expect([...document.querySelectorAll(".day-heading")].map((node) => node.textContent))
      .toEqual(["Montag"]);
    expect(document.querySelectorAll(".slot-row")).toHaveLength(2);
    expect(document.querySelectorAll(".slot-row")[1].querySelector(".day-heading-group")).toBeNull();
  });

  it("beginnt eine neue Überschrift nach einem tatsächlichen Tageswechsel", () => {
    show(["Montag", "Dienstag", "Montag"]);

    expect([...document.querySelectorAll(".day-heading")].map((node) => node.textContent))
      .toEqual(["Montag", "Dienstag", "Montag"]);
  });

  it("lässt eine einzelne letzte Gruppenbox in der linken Spalte", () => {
    show(["Montag", "Dienstag", "Mittwoch"]);

    const lastRow = document.querySelectorAll(".slot-row")[1];
    expect(lastRow.classList.contains("single-centered")).toBe(false);
    expect(lastRow.querySelector(".day-heading").classList.contains("day-heading-column-1")).toBe(true);
  });

  it("zeigt Mindestplätze, echte Belegung und keine negativen freien Plätze", () => {
    show(["Montag", "Dienstag", "Freitag"], [0, 3, 8]);
    expect([...document.querySelectorAll(".group-occupancy")].map((node) => node.textContent))
      .toEqual(["0 / 6 Plätze", "3 / 6 Plätze", "8 / 8 Plätze"]);
    expect(document.querySelector(".document-summary").textContent).toBe("3 Gruppen · 11 Schüler:innen gesamt");
    show([""], [0], 0);
    expect(document.querySelector(".group-occupancy").textContent).toBe("0 / 0 Plätze");
  });

  it("behandelt freie Tagesnamen neutral und escaped statt als HTML", () => {
    show(['<img src=x onerror=alert(1)>']);
    expect(document.querySelector(".timeslot").dataset.weekday).toBe("neutral");
    expect(document.querySelector(".day-heading").textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector("#pages img")).toBeNull();
  });
});
