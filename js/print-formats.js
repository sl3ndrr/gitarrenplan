import { WEEKDAYS } from "./config.js";
import { escapeHtml } from "./utils.js";

export function paginateWeek(groups, orientation) {
  const columns = WEEKDAYS.filter((day, index) => index < 5 || groups.some((group) => group.day === day));
  const other = "Weitere Tage";
  if (groups.some((group) => !WEEKDAYS.includes(group.day))) columns.push(other);
  const buckets = new Map();
  groups.forEach((group) => {
    const time = group.start || "Ohne feste Uhrzeit";
    const day = WEEKDAYS.includes(group.day) ? group.day : other;
    if (!buckets.has(time)) buckets.set(time, new Map());
    const byDay = buckets.get(time);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(group);
  });
  const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b, "de"))
    .flatMap(([time, byDay]) => {
      const max = Math.max(...[...byDay.values()].map((items) => items.length));
      return Array.from({ length: max }, (_, i) => ({
        time,
        cells: columns.map((day) => byDay.get(day)?.[i] ?? null)
      }));
    });
  const pages = [];
  const limit = orientation === "landscape" ? 5 : 7;
  for (let i = 0; i < rows.length; i += limit) pages.push(rows.slice(i, i + limit));
  return { columns, pages: pages.length ? pages : [[]] };
}

export function paginateAttendance(groups, layout) {
  const limit = layout.orientation === "landscape" ? 14 : 23;
  const dateColumns = layout.attendanceColumns;
  const classWidth = layout.orientation === "landscape" ? 25 : 18;
  const nameWidth = layout.showNotes ? 23 : 30;
  const pages = [];
  groups.forEach((group) => {
    const rows = Array.from({ length: Math.max(group.students.length, layout.minRows) }, (_, i) => group.students[i] ?? null);
    let start = 0;
    let cost = 0;
    const push = (end) => {
      pages.push({ group, rows: rows.slice(start, end), offset: start, dateColumns, showNotes: layout.showNotes });
      start = end;
      cost = 0;
    };
    rows.forEach((student, index) => {
      const weight = Math.max(1, Math.ceil((student?.name.length || 0) / nameWidth),
        Math.ceil((student?.className.length || 0) / classWidth));
      if (cost > 0 && cost + weight > limit) push(index);
      cost += weight;
    });
    push(rows.length);
  });
  return pages.length ? pages : [null];
}

function renderWeekCard(group, minRows) {
  if (!group) return "";
  const names = group.students.slice(0, 3).map(({ name }) => "<li>" + escapeHtml(name) + "</li>");
  if (group.students.length > names.length) names.push("<li>und " + (group.students.length - names.length) + " weitere</li>");
  const groupLabel = group.start && group.end && group.label ? "<span>" + escapeHtml(group.label) + "</span>" : "";
  const additionalDay = !WEEKDAYS.includes(group.day) && group.day ? "<span>" + escapeHtml(group.day) + "</span>" : "";
  return '<div class="week-card" data-weekday="' + (WEEKDAYS.includes(group.day) ? group.day.toLowerCase() : "neutral")
    + '" data-print-check aria-label="Gruppe ' + escapeHtml([group.day, group.time].join(" · ")) + '">'
    + "<strong>" + escapeHtml(group.time) + "</strong>" + groupLabel + additionalDay
    + "<span>" + group.students.length + " / " + Math.max(group.students.length, minRows) + " Plätze</span>"
    + "<ul>" + names.join("") + "</ul></div>";
}

export function renderWeek(rows, columns, minRows) {
  return '<table class="output-table week-table"><thead><tr><th scope="col">Uhrzeit</th>'
    + columns.map((day) => '<th scope="col">' + escapeHtml(day) + "</th>").join("")
    + "</tr></thead><tbody>"
    + rows.map(({ time, cells }) => '<tr><th scope="row">' + escapeHtml(time)
      + "</th>" + cells.map((group) => "<td>" + renderWeekCard(group, minRows) + "</td>").join("") + "</tr>").join("")
    + "</tbody></table>";
}

export function renderAttendance(page, minRows) {
  if (!page) return "<p>Es gibt noch keine Gruppen.</p>";
  const { group, rows, offset, dateColumns, showNotes } = page;
  const dates = '<th scope="col" class="attendance-date">TT.MM.</th>'.repeat(dateColumns);
  const title = [group.day, group.time, offset ? "Fortsetzung" : ""].filter(Boolean).join(" · ");
  const body = rows.map((student, index) => "<tr><td>" + (offset + index + 1) + "</td>"
    + "<td>" + escapeHtml(student?.name ?? "") + "</td><td>" + escapeHtml(student?.className ?? "") + "</td>"
    + "<td></td>".repeat(dateColumns + Number(showNotes)) + "</tr>").join("");
  return '<div class="attendance-content" data-print-check aria-label="Gruppe ' + escapeHtml(title) + '">'
    + '<table class="output-table attendance-table"><caption>' + escapeHtml(title)
    + "<span>" + group.students.length + " / " + Math.max(group.students.length, minRows) + " Plätze</span></caption>"
    + '<thead><tr><th scope="col" class="attendance-index">Nr.</th><th scope="col" class="attendance-name">Name</th>'
    + '<th scope="col" class="attendance-class">Klasse</th>' + dates
    + (showNotes ? '<th scope="col" class="attendance-notes">Notiz</th>' : "")
    + "</tr></thead><tbody>" + body + "</tbody></table></div>";
}
