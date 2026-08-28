import { getActivePlan, getActivePlanId, getMinRows, getPlans } from "./state.js";
import { escapeHtml, formatDate } from "./utils.js";

const FIRST_PAGE_MAX = 4;
const FOLLOW_PAGE_MAX = 6;

export function render() {
  const plan = getActivePlan();
  const container = document.getElementById("pages");

  container.innerHTML = "";

  const pageGroups = getPageGroups(plan.groups);
  const totalPages = pageGroups.length;
  const printDate = formatDate(new Date());

  pageGroups.forEach((groupsForPage, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const isFirstPage = pageIndex === 0;
    const page = document.createElement("article");

    page.className = isFirstPage ? "page" : "page continuation-page";
    page.innerHTML = [
      '<div class="page-content">',
      isFirstPage ? renderMainHeader(plan.meta) : renderContinuationHeader(plan.meta),
      '<div class="slots">',
      groupsForPage.map(renderGroup).join(""),
      "</div>",
      "</div>",
      '<footer class="page-footer">',
      totalPages > 1 ? "Seite " + pageNumber + " von " + totalPages + " · " : "",
      "Stand: " + printDate,
      "</footer>"
    ].join("");

    container.appendChild(page);
  });

  renderGroupSelect();
}

function getPageGroups(groups) {
  if (groups.length === 0) {
    return [[]];
  }

  const result = [groups.slice(0, FIRST_PAGE_MAX)];

  for (let index = FIRST_PAGE_MAX; index < groups.length; index += FOLLOW_PAGE_MAX) {
    result.push(groups.slice(index, index + FOLLOW_PAGE_MAX));
  }

  return result;
}

function renderMainHeader(meta) {
  const hasTerm = Boolean(meta.term && meta.term.trim());

  return [
    "<header>",
    '<div class="header-inner">',
    "<h1>" + escapeHtml(meta.title) + "</h1>",
    '<div class="guitar-bg" aria-hidden="true">🎸</div>',
    "</div>",
    "</header>",
    '<div class="info-grid ' + (hasTerm ? "has-term" : "") + '">',
    '<div class="info-box">',
    '<span class="info-label">Lehrkraft</span>',
    '<span class="info-value">' + escapeHtml(meta.teacher) + "</span>",
    "</div>",
    '<div class="info-box">',
    '<span class="info-label">Ort</span>',
    '<span class="info-value">' + escapeHtml(meta.location) + "</span>",
    "</div>",
    hasTerm
      ? '<div class="info-box"><span class="info-label">Schuljahr / Halbjahr</span><span class="info-value">' + escapeHtml(meta.term) + "</span></div>"
      : "",
    "</div>"
  ].join("");
}

function renderContinuationHeader(meta) {
  const hasTerm = Boolean(meta.term && meta.term.trim());

  return [
    '<div class="continuation-header">',
    '<div class="continuation-title">',
    "<strong>" + escapeHtml(meta.title) + "</strong>",
    hasTerm ? "<span>" + escapeHtml(meta.term) + "</span>" : "",
    "</div>",
    '<div class="continuation-meta">',
    escapeHtml(meta.teacher) + "<br>" + escapeHtml(meta.location),
    "</div>",
    "</div>"
  ].join("");
}

function renderGroup(group) {
  const groupId = escapeHtml(group.id);
  const dayText = group.day || "Wochentag";
  const dayClass = group.day ? "day-badge editable" : "day-badge editable empty-day";
  const emptyCount = Math.max(0, getMinRows() - group.students.length);
  const studentRows = group.students.map((student, index) => renderStudentRow(student, groupId, index));
  const emptyRows = Array.from({ length: emptyCount }, renderEmptyRow);

  return [
    '<section class="timeslot">',
    '<div class="timeslot-header">',
    '<div class="group-header-left">',
    '<span class="' + dayClass + '" contenteditable="true" tabindex="0" spellcheck="false" data-edit="group-day" data-group-id="' + groupId + '" aria-label="Wochentag dieser Gruppe – klicken zum Bearbeiten" title="Wochentag bearbeiten">',
    escapeHtml(dayText),
    "</span>",
    '<span class="time-text editable" contenteditable="true" tabindex="0" spellcheck="false" data-edit="group-time" data-group-id="' + groupId + '" aria-label="Uhrzeit dieser Gruppe – klicken zum Bearbeiten" title="Zeit oder Gruppenname bearbeiten">',
    escapeHtml(group.time),
    "</span>",
    "</div>",
    '<span class="slot-actions no-print" role="group" aria-label="Aktionen für diese Gruppe">',
    '<button aria-label="Gruppe nach oben verschieben" title="Gruppe nach oben" data-action="group-up" data-group-id="' + groupId + '">↑</button>',
    '<button aria-label="Gruppe nach unten verschieben" title="Gruppe nach unten" data-action="group-down" data-group-id="' + groupId + '">↓</button>',
    '<button aria-label="Schüler alphabetisch sortieren" title="Alphabetisch sortieren" data-action="sort-group" data-group-id="' + groupId + '">A–Z</button>',
    '<button aria-label="Gruppe entfernen" title="Gruppe entfernen" data-action="remove-group" data-group-id="' + groupId + '">✕ Entfernen</button>',
    "</span>",
    "</div>",
    "<table><tbody>",
    studentRows.join(""),
    emptyRows.join(""),
    "</tbody></table>",
    "</section>"
  ].join("");
}

function renderStudentRow(student, groupId, index) {
  const labelName = escapeHtml(student.name);
  const safeIndex = String(index);

  return [
    "<tr>",
    '<td class="student-name editable" contenteditable="true" tabindex="0" spellcheck="false" data-edit="student-name" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '" aria-label="Name von Schüler ' + (index + 1) + ' – klicken zum Bearbeiten" title="Klicken zum Bearbeiten">',
    labelName,
    "</td>",
    '<td class="student-class"><span class="class-badge editable" contenteditable="true" tabindex="0" spellcheck="false" data-edit="student-class" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '" aria-label="Klasse von Schüler ' + (index + 1) + ' – klicken zum Bearbeiten" title="Klicken zum Bearbeiten">',
    escapeHtml(student.className),
    "</span></td>",
    '<td class="student-actions no-print">',
    '<button aria-label="' + labelName + ' nach oben" title="Nach oben" data-action="student-up" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '">↑</button>',
    '<button aria-label="' + labelName + ' nach unten" title="Nach unten" data-action="student-down" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '">↓</button>',
    '<button aria-label="' + labelName + ' in andere Gruppe verschieben" title="In andere Gruppe verschieben" data-action="move-student" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '">⇄</button>',
    '<button aria-label="' + labelName + ' entfernen" title="Entfernen" data-action="remove-student" data-group-id="' + groupId + '" data-student-index="' + safeIndex + '">✕</button>',
    "</td>",
    "</tr>"
  ].join("");
}

function renderEmptyRow() {
  return '<tr class="empty-row"><td></td><td></td><td class="student-actions no-print"></td></tr>';
}

export function renderPlanSelect() {
  const select = document.getElementById("planSelect");

  select.innerHTML = "";
  getPlans().forEach((plan) => {
    const option = document.createElement("option");
    option.value = plan.id;
    option.textContent = plan.name;
    select.appendChild(option);
  });

  select.value = getActivePlanId();
}

export function renderGroupSelect() {
  const select = document.getElementById("groupSelect");
  const plan = getActivePlan();

  select.innerHTML = "";
  plan.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.day ? group.day + " · " + group.time : group.time;
    select.appendChild(option);
  });
}

export function updateEditorValues() {
  const plan = getActivePlan();

  document.getElementById("planName").value = plan.name;
  document.getElementById("metaTitle").value = plan.meta.title;
  document.getElementById("metaTeacher").value = plan.meta.teacher;
  document.getElementById("metaLocation").value = plan.meta.location;
  document.getElementById("metaTerm").value = plan.meta.term || "";
  document.getElementById("minRows").value = getMinRows();
  document.getElementById("newGroupDay").value = "Montag";

  renderPlanSelect();
}
