import {
  APPEARANCE_LAYOUT_SCALES,
  APPEARANCE_LIMITS,
  DATA_LIMITS,
  WEEKDAYS
} from "./config.js";
import { paginateAttendance, paginateWeek, renderAttendance, renderWeek } from "./print-formats.js";
import { paginateGroups } from "./pagination.js";
import { getActivePlan, getActivePlanId, getMinRows, getPlans } from "./state.js";
import { capturePageMotion, playPageMotion } from "./ui/motion.js";
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
let proofPresentation = false;
let printPresentation = false;

export function setPrintPresentation(mode, active) {
  const before = proofPresentation || printPresentation;
  if (mode === "proof") proofPresentation = active;
  else printPresentation = active;
  if (before !== (proofPresentation || printPresentation)) {
    const { layout } = getActivePlan();
    if (layout.output !== "groups" || layout.orientation !== "portrait") render({ pages: true });
  }
}

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
  if (source.motion) target.motion = source.motion;
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
    renderPages(scope.motion);
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
  if (snapshot.start !== null && typeof element.setSelectionRange === "function") {
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

function renderPages(motion) {
  const plan = getActivePlan();
  const appearance = plan.appearance;
  const container = document.getElementById("pages");
  const focusSnapshot = captureInlineFocus();
  const motionSnapshot = capturePageMotion(container, plan, motion);
  const drafts = new Map([...container.querySelectorAll("[data-add-key]")]
    .filter((input) => input.value).map((input) => [input.dataset.addKey, input.value]));
  const fragment = document.createDocumentFragment();
  const minRows = plan.layout.minRows;
  const showingOutput = proofPresentation || printPresentation;
  const output = showingOutput ? plan.layout.output : "groups";
  const orientation = showingOutput ? plan.layout.orientation : "portrait";
  const pagination = output === "week" ? paginateWeek(plan.groups, orientation)
    : output === "attendance" ? { pages: paginateAttendance(plan.groups, plan.layout) }
      : paginateGroups(plan.groups, minRows, { orientation, showNotes: plan.layout.showNotes });
  const totalPages = pagination.pages.length;
  const footerDate = plan.layout.showUpdatedAt && plan.updatedAt ? "Stand: " + formatDate(new Date(plan.updatedAt)) : "";
  const studentCounts = new Map(plan.groups.map((group) => [group.id, group.students.length]));
  const totalStudents = plan.groups.reduce((sum, group) => sum + group.students.length, 0);
  const summary = plan.groups.length + (plan.groups.length === 1 ? " Gruppe" : " Gruppen")
    + " · " + totalStudents + " Teilnehmende gesamt";

  pagination.pages.forEach((segmentsForPage, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const isFirstPage = pageIndex === 0;
    const page = document.createElement("article");
    page.className = [
      "page",
      pagination.layout?.id === "2x3" ? "compact-page" : "regular-page",
      isFirstPage ? "first-page" : "continuation-page",
      orientation === "landscape" ? "landscape-page" : "",
      output === "groups" ? "" : "alternative-page",
      plan.layout.showNotes ? "has-note-column" : "",
      plan.layout.monochrome ? "monochrome-page" : ""
    ].join(" ");
    page.dataset.grid = pagination.layout?.id ?? output;
    page.dataset.colorIntensity = String(appearance.colorIntensity);
    applyAppearanceVariables(page, appearance);
    page.setAttribute("aria-label", "Druckseite " + pageNumber + " von " + totalPages);
    const header = output === "groups"
      ? isFirstPage ? renderMainHeader(plan.meta) : renderContinuationHeader(plan.meta)
      : renderFormatHeader(plan.meta, output);
    let content;
    if (output === "week") {
      content = renderWeek(segmentsForPage, pagination.columns, minRows);
    } else if (output === "attendance") {
      content = renderAttendance(segmentsForPage, minRows);
    } else {
      content = '<div class="slots ' + pagination.layout.gridClass + (segmentsForPage.length ? "" : " has-empty-state") + '">'
        + (segmentsForPage.length ? renderSlotRows(segmentsForPage, studentCounts, minRows, appearance, plan.layout.showNotes)
          : renderEmptyState()) + "</div>";
    }
    const footer = [totalPages > 1 ? "Seite " + pageNumber + " von " + totalPages : "", footerDate].filter(Boolean);
    page.innerHTML = '<div class="page-content">' + header + content + '</div><footer class="page-footer">'
      + '<span class="document-summary">' + summary + "</span>"
      + (footer.length ? " · " + footer.join(" · ") : "") + "</footer>";
    const frame = document.createElement("div");
    frame.className = "page-frame";
    frame.appendChild(page);
    fragment.appendChild(frame);
  });

  container.replaceChildren(fragment);
  container.querySelectorAll("[data-add-key]").forEach((input) => {
    input.value = drafts.get(input.dataset.addKey) || "";
  });
  restoreInlineFocus(focusSnapshot, container);
  playPageMotion(container, motionSnapshot);
}

function renderFormatHeader(meta, output) {
  const heading = output === "week" ? "Wochenübersicht" : "Anwesenheitsliste";
  const information = [meta.teacher, meta.location, meta.term].filter(Boolean).map(escapeHtml).join(" · ");
  return '<header class="format-header"><div><h3>' + escapeHtml(meta.title) + "</h3><p>" + heading
    + "</p></div>" + (information ? "<p>" + information + "</p>" : "") + "</header>";
}

function renderMainHeader(meta) {
  const info = [["Lehrkraft", meta.teacher], ["Ort", meta.location], ["Schuljahr / Halbjahr", meta.term]]
    .filter(([, value]) => value);
  const boxes = info.map(([label, value]) =>
    '<div class="info-box"><span class="info-label">' + label + '</span><span class="info-value">'
      + escapeHtml(value) + "</span></div>"
  ).join("");
  return [
    '<header class="preview-header">',
    '<div class="header-inner">',
    '<h3 class="preview-document-title">' + escapeHtml(meta.title) + "</h3>",
    '<div class="guitar-bg" aria-hidden="true">🎸</div>',
    "</div></header>",
    boxes ? '<div class="info-grid" data-info-count="' + info.length + '">' + boxes + "</div>" : ""
  ].join("");
}

function renderEmptyState() {
  return [
    '<section class="empty-state no-print" aria-labelledby="empty-state-title">',
    '<h3 id="empty-state-title">Noch keine Gruppen</h3>',
    '<p>Lege zuerst eine Unterrichtsgruppe an. Danach kannst du Teilnehmende hinzufügen.</p>',
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
    meta.teacher || meta.location
      ? '<div class="continuation-meta">' + [meta.teacher, meta.location].filter(Boolean).map(escapeHtml).join("<br>") + "</div>"
      : "",
    "</div>"
  ].join("");
}

function weekdayKey(day) {
  const key = (day || "").trim().toLocaleLowerCase("de");
  return WEEKDAYS.some((weekday) => weekday.toLocaleLowerCase("de") === key) ? key : "neutral";
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
function renderSlotRows(segments, studentCounts, minRows, appearance, showNotes) {
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
      ? '<div class="day-heading-group' + (sharedDay ? " shared-day" : "") + '">'
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
        appearance,
        showNotes
      )),
      "</div>"
    );
    previousRowLastDay = dayKeys[dayKeys.length - 1];
  }
  return rows.join("");
}

function attributes(values) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ' ' + key + '="' + escapeHtml(value) + '"')
    .join("");
}

function editorInput({ kind, groupId, studentId, field, label, value, style, type = "text", placeholder, list, maxLength }) {
  const itemId = studentId ?? groupId;
  return '<input' + attributes({
    type,
    class: style + " editable inline-editor no-print",
    value,
    placeholder,
    list,
    maxlength: maxLength,
    "data-inline-key": kind + ":" + itemId + ":" + field,
    "data-inline-type": kind,
    "data-field": field,
    "data-group-id": groupId,
    "data-student-id": studentId,
    "aria-label": label
  }) + '>';
}

function actionButton({ action, groupId, studentId, label, visible, icon, style = "icon-button" }) {
  return '<button' + attributes({
    class: "button " + style,
    type: "button",
    "aria-label": label,
    title: label,
    "data-action": action,
    "data-group-id": groupId,
    "data-student-id": studentId
  }) + '>' + (icon ? '<span aria-hidden="true">' + icon + '</span>' : '')
    + '<span>' + escapeHtml(visible) + '</span></button>';
}

function renderGroup(segment, studentCount, minRows, appearance, showNotes) {
  const { groupId, day, time, label, continuation } = segment;
  const dayClass = day ? "day-badge" : "day-badge empty-day";
  const accessibleLabel = [day, time, continuation ? "Fortsetzung" : ""].filter(Boolean).join(" · ");
  const editableHeader = continuation
    ? '<span class="' + dayClass + ' no-print">' + escapeHtml(day || "Wochentag") + '</span>'
      + '<span class="time-text no-print">' + escapeHtml(time) + '</span>'
    : editorInput({
      kind: "group", groupId, field: "day", value: day, style: dayClass,
      label: "Wochentag dieser Gruppe bearbeiten", placeholder: "Wochentag",
      list: "weekdays", maxLength: DATA_LIMITS.metadataLength
    }) + renderGroupTimeEditors(segment);
  const actions = [
    { action: "group-up", label: "Gruppe nach oben verschieben", visible: "Nach oben", icon: "↑" },
    { action: "group-down", label: "Gruppe nach unten verschieben", visible: "Nach unten", icon: "↓" },
    { action: "sort-group", label: "Teilnehmende alphabetisch sortieren", visible: "Alphabetisch sortieren", icon: "A–Z" },
    { action: "sort-surname", visible: "Nach Nachname sortieren" },
    { action: "remove-group", label: "Gruppe entfernen", visible: "Entfernen", icon: "✕", style: "remove-group-button" }
  ];
  const studentRows = segment.students.map((student, index) =>
    renderStudentRow(student, groupId, segment.studentOffset + index, showNotes)
  );
  const isLast = segment.part === segment.totalParts;
  const emptyRows = Array.from({ length: segment.emptyRows }, (_, index) =>
    renderEmptyRow(isLast && index === 0 ? groupId : "", false, showNotes)
  );
  if (isLast && !emptyRows.length) emptyRows.push(renderEmptyRow(groupId, true, showNotes));
  const slotAttributes = attributes({
    class: "timeslot",
    "data-weekday": weekdayKey(day),
    "data-group-id": groupId,
    "data-motion-key": segment.key,
    "data-segment-part": segment.part,
    tabindex: -1,
    "aria-label": "Gruppe " + accessibleLabel
  });
  const occupancy = studentCount + " / " + Math.max(studentCount, minRows) + " Plätze";
  return [
    '<section' + slotAttributes + '>',
    '<div class="timeslot-header"><div class="group-header-left">',
    '<span class="time-text print-only">' + escapeHtml(time) + '</span>',
    segment.start && segment.end && label ? '<span class="print-only">' + escapeHtml(label) + '</span>' : "",
    editableHeader,
    continuation ? '<span class="continuation-marker">Fortsetzung</span>' : "",
    appearance.showOccupancy ? '<span class="group-occupancy">' + occupancy + '</span>' : "",
    '</div>',
    continuation ? "" : renderActionMenu(actions.map((action) =>
      actionButton({ ...action, groupId })).join(""), "Gruppenaktionen", "group-actions:" + groupId, "slot-actions"),
    '</div><table class="student-table">',
    '<caption class="visually-hidden">Teilnehmende in Gruppe ' + escapeHtml(accessibleLabel) + '</caption>',
    '<thead class="visually-hidden"><tr><th scope="col">Name</th><th scope="col">Klasse</th>',
    showNotes ? '<th scope="col" class="print-only">Notiz</th>' : "",
    '<th scope="col">Aktionen</th></tr></thead><tbody>',
    ...studentRows, ...emptyRows,
    '</tbody></table></section>'
  ].join("");
}

function renderActionMenu(content, label, focusKey, className) {
  const drag = className === "slot-actions" ? ' draggable="true" data-drag-kind="group"' : "";
  const summary = attributes({ "data-focus-key": focusKey, "aria-label": label + " öffnen", title: label });
  return '<details class="action-menu no-print"><summary class="button actions-toggle"' + drag + summary
    + '><span aria-hidden="true">⋮</span></summary>'
    + '<div class="action-menu-items ' + className + '" role="group" aria-label="'
    + escapeHtml(label) + '">' + content + '</div></details>';
}

function renderStudentRow(student, groupId, index, showNotes) {
  const { id: studentId, name, className } = student;
  const input = { kind: "student", groupId, studentId };
  const actions = [
    { action: "student-up", visible: "Nach oben", icon: "↑" },
    { action: "student-down", visible: "Nach unten", icon: "↓" },
    { action: "move-student", visible: "Gruppe wechseln", icon: "⇄" },
    { action: "remove-student", visible: "Entfernen", icon: "✕" }
  ];
  const menu = actions.map((action) => actionButton({
    ...action, groupId, studentId, label: action.visible + " · " + name
  })).join("");
  const row = attributes({
    draggable: "true", "data-drag-kind": "student",
    "data-motion-key": "student:" + studentId, "data-student-id": studentId
  });
  return [
    '<tr' + row + '><td class="student-name"><span class="print-only">' + escapeHtml(name) + '</span>',
    editorInput({
      ...input, field: "name", value: name, style: "student-name-input", placeholder: "Name",
      label: "Name von Person " + (index + 1) + " bearbeiten", maxLength: DATA_LIMITS.personNameLength
    }),
    '</td><td class="student-class">',
    className ? '<span class="class-badge print-only">' + escapeHtml(className) + '</span>' : "",
    editorInput({
      ...input, field: "className", value: className, style: "class-badge", placeholder: "Klasse",
      label: "Klasse von Person " + (index + 1) + " bearbeiten", maxLength: DATA_LIMITS.metadataLength
    }),
    '</td>', noteCell(showNotes),
    '<td class="student-actions no-print">',
    renderActionMenu(menu, "Aktionen für " + name, "student-actions:" + studentId, "student-action-list"),
    '</td></tr>'
  ].join("");
}

function renderGroupTimeEditors(segment) {
  const fields = [
    ["start", "time", "Beginn", segment.start],
    ["end", "time", "Ende", segment.end],
    [segment.start || segment.end ? "label" : "time", "text", "Bezeichnung", segment.label]
  ];
  const inputs = fields.map(([field, type, label, value]) => editorInput({
    kind: "group", groupId: segment.groupId, field, type, label,
    value: value || "", style: "time-text", placeholder: type === "text" ? label : undefined,
    maxLength: type === "text" ? DATA_LIMITS.metadataLength : undefined
  }));
  return '<div class="time-pair no-print">' + inputs.slice(0, 2).join("") + "</div>" + inputs[2];
}

function noteCell(showNotes) {
  return showNotes ? '<td class="student-note print-only"></td>' : "";
}

function renderEmptyRow(groupId, onlyScreen = false, showNotes = false) {
  if (!groupId) {
    return '<tr class="empty-row" aria-hidden="true"><td></td><td></td>' + noteCell(showNotes) + '<td class="student-actions no-print"></td></tr>';
  }
  const id = escapeHtml(groupId);
  const field = (key, label, maxLength) => '<input class="inline-editor no-print" type="text" maxlength="'
    + maxLength + '" placeholder="' + label + '" aria-label="' + label
    + '" data-add-key="' + id + ':' + key + '" data-add-group="' + id + '" data-add-field="' + key + '">';
  return '<tr class="empty-row inline-add-row' + (onlyScreen ? ' no-print' : '') + '"><td class="student-name">'
    + field("name", "Name hinzufügen", DATA_LIMITS.personNameLength) + '</td><td class="student-class">'
    + field("className", "Klasse", DATA_LIMITS.metadataLength)
    + '</td>' + noteCell(showNotes) + '<td class="student-actions no-print"><button class="button btn-secondary" type="button" data-action="inline-add" aria-label="Teilnehmende hinzufügen">+</button></td></tr>';
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
  document.querySelectorAll("[data-layout-field]").forEach((element) => {
    const value = plan.layout[element.dataset.layoutField];
    if (element.type === "checkbox") element.checked = value;
    else element.value = value;
  });
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
