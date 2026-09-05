import { describe, expect, it } from "vitest";
import {
  PRINT_LAYOUTS,
  estimateStudentRowUnits,
  getPrintLayout,
  paginateGroups
} from "../js/pagination.js";

function student(index, overrides = {}) {
  return {
    id: "student-" + index,
    name: "Schüler " + index,
    className: "Klasse 3 a",
    ...overrides
  };
}

function group(index, studentCount = 0, overrides = {}) {
  return {
    id: "group-" + index,
    day: "Montag",
    time: 14 + index + ":00 Uhr",
    students: Array.from({ length: studentCount }, (_, studentIndex) => (
      student(index + "-" + studentIndex)
    )),
    ...overrides
  };
}

describe("reine Druckpaginierung", () => {
  it("verwendet für null bis vier logische Gruppen immer das 2x2-Raster", () => {
    for (let count = 0; count <= 4; count += 1) {
      const result = paginateGroups(
        Array.from({ length: count }, (_, index) => group(index + 1)),
        6
      );
      expect(result.layout).toBe(PRINT_LAYOUTS.regular);
      expect(result.layout.gridClass).toBe("grid-2x2");
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toHaveLength(count);
    }
  });

  it("verwendet ab fünf logischen Gruppen durchgehend das 2x3-Raster", () => {
    expect(getPrintLayout(5)).toBe(PRINT_LAYOUTS.compact);

    const five = paginateGroups(Array.from({ length: 5 }, (_, index) => group(index)), 0);
    const six = paginateGroups(Array.from({ length: 6 }, (_, index) => group(index)), 0);
    const seven = paginateGroups(Array.from({ length: 7 }, (_, index) => group(index)), 0);
    const twelve = paginateGroups(Array.from({ length: 12 }, (_, index) => group(index)), 0);

    expect(five.pages.map((page) => page.length)).toEqual([5]);
    expect(six.pages.map((page) => page.length)).toEqual([6]);
    expect(seven.pages.map((page) => page.length)).toEqual([6, 1]);
    expect(twelve.pages.map((page) => page.length)).toEqual([6, 6]);
    for (const result of [five, six, seven, twelve]) {
      expect(result.layout.gridClass).toBe("grid-2x3");
    }
  });

  it("teilt 40 Schüler verlustfrei in gleich große 2x2-Segmente", () => {
    const source = group(1, 40);
    const result = paginateGroups([source], 6);
    const segments = result.pages.flat();

    expect(result.layout.id).toBe("2x2");
    expect(result.pages.map((page) => page.length)).toEqual([4, 1]);
    expect(segments).toHaveLength(5);
    expect(segments.map((segment) => segment.students.length)).toEqual([8, 8, 8, 8, 8]);
    expect(segments[0].continuation).toBe(false);
    expect(segments.slice(1).every((segment) => segment.continuation)).toBe(true);
    expect(segments.flatMap((segment) => segment.students).map((item) => item.id))
      .toEqual(source.students.map((item) => item.id));
  });

  it("reduziert Mindest-Leerzeilen, bevor echte Schüler verschoben werden", () => {
    const source = group(1, 7);
    const result = paginateGroups([source], 20);
    const segments = result.pages.flat();

    expect(segments).toHaveLength(1);
    expect(segments[0].students).toHaveLength(7);
    expect(segments[0].emptyRows).toBe(1);

    const empty = paginateGroups([group(2)], 20).pages[0][0];
    expect(empty.emptyRows).toBe(PRINT_LAYOUTS.regular.baselineRows);
  });

  it("berücksichtigt lange Namen und Metadaten konservativ, ohne Daten zu verlieren", () => {
    const longStudents = Array.from({ length: 6 }, (_, index) => student(index, {
      name: "Sehr langer Schülername mit mehreren Bestandteilen Nummer " + index,
      className: "Sehr ausführliche Klassenbezeichnung für den Ausdruck"
    }));
    const source = group(1, 0, {
      day: "Außergewöhnlich langer Wochentag für einen robusten Umbruch",
      time: "Nachmittagskurs mit besonders langer und sicher umbrechender Gruppenbezeichnung",
      students: longStudents
    });
    const result = paginateGroups([source], 6);
    const segments = result.pages.flat();

    expect(estimateStudentRowUnits(longStudents[0], PRINT_LAYOUTS.regular)).toBeGreaterThan(2);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.flatMap((segment) => segment.students).map((item) => item.id))
      .toEqual(longStudents.map((item) => item.id));
    expect(segments.every((segment) => segment.emptyRows === 0)).toBe(true);
  });

  it("füllt Mindestzeilen nur im letzten Fortsetzungssegment auf", () => {
    const source = group(1, 10);
    const segments = paginateGroups([source], 12).pages.flat();

    expect(segments).toHaveLength(2);
    expect(segments[0].emptyRows).toBe(0);
    expect(segments[1].emptyRows).toBe(2);
    expect(segments[1].studentOffset).toBe(8);
  });
});
