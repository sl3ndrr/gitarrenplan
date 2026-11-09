import { WEEKDAYS } from "../config.js";
import { flushRender } from "../render.js";
import { openBulkEntry } from "./bulk-entry.js";
import { initialiseDragDrop } from "./drag-drop.js";
import { dispatch, getActivePlan } from "../state.js";
import { showModal } from "../ui/feedback.js";
import {
  beginTextEdit,
  cancelTextEdit,
  finishTextEdit,
  hasTextEditSession,
  queueTextEdit
} from "../ui/text-edit.js";
import { redo, undo } from "./history.js";

function inlineConfig(element) {
  const { inlineKey, inlineType, field, groupId, studentId } = element.dataset;
  if (inlineType === "group") {
    return {
      key: inlineKey,
      getValue: () => {
        const group = getActivePlan().groups.find((item) => item.id === groupId);
        return group?.[field] ?? "";
      },
      createCommand: (value) => ({
        type: "group/update",
        payload: { groupId, field, value }
      })
    };
  }

  return {
    key: inlineKey,
    getValue: () => {
      const group = getActivePlan().groups.find((item) => item.id === groupId);
      const student = group?.students.find((item) => item.id === studentId);
      return student?.[field] ?? "";
    },
    createCommand: (value) => ({
      type: "student/update",
      payload: { groupId, studentId, field, value }
    })
  };
}

export function addGroup() {
  const dayInput = document.getElementById("newGroupDay");
  const timeInput = document.getElementById("newGroupTime");
  const start = document.getElementById("newGroupStart");
  const end = document.getElementById("newGroupEnd");
  const result = dispatch({
    type: "group/add",
    payload: { day: dayInput.value, time: timeInput.value, start: start?.value, end: end?.value }
  });

  if (!result.ok) {
    timeInput.focus();
    return result;
  }
  timeInput.value = "";
  if (start) start.value = "";
  if (end) end.value = "";
  timeInput.focus();
  return result;
}

export function addStudent() {
  const groupId = document.getElementById("groupSelect").value;
  const nameInput = document.getElementById("studentName");
  const classInput = document.getElementById("studentClass");
  const result = dispatch({
    type: "student/add",
    payload: {
      groupId,
      student: { name: nameInput.value, className: classInput.value }
    }
  });

  if (!result.ok) {
    nameInput.focus();
    return result;
  }
  nameInput.value = "";
  classInput.value = "";
  nameInput.focus();
  return result;
}

function handleUndoShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
    return;
  }
  const activeElement = document.activeElement;
  const isEditing = activeElement && (
    activeElement.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName)
  );
  if (!isEditing && !document.getElementById("app-shell")?.hasAttribute("inert")) {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  }
}

function sortGroup(group, surname) {
  dispatch({ type: "group/sort", payload: { groupId: group.id, surname } });
}

function addInlineStudent(row) {
  if (!row) return;
  const name = row.querySelector('[data-add-field="name"]');
  const className = row.querySelector('[data-add-field="className"]');
  const result = dispatch({
    type: "student/add",
    payload: { groupId: name.dataset.addGroup, student: { name: name.value, className: className.value } }
  });
  if (result.ok) {
    name.value = "";
    className.value = "";
    const key = name.dataset.addKey;
    flushRender();
    [...document.querySelectorAll("[data-add-key]")]
      .find((field) => field.dataset.addKey === key)?.focus();
  } else {
    name.focus();
  }
}

function moveStudentToAnotherGroup(plan, group, student) {
  const otherGroups = plan.groups
    .filter((item) => item.id !== group.id)
    .map((item) => ({
      value: item.id,
      label: item.day ? item.day + " · " + item.time : item.time
    }));

  if (otherGroups.length === 0) {
    showModal({
      title: "Verschieben nicht möglich",
      message: "Es gibt keine andere Gruppe. Lege zuerst eine weitere Gruppe an.",
      type: "alert"
    });
    return;
  }

  showModal({
    title: "Schüler verschieben",
    message: "„" + student.name + "“ in welche Gruppe verschieben?",
    type: "select",
    options: otherGroups,
    confirmLabel: "Verschieben",
    onConfirm(targetGroupId) {
      dispatch({
        type: "student/moveToGroup",
        payload: {
          sourceGroupId: group.id,
          targetGroupId,
          studentId: student.id
        }
      });
    }
  });
}

function handlePageClick(event) {
  const button = event.target.closest?.("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "inline-add") {
    addInlineStudent(button.closest("tr"));
    return;
  }
  const menu = button.closest(".action-menu");
  if (menu) {
    menu.open = false;
    menu.querySelector("summary")?.focus({ preventScroll: true });
  }
  if (action === "focus-group-form") {
    document.getElementById("editViewBtn")?.click();
    const groupInput = document.getElementById("newGroupStart") || document.getElementById("newGroupTime");
    const section = groupInput?.closest("details");
    if (section) {
      section.open = true;
    }
    groupInput?.scrollIntoView?.({ block: "center" });
    groupInput?.focus({ preventScroll: true });
    return;
  }

  const plan = getActivePlan();
  const group = plan.groups.find((item) => item.id === button.dataset.groupId);
  if (!group) {
    return;
  }

  if (action === "group-up" || action === "group-down") {
    dispatch({
      type: "group/move",
      payload: { groupId: group.id, offset: action === "group-up" ? -1 : 1 }
    });
    return;
  }
  if (action === "sort-group" || action === "sort-surname") {
    sortGroup(group, action === "sort-surname");
    return;
  }
  if (action === "remove-group") {
    dispatch({ type: "group/remove", payload: { groupId: group.id } });
    return;
  }

  const student = group.students.find((item) => item.id === button.dataset.studentId);
  if (!student) {
    return;
  }
  if (action === "student-up" || action === "student-down") {
    dispatch({
      type: "student/move",
      payload: {
        groupId: group.id,
        studentId: student.id,
        offset: action === "student-up" ? -1 : 1
      }
    });
  } else if (action === "move-student") {
    moveStudentToAnotherGroup(plan, group, student);
  } else if (action === "remove-student") {
    dispatch({ type: "student/remove", payload: { groupId: group.id, studentId: student.id } });
  }
}

function closestInlineInput(event) {
  return event.target.closest?.("input[data-inline-key]") || null;
}

function inlineInput(event) {
  const element = closestInlineInput(event);
  if (element) {
    queueTextEdit(element, inlineConfig(element));
  }
}

function inlineFocusIn(event) {
  const element = closestInlineInput(event);
  if (element) {
    beginTextEdit(element, inlineConfig(element));
  }
}

function inlineChange(event) {
  const element = closestInlineInput(event);
  if (element) {
    finishTextEdit(element, inlineConfig(element));
  }
}

function inlineFocusOut(event) {
  const element = closestInlineInput(event);
  if (!element) {
    return;
  }
  const config = inlineConfig(element);
  if (hasTextEditSession(config.key)) {
    finishTextEdit(element, config);
  }
}

function inlineKeyDown(event) {
  if (event.key === "Enter" && !event.isComposing && event.target.dataset.addKey) {
    event.preventDefault();
    addInlineStudent(event.target.closest("tr"));
    return;
  }
  const element = closestInlineInput(event);
  if (!element) {
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    finishTextEdit(element, inlineConfig(element));
    element.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelTextEdit(element, inlineConfig(element));
    element.blur();
  }
}

export function initialiseScheduleActions() {
  const bindings = [];
  const listen = (target, type, listener) => {
    if (!target) return;
    target.addEventListener(type, listener);
    bindings.push(() => target.removeEventListener(type, listener));
  };

  const addGroupButton = document.getElementById("addGroupBtn");
  const addStudentButton = document.getElementById("addStudentBtn");
  const groupTime = document.getElementById("newGroupTime");
  const studentName = document.getElementById("studentName");
  const studentClass = document.getElementById("studentClass");
  const pages = document.getElementById("pages");

  const weekdayList = document.getElementById("weekdays");
  if (weekdayList) {
    const daySelect = document.getElementById("newGroupDay");
    WEEKDAYS.forEach((day) => {
      const option = document.createElement("option");
      option.value = day;
      option.textContent = day;
      weekdayList.append(option);
      daySelect.append(option.cloneNode(true));
    });
    daySelect.value = WEEKDAYS[0];
    bindings.push(() => {
      weekdayList.replaceChildren();
      daySelect.querySelectorAll('option:not([value=""])').forEach((option) => option.remove());
    });
  }

  listen(addGroupButton, "click", addGroup);
  listen(document.getElementById("bulkStudentsBtn"), "click", openBulkEntry);
  listen(document.getElementById("sortScheduleBtn"), "click", () => dispatch({ type: "groups/sortSchedule" }));
  bindings.push(initialiseDragDrop(pages));
  listen(addStudentButton, "click", addStudent);
  listen(groupTime, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addGroup();
    }
  });
  listen(studentName, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (studentClass.value.trim()) {
        addStudent();
      } else {
        studentClass.focus();
      }
    }
  });
  listen(studentClass, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addStudent();
    }
  });
  listen(document, "keydown", handleUndoShortcut);
  listen(document, "keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    const menu = event.target.closest?.(".action-menu[open]");
    if (menu) {
      menu.open = false;
      menu.querySelector("summary")?.focus({ preventScroll: true });
    }
  });
  listen(document, "click", (event) => {
    pages.querySelectorAll(".action-menu[open]").forEach((menu) => {
      if (!menu.contains(event.target)) {
        menu.open = false;
      }
    });
  });
  listen(pages, "click", handlePageClick);
  listen(pages, "focusin", inlineFocusIn);
  listen(pages, "input", inlineInput);
  listen(pages, "change", inlineChange);
  listen(pages, "focusout", inlineFocusOut);
  listen(pages, "keydown", inlineKeyDown);

  return () => bindings.splice(0).reverse().forEach((cleanup) => cleanup());
}
