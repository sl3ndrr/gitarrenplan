import { describe, expect, it } from "vitest";
import { APP_STATE_VERSION, DATA_LIMITS, DEFAULT_META } from "../js/config.js";
import {
  DataValidationError,
  normalizeAppState,
  normalizePlan,
  normalizePlans
} from "../js/normalization.js";

describe("zentrale Normalisierung", () => {
  it("behandelt numerische, objektartige und überlange Metadaten sicher", () => {
    const plan = normalizePlan({
      id: "plan-1",
      name: "P".repeat(200),
      meta: {
        title: { nested: true },
        teacher: 42,
        location: "Raum\n" + "x".repeat(300),
        term: 2026
      },
      groups: [{
        id: "group-1",
        day: "Montag\nDienstag",
        time: 1530,
        students: [{ id: "student-1", name: 123, className: { unsafe: true } }]
      }]
    });

    expect(plan.name).toHaveLength(DATA_LIMITS.planNameLength);
    expect(plan.meta.title).toBe(DEFAULT_META.title);
    expect(plan.meta.teacher).toBe("42");
    expect(plan.meta.term).toBe("2026");
    expect(plan.meta.location).not.toMatch(/[\r\n]/);
    expect(plan.meta.location.length).toBeLessThanOrEqual(DATA_LIMITS.metadataLength);
    expect(plan.groups[0].day).toBe("Montag Dienstag");
    expect(plan.groups[0].time).toBe("1530");
    expect(plan.groups[0].students[0]).toMatchObject({ name: "123", className: "Klasse" });
  });

  it("repariert fehlende und doppelte IDs über den gesamten Zustand", () => {
    const plans = normalizePlans([
      {
        id: "duplicate-plan",
        name: "Plan 1",
        groups: [{
          id: "duplicate-group",
          time: "A",
          students: [
            { id: "duplicate-student", name: "Ada" },
            { id: "duplicate-student", name: "Berta" }
          ]
        }]
      },
      {
        id: "duplicate-plan",
        name: "Plan 2",
        groups: [{
          id: "duplicate-group",
          time: "B",
          students: [{ name: "Clara" }]
        }]
      }
    ]);

    const groups = plans.flatMap((plan) => plan.groups);
    const students = groups.flatMap((group) => group.students);

    expect(new Set(plans.map((plan) => plan.id)).size).toBe(plans.length);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    expect(new Set(students.map((student) => student.id)).size).toBe(students.length);
    expect(students.every((student) => typeof student.id === "string" && student.id)).toBe(true);
  });

  it("lehnt unbekannte App-State-Versionen ab", () => {
    expect(() => normalizeAppState({
      version: APP_STATE_VERSION + 1,
      plans: []
    })).toThrow(DataValidationError);
  });
});
