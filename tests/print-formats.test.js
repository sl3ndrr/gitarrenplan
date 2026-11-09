import { expect, it } from "vitest";
import { normalizePlan } from "../js/normalization.js";
import { paginateGroups } from "../js/pagination.js";
import { paginateAttendance, paginateWeek } from "../js/print-formats.js";

const groups = normalizePlan({
  groups: Array.from({ length: 12 }, (_, i) => ({
    id: "g" + i, day: i === 0 ? "Sa" : i === 11 ? "Sondertag" : "Mo",
    time: "15:30 – 16:00 Uhr",
    students: Array.from({ length: 40 }, (_, j) => ({ name: "Person " + j }))
  }))
}).groups;

it("erfasst in der Wochenübersicht alle Gruppen, auch bei gleicher Zeit und freien Tagen", () => {
  const result = paginateWeek(groups, "landscape");
  expect(result.columns).toContain("Samstag");
  expect(result.columns).toContain("Weitere Tage");
  expect(result.pages.flat(2).flatMap(({ cells }) => cells.filter(Boolean)).map(({ id }) => id).sort())
    .toEqual(groups.map(({ id }) => id).sort());
});

it("paginisiert Anwesenheitszeilen ohne verlorene Namen und übernimmt die Datumsspalten", () => {
  const pages = paginateAttendance(groups.slice(0, 1), {
    orientation: "landscape", minRows: 6, attendanceColumns: 12, showNotes: true
  });
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.every(({ dateColumns, showNotes }) => dateColumns === 12 && showNotes)).toBe(true);
  expect(pages.flatMap(({ rows }) => rows.map(({ name }) => name))).toEqual(groups[0].students.map(({ name }) => name));
});

it("behält bei geringerem Querformat-Budget Raster und Fortsetzungen", () => {
  const result = paginateGroups(groups.slice(0, 1), 6, { orientation: "landscape" });
  expect(result.layout.id).toBe("2x2");
  expect(result.pages.flat().filter((segment) => segment.continuation).length).toBeGreaterThan(0);
  expect(result.pages.flat().flatMap(({ students }) => students)).toHaveLength(40);
});
