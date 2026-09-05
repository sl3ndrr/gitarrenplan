import { DATA_LIMITS } from "./config.js";
import { getActivePlan, getActivePlanId, getMinRows, getPlans } from "./state.js";
import { escapeHtml, formatDate } from "./utils.js";

const FIRST_PAGE_MAX = 4;
const FOLLOW_PAGE_MAX = 6;
const COMPACT_PAGE_MAX_ROW_SUM = 30;
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

function renderPages() {
  const plan = getActivePlan();
  const container = document.getElementById("pages");
  const focusSnapshot = captureInlineFocus();
  const fragment = document.createDocumentFragment();
  const minRows = getMinRows();
  const pageGroups = getPageGroups(plan.groups, minRows);
  const totalPages = pageGroups.length;
  const printDate = formatDate(new Date());

  pageGroups.forEach((groupsForPage, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const isFirstPage = pageIndex === 0;
    const isCompactFirstPage = isFirstPage && groupsForPage.length > FIRST_PAGE_MAX;
    const page = document.createElement("article");
    page.className = isFirstPage
      ? "page" + (isCompactFirstPage ? " compact-first-page" : "")
      : "page continuation-page";
    page.setAttribute("aria-label", "Druckseite " + pageNumber + " von " + totalPages);
    page.innerHTML = [
      '<div class="page-content">',
      isFirstPage ? renderMainHeader(plan.meta) : renderContinuationHeader(plan.meta),
      '<div class="slots' + (groupsForPage.length ? "" : " has-empty-state") + '">',
      groupsForPage.length ? groupsForPage.map(renderGroup).join("") : renderEmptyState(),
      "</div>",
      "</div>",
      '<footer class="page-footer">',
      totalPages > 1 ? "Seite " + pageNumber + " von " + totalPages + " · " : "",
      "Stand: " + printDate,
      "</footer>"
    ].join("");
    fragment.appendChild(page);
  });

  container.replaceChildren(fragment);
  restoreInlineFocus(focusSnapshot, container);
}

function getPageGroups(groups, minRows) {
  if (groups.length === 0) {
    return [[]];
  }
  if (canUseCompactFirstPage(groups, minRows)) {
    return [groups];
  }
  const result = [groups.slice(0, FIRST_PAGE_MAX)];
  for (let index = FIRST_PAGE_MAX; index < groups.length; index += FOLLOW_PAGE_MAX) {
    result.push(groups.slice(index, index + FOLLOW_PAGE_MAX));
  }
  return result;
}

function canUseCompactFirstPage(groups, minRows) {
  if (groups.length < 5 || groups.length > 6) {
    return false;
  }
  const gridRows = [groups.slice(0, 2), groups.slice(2, 4), groups.slice(4, 6)];
  const rowSum = gridRows.reduce((sum, gridRow) => {
    const largestGroup = Math.max(
      ...gridRow.map((group) => Math.max(minRows, group.students.length))
    );
    return sum + largestGroup;
  }, 0);
  return rowSum <= COMPACT_PAGE_MAX_ROW_SUM;
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

function renderGroup(group) {
  const groupId = escapeHtml(group.id);
  const dayText = group.day || "Wochentag";
  const dayClass = group.day ? "day-badge" : "day-badge empty-day";
  const emptyCount = Math.max(0, getMinRows() - group.students.length);
  const studentRows = group.students.map((student, index) => (
    renderStudentRow(student, groupId, index)
  ));
  const emptyRows = Array.from({ length: emptyCount }, renderEmptyRow);
  const dayKey = escapeHtml("group:" + group.id + ":day");
  const timeKey = escapeHtml("group:" + group.id + ":time");
  const groupLabel = group.day ? group.day + " · " + group.time : group.time;

  return [
    '<section class="timeslot" aria-label="Gruppe ' + escapeHtml(groupLabel) + '">',
    '<div class="timeslot-header">',
    '<div class="group-header-left">',
    '<span class="' + dayClass + ' print-only">' + escapeHtml(dayText) + "</span>",
    '<input type="text" class="' + dayClass + ' editable inline-editor no-print" value="' + escapeHtml(group.day) + '" placeholder="Wochentag" maxlength="' + DATA_LIMITS.metadataLength + '" data-inline-key="' + dayKey + '" data-inline-type="group" data-field="day" data-group-id="' + groupId + '" aria-label="Wochentag dieser Gruppe bearbeiten">',
    '<span class="time-text print-only">' + escapeHtml(group.time) + "</span>",
    '<input type="text" class="time-text editable inline-editor no-print" value="' + escapeHtml(group.time) + '" maxlength="' + DATA_LIMITS.metadataLength + '" data-inline-key="' + timeKey + '" data-inline-type="group" data-field="time" data-group-id="' + groupId + '" aria-label="Zeit oder Gruppenname bearbeiten">',
    "</div>",
    '<div class="slot-actions no-print">',
    '<button class="button icon-button" aria-label="Gruppe nach oben verschieben" title="Gruppe nach oben" data-action="group-up" data-group-id="' + groupId + '"><span aria-hidden="true">↑</span></button>',
    '<button class="button icon-button" aria-label="Gruppe nach unten verschieben" title="Gruppe nach unten" data-action="group-down" data-group-id="' + groupId + '"><span aria-hidden="true">↓</span></button>',
    '<button class="button icon-button" aria-label="Schüler alphabetisch sortieren" title="Alphabetisch sortieren" data-action="sort-group" data-group-id="' + groupId + '"><span aria-hidden="true">A–Z</span></button>',
    '<button class="button remove-group-button" aria-label="Gruppe entfernen" title="Gruppe entfernen" data-action="remove-group" data-group-id="' + groupId + '"><span aria-hidden="true">✕</span><span>Entfernen</span></button>',
    "</div></div>",
    '<table class="student-table">',
    '<caption class="visually-hidden">Schüler in Gruppe ' + escapeHtml(groupLabel) + "</caption>",
    '<thead class="visually-hidden"><tr><th scope="col">Name</th><th scope="col">Klasse</th><th scope="col">Aktionen</th></tr></thead>',
    "<tbody>",
    studentRows.join(""),
    emptyRows.join(""),
    "</tbody></table></section>"
  ].join("");
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
    '<button class="button icon-button" aria-label="' + labelName + ' nach oben" title="Nach oben" data-action="student-up" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">↑</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' nach unten" title="Nach unten" data-action="student-down" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">↓</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' in andere Gruppe verschieben" title="In andere Gruppe verschieben" data-action="move-student" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">⇄</span></button>',
    '<button class="button icon-button" aria-label="' + labelName + ' entfernen" title="Entfernen" data-action="remove-student" data-group-id="' + groupId + '" data-student-id="' + studentId + '"><span aria-hidden="true">✕</span></button>',
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

export function updateEditorValues() {
  const plan = getActivePlan();
  document.getElementById("planName").value = plan.name;
  document.getElementById("metaTitle").value = plan.meta.title;
  document.getElementById("metaTeacher").value = plan.meta.teacher;
  document.getElementById("metaLocation").value = plan.meta.location;
  document.getElementById("metaTerm").value = plan.meta.term;
  document.getElementById("minRows").value = getMinRows();
}
