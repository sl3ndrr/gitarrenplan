import {
  APPEARANCE_LAYOUT_SCALES,
  APPEARANCE_LIMITS,
  DATA_LIMITS
} from "./config.js";
import { paginateGroups } from "./pagination.js";
import { getActivePlan, getActivePlanId, getMinRows, getPlans } from "./state.js";
import { escapeHtml, formatDate } from "./utils.js";

const ALL_RENDER_SCOPES = Object.freeze({
  pages: true,
  planSelect: true,
  groupSelect: true,
  editor: true
});

let pendingRender = {};
let scheduledFrame = null;
let scheduledWithTimeout = false;

function normalizeScope(scope) {
  if (typeof scope === "string") {
    return { ...ALL_RENDER_SCOPES, preferredGroupId: scope };
  }
  return scope || ALL_RENDER_SCOPES;
}

function mergeRenderScope(target, source = {}) {
  for (const key of ["pages", "planSelect", "groupSelect", "editor"]) {
    target[key] = Boolean(target[key] || source[key]);
  }
  if (source.preferredGroupId) {
    target.preferredGroupId = source.preferredGroupId;
  }
  return target;
}

function requestFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === "function") {
    scheduledWithTimeout = false;
    return globalThis.requestAnimationFrame(callback);
  }
  scheduledWithTimeout = true;
  return globalThis.setTimeout(callback, 0);
}

function cancelFrame(handle) {
  if (scheduledWithTimeout) {
    globalThis.clearTimeout(handle);
  } else if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(handle);
  }
}

export function requestRender(scope = ALL_RENDER_SCOPES) {
  mergeRenderScope(pendingRender, normalizeScope(scope));
  if (scheduledFrame !== null) {
    return;
  }
  scheduledFrame = requestFrame(() => {
    scheduledFrame = null;
    const nextScope = pendingRender;
    pendingRender = {};
    performRender(nextScope);
  });
}

export function flushRender() {
  if (scheduledFrame === null) {
    return false;
  }
  cancelFrame(scheduledFrame);
  scheduledFrame = null;
  const nextScope = pendingRender;
  pendingRender = {};
  performRender(nextScope);
  return true;
}

export function disposeRenderScheduler() {
  if (scheduledFrame !== null) {
    cancelFrame(scheduledFrame);
  }
  scheduledFrame = null;
  pendingRender = {};
}

// Synchroner Kompatibilitätseinstieg für Initialrender und ältere Aufrufer.
export function render(scope = ALL_RENDER_SCOPES) {
  const nextScope = mergeRenderScope({}, normalizeScope(scope));
  if (scheduledFrame !== null) {
    cancelFrame(scheduledFrame);
    scheduledFrame = null;
    mergeRenderScope(nextScope, pendingRender);
    pendingRender = {};
  }
  performRender(nextScope);
}

function performRender(scope) {
  if (scope.editor) {
    updateEditorValues();
  }
  if (scope.planSelect) {
    renderPlanSelect();
  }
  if (scope.pages) {
    renderPages();
  }
  if (scope.groupSelect) {
    renderGroupSelect(scope.preferredGroupId);
  }
}

function captureInlineFocus() {
  const element = document.activeElement;
  if (element?.dataset?.focusKey) {
    return { focusKey: element.dataset.focusKey };
  }
  if (!element?.dataset?.inlineKey) {
    return null;
  }
  return {
    key: element.dataset.inlineKey,
    start: element.selectionStart,
    end: element.selectionEnd
  };
}

function restoreInlineFocus(snapshot, container) {
  if (!snapshot) {
    return;
  }
  if (snapshot.focusKey) {
    [...container.querySelectorAll("[data-focus-key]")]
      .find((item) => item.dataset.focusKey === snapshot.focusKey)?.focus({ preventScroll: true });
    return;
  }
  const element = [...container.querySelectorAll("[data-inline-key]")]
    .find((item) => item.dataset.inlineKey === snapshot.key);
  if (!element) {
    return;
  }
  element.focus({ preventScroll: true });
  if (typeof element.setSelectionRange === "function") {
    const max = element.value.length;
    element.setSelectionRange(
      Math.min(snapshot.start ?? max, max),
      Math.min(snapshot.end ?? max, max)
    );
  }
}

function applyAppearanceVariables(page, appearance) {
  const titleBoxPadding = appearance.titleBoxPadding;
  page.style.setProperty("--color-intensity", appearance.colorIntensity + "%");
  page.style.setProperty("--title-box-padding-y", titleBoxPadding + "px");
  page.style.setProperty(
    "--title-box-padding-y-mobile",
    Math.round(titleBoxPadding * APPEARANCE_LAYOUT_SCALES.titleBoxPaddingMobile) + "px"
  );
  page.style.setProperty(
    "--title-box-padding-y-compact",
    Math.round(titleBoxPadding * APPEARANCE_LAYOUT_SCALES.titleBoxPaddingCompactPrint) + "px"
  );
}

function renderPages() {
  const plan = getActivePlan();
  const appearance = plan.appearance;
  const container = document.getElementById("pages");
  const focusSnapshot = captureInlineFocus();
  const fragment = document.createDocumentFragment();
  const minRows = getMinRows();
  const pagination = paginateGroups(plan.groups, minRows);
  const totalPages = pagination.pages.length;
  const printDate = formatDate(new Date());
  const studentCounts = new Map(plan.groups.map((group) => [group.id, group.students.length]));
  const totalStudents = plan.groups.reduce((sum, group) => sum + group.students.length, 0);
  const summary = plan.groups.length + (plan.groups.length === 1 ? " Gruppe" : " Gruppen")
    + " · " + totalStudents + " Schüler:innen gesamt";

  pagination.pages.forEach((segmentsForPage, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const isFirstPage = pageIndex === 0;
    const page = document.createElement("article");
    page.className = [
      "page",
      pagination.layout.id === "2x3" ? "compact-page" : "regular-page",
      isFirstPage ? "first-page" : "continuation-page"
    ].join(" ");
    page.dataset.grid = pagination.layout.id;
    page.dataset.colorIntensity = String(appearance.colorIntensity);
    applyAppearanceVariables(page, appearance);
    page.setAttribute("aria-label", "Druckseite " + pageNumber + " von " + totalPages);
    page.innerHTML = [
      '<div class="page-content">',
      isFirstPage ? renderMainHeader(plan.meta) : renderContinuationHeader(plan.meta),
      '<div class="slots ' + pagination.layout.gridClass + (segmentsForPage.length ? "" : " has-empty-state") + '">',
      segmentsForPage.length
        ? renderSlotRows(segmentsForPage, studentCounts, minRows, appearance)
        : renderEmptyState(),
      "</div>",
      "</div>",
      '<footer class="page-footer">',
      '<span class="document-summary">' + summary + "</span> · ",
      totalPages > 1 ? "Seite " + pageNumber + " von " + totalPages + " · " : "",
      "Stand: " + printDate,
      "</footer>"
    ].join("");
    const frame = document.createElement("div");
    frame.className = "page-frame";
    frame.appendChild(page);
    fragment.appendChild(frame);
  });

  container.replaceChildren(fragment);
  restoreInlineFocus(focusSnapshot, container);
}

function renderMainHeader(meta) {
  const hasTerm = Boolean(meta.term && meta.term.trim());
  return [
    '<header class="preview-header">',
    '<div class="header-inner">',
    '<h3 class="preview-document-title">' + escapeHtml(meta.title) + "</h3>",
    '<div class="guitar-bg" aria-hidden="true">🎸</div>',
    "</div>",
    "</header>",
    '<div class="info-grid ' + (hasTerm ? "has-term" : "") + '">',
    '<div class="info-box"><span class="info-label">Lehrkraft</span>',
    '<span class="info-value">' + escapeHtml(meta.teacher) + "</span></div>",
    '<div class="info-box"><span class="info-label">Ort</span>',
    '<span class="info-value">' + escapeHtml(meta.location) + "</span></div>",
    hasTerm
      ? '<div class="info-box"><span class="info-label">Schuljahr / Halbjahr</span><span class="info-value">' + escapeHtml(meta.term) + "</span></div>"
      : "",
    "</div>"
  ].join("");
}

function renderEmptyState() {
  return [
    '<section class="empty-state no-print" aria-labelledby="empty-state-title">',
    '<h3 id="empty-state-title">Noch keine Gruppen</h3>',
    '<p>Lege zuerst eine Unterrichtsgruppe an. Danach kannst du Schüler hinzufügen.</p>',
    '<button class="button btn-primary" type="button" data-action="focus-group-form">Erste Gruppe anlegen</button>',
    "</section>"
  ].join("");
}

function renderContinuationHeader(meta) {
  const hasTerm = Boolean(meta.term && meta.term.trim());
  return [
    '<div class="continuation-header">',
    '<div class="continuation-title"><strong>' + escapeHtml(meta.title) + "</strong>",
    hasTerm ? "<span>" + escapeHtml(meta.term) + "</span>" : "",
    "</div>",
    '<div class="continuation-meta">' + escapeHtml(meta.teacher) + "<br>" + escapeHtml(meta.location) + "</div>",
    "</div>"
  ].join("");
}

function weekdayKey(day) {
  const days = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];
  const key = (day || "").trim().toLocaleLowerCase("de");
  return days.includes(key) ? key : "neutral";
}

function headingDayKey(day) {
  return (day || "").trim().toLocaleLowerCase("de");
}

function renderDayHeading(segment, column, sharedDay) {
  const layoutClass = sharedDay
    ? " day-heading-shared"
    : " day-heading-column-" + (column + 1);
  return '<h4 class="day-heading' + layoutClass + '" data-weekday="' + weekdayKey(segment.day)
    + '">' + escapeHtml(segment.day || "Ohne Wochentag") + "</h4>";
}

// Preserve group order. The next row continues a day only when its first
// group matches the last group in the preceding visual row.
function renderSlotRows(segments, studentCounts, minRows, appearance) {
  const rows = [];
  let previousRowLastDay = null;

  for (let index = 0; index < segments.length; index += 2) {
    const pair = segments.slice(index, index + 2);
    const dayKeys = pair.map((segment) => headingDayKey(segment.day));
    const sharedDay = pair.length === 2
      && Boolean(dayKeys[0])
      && dayKeys[0] === dayKeys[1];
    const firstDayContinuesPreviousRow = index > 0
      && dayKeys[0] === previousRowLastDay;
    const headings = sharedDay
      ? (firstDayContinuesPreviousRow ? [] : [renderDayHeading(pair[0], 0, true)])
      : pair.map((segment, column) => (
        column === 0 && firstDayContinuesPreviousRow
          ? ""
          : renderDayHeading(segment, column, false)
      )).filter(Boolean);
    const headingMarkup = headings.length
      ? '<div class="day-heading-group print-only' + (sharedDay ? " shared-day" : "") + '">'
        + headings.join("") + "</div>"
      : "";

    const rowClass = "slot-row" + (headings.length ? "" : " no-day-heading");
    rows.push(
      '<div class="' + rowClass + '">',
      headingMarkup,
      ...pair.map((segment) => renderGroup(
        segment,
        studentCounts.get(segment.groupId),
        minRows,
        appearance
      )),
      "</div>"
    );
    previousRowLastDay = dayKeys[dayKeys.length - 1];
  }
  return rows.join("");
}

function renderGroup(segment, studentCount, minRows, appearance) {

  const groupId = escapeHtml(segment.groupId);
  const dayText = segment.day || "Wochentag";
  const dayClass = segment.day ? "day-badge" : "day-badge empty-day";
  const studentRows = segment.students.map((student, index) => (
    renderStudentRow(student, groupId, segment.studentOffset + index)
  ));
  const emptyRows = Array.from({ length: segment.emptyRows }, renderEmptyRow);
  const dayKey = escapeHtml("group:" + segment.groupId + ":day");
  const timeKey = escapeHtml("group:" + segment.groupId + ":time");
  const groupLabel = segment.day ? segment.day + " · " + segment.time : segment.time;
  const accessibleLabel = groupLabel + (segment.continuation ? " · Fortsetzung" : "");
  const editableHeader = segment.continuation
    ? [
      '<span class="' + dayClass + ' no-print">' + escapeHtml(dayText) + "</span>",
      '<span class="time-text no-print">' + escapeHtml(segment.time) + "</span>"
    ].join("")
    : [
      '<input type="text" class="' + dayClass + ' editable inline-editor no-print" value="' + escapeHtml(segment.day) + '" placeholder="Wochentag" maxlength="' + DATA_LIMITS.metadataLength + '" data-inline-key="' + dayKey + '" data-inline-type="group" data-field="day" data-group-id="' + groupId + '" aria-label="Wochentag dieser Gruppe bearbeiten">',
      '<input type="text" class="time-text editable inline-editor no-print" value="' + escapeHtml(segment.time) + '" maxlength="' + DATA_LIMITS.metadataLength + '" data-inline-key="' + timeKey + '" data-inline-type="group" data-field="time" data-group-id="' + groupId + '" aria-label="Zeit oder Gruppenname bearbeiten">'
    ].join("");
  const continuationMarker = segment.continuation
    ? '<span class="continuation-marker">Fortsetzung</span>'
    : "";
  const occupancy = appearance.showOccupancy
    ? '<span class="group-occupancy" title="Belegung / mindestens vorgesehene Zeilen">'
      + studentCount + " / " + Math.max(studentCount, minRows) + " Plätze</span>"
    : "";

  return [
    '<section class="timeslot" data-weekday="' + weekdayKey(segment.day) + '" data-group-id="' + groupId + '" data-segment-part="' + segment.part + '" aria-label="Gruppe ' + escapeHtml(accessibleLabel) + '">',
    '<div class="timeslot-header">',
    '<div class="group-header-left">',
    '<span class="time-text print-only">' + escapeHtml(segment.time) + "</span>",
    editableHeader,
    continuationMarker,
    occupancy,
    "</div>",
    segment.continuation ? "" : renderActionMenu([
    '<button class="button icon-button" aria-label="Gruppe nach oben verschieben" title="Gruppe nach oben" data-action="group-up" data-group-id="' + groupId + '"><span aria-hidden="true">↑</span><span>Nach oben</span></button>',
    '<button class="button icon-button" aria-label="Gruppe nach unten verschieben" title="Gruppe nach unten" data-action="group-down" data-group-id="' + groupId + '"><span aria-hidden="true">↓</span><span>Nach unten</span></button>',
    '<button class="button icon-button" aria-label="Schüler alphabetisch sortieren" title="Alphabetisch sortieren" data-action="sort-group" data-group-id="' + groupId + '"><span aria-hidden="true">A–Z</span><span>Alphabetisch sortieren</span></button>',
    '<button class="button remove-group-button" aria-label="Gruppe entfernen" title="Gruppe entfernen" data-action="remove-group" data-group-id="' + groupId + '"><span aria-hidden="true">✕</span><span>Entfernen</span></button>',
    ].join(""), "Gruppenaktionen", "group-actions:" + segment.groupId, "slot-actions"),
    "</div>",
    '<table class="student-table">',
    '<caption class="visually-hidden">Schüler in Gruppe ' + escapeHtml(accessibleLabel) + "</caption>",
    '<thead class="visually-hidden"><tr><th scope="col">Name</th><th scope="col">Klasse</th><th scope="col">Aktionen</th></tr></thead>',
    "<tbody>",
    studentRows.join(""),
    emptyRows.join(""),
    "</tbody></table></section>"
  ].join("");
}

function renderActionMenu(content, label, focusKey, className) {
  return '<details class="action-menu no-print"><summary class="button actions-toggle" data-focus-key="'
    + escapeHtml(focusKey) + '" aria-label="' + escapeHtml(label) + ' öffnen" title="'
    + escapeHtml(label) + '"><span aria-hidden="true">⋮</span></summary>'
    + '<div class="action-menu-items ' + className + '" role="group" aria-label="'
    + escapeHtml(label) + '">' + content + '</div></details>';
}

function renderStudentRow(student, groupId, index) {
  const studentId = escapeHtml(student.id);
  const labelName = escapeHtml(student.name);
  const nameKey = escapeHtml("student:" + student.id + ":name");
  const classKey = escapeHtml("student:" + student.id + ":className");

  return [
    "<tr>",
    '<td class="student-name"><span class="print-only">' + labelName + "</span>",
    '<input type="text" class="student-name-input editable inline-editor no-print" value="' + labelName + '" maxlength="' + DATA_LIMITS.personNameLength + '" data-inline-key="' + nameKey + '" data-inline-type="student" data-field="name" data-group-id="' + groupId + '" data-student-id="' + studentId + '" aria-label="Name von Schüler ' + (index + 1) + ' bearbeiten"></td>',
    '<td class="student-class"><span class="class-badge print-only">' + escapeHtml(student.className) + "</span>",
    '<input type="text" class="class-badge editable inline-editor no-print" value="' + escapeHtml(student.className) + '" maxlength="' + DATA_LIMITS.metadataLength + '" data-inline-key="' + classKey + '" data-inline-type="student" data-field="className" data-group-id="' + groupId + '" data-student-id="' + studentId + '" aria-label="Klasse von Schüler ' + (index + 1) + ' bearbeiten"></td>',
    '<td class="student-actions no-print">',
    renderActionMenu([
    '<button class="button icon-button" aria-label="' + labelName + ' nach oben" title="Nach oben" data-action="student-up" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">↑</span><span>Nach oben</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' nach unten" title="Nach unten" data-action="student-down" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">↓</span><span>Nach unten</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' in andere Gruppe verschieben" title="In andere Gruppe verschieben" data-action="move-student" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">⇄</span><span>Gruppe wechseln</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' entfernen" title="Entfernen" data-action="remove-student" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">✕</span><span>Entfernen</span></button>',
    ].join(""), "Aktionen für " + student.name, "student-actions:" + student.id, "student-action-list"),
    "</td></tr>"
  ].join("");
}

function renderEmptyRow() {
  return '<tr class="empty-row" aria-hidden="true"><td></td><td></td><td class="student-actions no-print"></td></tr>';
}

function optionsSignature(items) {
  return JSON.stringify(items.map((item) => [item.value, item.label]));
}

function replaceSelectOptions(select, items) {
  const signature = optionsSignature(items);
  if (select.dataset.optionsSignature === signature) {
    return false;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    fragment.appendChild(option);
  });
  select.replaceChildren(fragment);
  select.dataset.optionsSignature = signature;
  return true;
}

export function renderPlanSelect() {
  const select = document.getElementById("planSelect");
  replaceSelectOptions(select, getPlans().map((plan) => ({
    value: plan.id,
    label: plan.name
  })));
  select.value = getActivePlanId();
}

export function renderGroupSelect(preferredGroupId = document.getElementById("groupSelect")?.value) {
  const select = document.getElementById("groupSelect");
  const addStudentButton = document.getElementById("addStudentBtn");
  const studentForm = document.getElementById("studentForm");
  const studentFormHint = document.getElementById("studentFormHint");
  const plan = getActivePlan();
  const items = plan.groups.map((group) => ({
    value: group.id,
    label: group.day ? group.day + " · " + group.time : group.time
  }));

  replaceSelectOptions(select, items);
  const hasGroups = plan.groups.length > 0;
  select.value = plan.groups.some((group) => group.id === preferredGroupId)
    ? preferredGroupId
    : plan.groups[0]?.id || "";
  select.disabled = !hasGroups;
  addStudentButton.disabled = !hasGroups;
  if (studentForm) {
    studentForm.disabled = !hasGroups;
  }
  studentFormHint?.classList.toggle("hidden", hasGroups);
}

function updateAppearanceRangeControl(elementId, outputId, value, limits, suffix) {
  const input = document.getElementById(elementId);
  const output = document.getElementById(outputId);
  if (!input) {
    return;
  }

  input.min = String(limits.min);
  input.max = String(limits.max);
  input.step = String(limits.step);
  input.value = String(value);
  if (output) {
    output.textContent = value + suffix;
  }
}

export function updateEditorValues() {
  const plan = getActivePlan();
  const appearance = plan.appearance;
  document.getElementById("planName").value = plan.name;
  document.getElementById("metaTitle").value = plan.meta.title;
  document.getElementById("metaTeacher").value = plan.meta.teacher;
  document.getElementById("metaLocation").value = plan.meta.location;
  document.getElementById("metaTerm").value = plan.meta.term;
  document.getElementById("minRows").value = getMinRows();
  updateAppearanceRangeControl(
    "colorIntensity",
    "colorIntensityValue",
    appearance.colorIntensity,
    APPEARANCE_LIMITS.colorIntensity,
    " %"
  );
  updateAppearanceRangeControl(
    "titleBoxPadding",
    "titleBoxPaddingValue",
    appearance.titleBoxPadding,
    APPEARANCE_LIMITS.titleBoxPadding,
    " px"
  );
  const occupancyToggle = document.getElementById("showOccupancy");
  if (occupancyToggle) {
    occupancyToggle.checked = appearance.showOccupancy;
  }
}
