import { dispatch, getActivePlan } from "../state.js";
import { showModal } from "../ui/feedback.js";
import {
  beginTextEdit,
  cancelTextEdit,
  finishTextEdit,
  hasTextEditSession,
  queueTextEdit
} from "../ui/text-edit.js";
import { undo } from "./history.js";

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
  const result = dispatch({
    type: "group/add",
    payload: { day: dayInput.value, time: timeInput.value }
  });

  if (!result.ok) {
    timeInput.focus();
    return result;
  }
  dayInput.value = "Montag";
  timeInput.value = "";
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
  if (!isEditing) {
    event.preventDefault();
    undo();
  }
}

function sortGroup(group) {
  if (group.students.length < 2) {
    dispatch({ type: "group/sort", payload: { groupId: group.id } });
    return;
  }
  showModal({
    title: "Alphabetisch sortieren",
    message: "Schüler in der Gruppe „" + group.time + "“ alphabetisch nach Namen sortieren?",
    type: "confirm",
    confirmLabel: "Sortieren",
    onConfirm() {
      dispatch({ type: "group/sort", payload: { groupId: group.id } });
    }
  });
}

function removeGroup(group) {
  const label = group.day ? group.day + " · " + group.time : group.time;
  showModal({
    title: "Gruppe entfernen",
    message: "Gruppe „" + label + "“ wirklich entfernen? Alle Schüler dieser Gruppe werden ebenfalls gelöscht.",
    type: "confirm",
    confirmLabel: "Entfernen",
    confirmClass: "btn-danger",
    onConfirm() {
      dispatch({ type: "group/remove", payload: { groupId: group.id } });
    }
  });
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

function removeStudent(group, student) {
  showModal({
    title: "Schüler entfernen",
    message: "„" + student.name + "“ aus der Gruppe entfernen?",
    type: "confirm",
    confirmLabel: "Entfernen",
    confirmClass: "btn-danger",
    onConfirm() {
      dispatch({
        type: "student/remove",
        payload: { groupId: group.id, studentId: student.id }
      });
    }
  });
}

function handlePageClick(event) {
  const button = event.target.closest?.("button[data-action]");
  if (!button) {
    return;
  }

  const plan = getActivePlan();
  const group = plan.groups.find((item) => item.id === button.dataset.groupId);
  if (!group) {
    return;
  }

  const action = button.dataset.action;
  if (action === "group-up" || action === "group-down") {
    dispatch({
      type: "group/move",
      payload: { groupId: group.id, offset: action === "group-up" ? -1 : 1 }
    });
    return;
  }
  if (action === "sort-group") {
    sortGroup(group);
    return;
  }
  if (action === "remove-group") {
    removeGroup(group);
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
    removeStudent(group, student);
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
    target.addEventListener(type, listener);
    bindings.push(() => target.removeEventListener(type, listener));
  };

  const addGroupButton = document.getElementById("addGroupBtn");
  const addStudentButton = document.getElementById("addStudentBtn");
  const groupTime = document.getElementById("newGroupTime");
  const studentName = document.getElementById("studentName");
  const studentClass = document.getElementById("studentClass");
  const pages = document.getElementById("pages");

  listen(addGroupButton, "click", addGroup);
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
  listen(pages, "click", handlePageClick);
  listen(pages, "focusin", inlineFocusIn);
  listen(pages, "input", inlineInput);
  listen(pages, "change", inlineChange);
  listen(pages, "focusout", inlineFocusOut);
  listen(pages, "keydown", inlineKeyDown);

  return () => bindings.splice(0).reverse().forEach((cleanup) => cleanup());
}

