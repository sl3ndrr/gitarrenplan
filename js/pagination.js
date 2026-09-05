const STANDARD_ROW_UNITS = 2;

/**
 * Verbindlicher Druckvertrag. Eine Einheit entspricht ungefähr einer halben
 * normalen Tabellenzeile. So kann die reine Paginierung auch Zeilen mit
 * umbrochenen Namen konservativ berücksichtigen, ohne DOM-Messungen zu
 * benötigen.
 */
export const PRINT_LAYOUTS = Object.freeze({
  regular: Object.freeze({
    id: "2x2",
    gridClass: "grid-2x2",
    columns: 2,
    rows: 2,
    slotsPerPage: 4,
    rowUnitBudget: 16,
    baselineRows: 8,
    nameCharactersPerLine: 31,
    classCharactersPerLine: 16,
    dayCharactersPerLine: 18,
    timeCharactersPerLine: 28
  }),
  compact: Object.freeze({
    id: "2x3",
    gridClass: "grid-2x3",
    columns: 2,
    rows: 3,
    slotsPerPage: 6,
    rowUnitBudget: 14,
    baselineRows: 6,
    nameCharactersPerLine: 31,
    classCharactersPerLine: 16,
    dayCharactersPerLine: 18,
    timeCharactersPerLine: 28
  })
});

function text(value) {
  return typeof value === "string" ? value : "";
}

function wrappedLines(value, charactersPerLine) {
  return Math.max(1, Math.ceil(text(value).length / charactersPerLine));
}

export function getPrintLayout(logicalGroupCount) {
  return logicalGroupCount > 4
    ? PRINT_LAYOUTS.compact
    : PRINT_LAYOUTS.regular;
}

export function estimateStudentRowUnits(student, layout) {
  const lines = Math.max(
    wrappedLines(student?.name, layout.nameCharactersPerLine),
    wrappedLines(student?.className, layout.classCharactersPerLine)
  );
  return STANDARD_ROW_UNITS + Math.max(0, lines - 1);
}

function getGroupRowUnitBudget(group, layout) {
  const headerLines = Math.max(
    wrappedLines(group?.day, layout.dayCharactersPerLine),
    wrappedLines(group?.time, layout.timeCharactersPerLine)
  );
  const headerPenalty = Math.max(0, headerLines - 1);
  return Math.max(4, layout.rowUnitBudget - headerPenalty);
}

function splitGroup(group, layout, minRows) {
  const students = Array.isArray(group.students) ? group.students : [];
  const rowUnitBudget = getGroupRowUnitBudget(group, layout);
  const chunks = [];
  let currentStudents = [];
  let currentUnits = 0;
  let studentOffset = 0;

  students.forEach((student) => {
    const studentUnits = estimateStudentRowUnits(student, layout);
    if (currentStudents.length > 0 && currentUnits + studentUnits > rowUnitBudget) {
      chunks.push({ students: currentStudents, usedUnits: currentUnits, studentOffset });
      studentOffset += currentStudents.length;
      currentStudents = [];
      currentUnits = 0;
    }
    currentStudents.push(student);
    currentUnits += studentUnits;
  });

  if (currentStudents.length > 0 || chunks.length === 0) {
    chunks.push({ students: currentStudents, usedUnits: currentUnits, studentOffset });
  }

  const requestedEmptyRows = Math.max(0, minRows - students.length);
  const lastChunk = chunks[chunks.length - 1];
  const availableEmptyRows = Math.max(
    0,
    Math.floor((rowUnitBudget - lastChunk.usedUnits) / STANDARD_ROW_UNITS)
  );
  const lastEmptyRows = Math.min(requestedEmptyRows, availableEmptyRows);

  return chunks.map((chunk, index) => ({
    key: group.id + ":print-segment:" + (index + 1),
    groupId: group.id,
    day: group.day,
    time: group.time,
    students: chunk.students,
    studentOffset: chunk.studentOffset,
    emptyRows: index === chunks.length - 1 ? lastEmptyRows : 0,
    continuation: index > 0,
    part: index + 1,
    totalParts: chunks.length
  }));
}

/**
 * Teilt einen normalisierten Plan deterministisch in druckbare Rastersegmente.
 * Mindestzeilen erzeugen nur Leerzeilen im letzten Segment einer Gruppe und
 * lösen niemals selbst eine zusätzliche Seite aus.
 */
export function paginateGroups(groups, minRows = 0) {
  const logicalGroups = Array.isArray(groups) ? groups : [];
  const layout = getPrintLayout(logicalGroups.length);
  const safeMinRows = Number.isInteger(minRows) ? Math.max(0, minRows) : 0;
  const segments = logicalGroups.flatMap((group) => (
    splitGroup(group, layout, safeMinRows)
  ));
  const pages = [];

  if (segments.length === 0) {
    pages.push([]);
  } else {
    for (let index = 0; index < segments.length; index += layout.slotsPerPage) {
      pages.push(segments.slice(index, index + layout.slotsPerPage));
    }
  }

  return {
    layout,
    logicalGroupCount: logicalGroups.length,
    segmentCount: segments.length,
    pages
  };
}
