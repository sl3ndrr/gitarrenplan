import { getActivePlan, getPlans } from "../state.js";
import { savePlans } from "../storage.js";
import { render } from "../render.js";
import { createGroupId, moveItem } from "../utils.js";
import { showModal, showToast } from "../ui/feedback.js";
import { captureUndo, discardLatestUndo, undo } from "./history.js";

export function initialiseScheduleActions() {
  document.getElementById("addGroupBtn").addEventListener("click", addGroup);
  document.getElementById("addStudentBtn").addEventListener("click", addStudent);

  document.getElementById("newGroupTime").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addGroup();
    }
  });

  document.getElementById("studentName").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (document.getElementById("studentClass").value.trim()) {
      addStudent();
    } else {
      document.getElementById("studentClass").focus();
    }
  });

  document.getElementById("studentClass").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addStudent();
    }
  });

  document.addEventListener("keydown", handleUndoShortcut);

  const pages = document.getElementById("pages");
  pages.addEventListener("click", handlePageClick);
  pages.addEventListener("focusout", handleInlineEdit);
  pages.addEventListener("keydown", finishInlineEditOnEnter);
}

function addGroup() {
  const plan = getActivePlan();
  const dayInput = document.getElementById("newGroupDay");
  const timeInput = document.getElementById("newGroupTime");
  const day = dayInput.value.trim();
  const time = timeInput.value.trim();

  if (!time) {
    showModal({
      title: "Fehler",
      message: "Bitte eine Zeit oder einen Gruppennamen eingeben.",
      type: "alert"
    });
    timeInput.focus();
    return;
  }

  captureUndo();
  plan.groups.push({ id: createGroupId(), day, time, students: [] });
  dayInput.value = "Montag";
  timeInput.value = "";
  savePlans(getPlans());
  render();
  showToast("Gruppe hinzugefügt ✓");
  timeInput.focus();
}

function addStudent() {
  const plan = getActivePlan();
  const groupId = document.getElementById("groupSelect").value;
  const nameInput = document.getElementById("studentName");
  const classInput = document.getElementById("studentClass");
  const name = nameInput.value.trim();
  const className = classInput.value.trim();

  if (!groupId) {
    showModal({
      title: "Fehler",
      message: "Bitte zuerst eine Gruppe anlegen oder auswählen.",
      type: "alert"
    });
    return;
  }

  if (!name) {
    showModal({
      title: "Fehler",
      message: "Bitte einen Namen eingeben.",
      type: "alert"
    });
    nameInput.focus();
    return;
  }

  const group = plan.groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }

  captureUndo();
  group.students.push({ name, className: className || "Klasse" });
  nameInput.value = "";
  classInput.value = "";
  savePlans(getPlans());
  render();
  showToast(name + " hinzugefügt ✓");
  nameInput.focus();
}

function handleUndoShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
    return;
  }

  const activeElement = document.activeElement;
  const isEditing = activeElement && (
    activeElement.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName)
  );

  if (!isEditing) {
    event.preventDefault();
    undo();
  }
}

function handlePageClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const plan = getActivePlan();
  const action = button.dataset.action;
  const groupId = button.dataset.groupId;
  const groupIndex = plan.groups.findIndex((group) => group.id === groupId);
  const group = plan.groups[groupIndex];

  if (!group) {
    return;
  }

  if (action === "group-up") {
    moveGroup(plan, groupIndex, groupIndex - 1);
    return;
  }

  if (action === "group-down") {
    moveGroup(plan, groupIndex, groupIndex + 1);
    return;
  }

  if (action === "sort-group") {
    sortGroup(group);
    return;
  }

  if (action === "remove-group") {
    removeGroup(plan, group, groupIndex);
    return;
  }

  const studentIndex = Number(button.dataset.studentIndex);

  if (action === "student-up") {
    moveStudent(group, studentIndex, studentIndex - 1);
    return;
  }

  if (action === "student-down") {
    moveStudent(group, studentIndex, studentIndex + 1);
    return;
  }

  if (action === "move-student") {
    moveStudentToAnotherGroup(plan, group, studentIndex);
    return;
  }

  if (action === "remove-student") {
    removeStudent(group, studentIndex);
  }
}

function moveGroup(plan, from, to) {
  captureUndo();

  if (moveItem(plan.groups, from, to)) {
    savePlans(getPlans());
    render();
    showToast("Gruppe verschoben ✓");
  } else {
    discardLatestUndo();
  }
}

function sortGroup(group) {
  if (group.students.length < 2) {
    showToast("Nichts zu sortieren.", "error");
    return;
  }

  showModal({
    title: "Alphabetisch sortieren",
    message: "Schüler in der Gruppe „" + group.time + "“ alphabetisch nach Namen sortieren?",
    type: "confirm",
    confirmLabel: "Sortieren",
    onConfirm() {
      captureUndo();
      group.students.sort((first, second) => first.name.localeCompare(second.name, "de"));
      savePlans(getPlans());
      render();
      showToast("Alphabetisch sortiert ✓");
    }
  });
}

function removeGroup(plan, group, groupIndex) {
  const label = group.day ? group.day + " · " + group.time : group.time;

  showModal({
    title: "Gruppe entfernen",
    message: "Gruppe „" + label + "“ wirklich entfernen? Alle Schüler dieser Gruppe werden ebenfalls gelöscht.",
    type: "confirm",
    confirmLabel: "Entfernen",
    confirmClass: "btn-danger",
    onConfirm() {
      captureUndo();
      plan.groups.splice(groupIndex, 1);
      savePlans(getPlans());
      render();
      showToast("Gruppe entfernt");
    }
  });
}

function moveStudent(group, from, to) {
  captureUndo();

  if (moveItem(group.students, from, to)) {
    savePlans(getPlans());
    render();
  } else {
    discardLatestUndo();
  }
}

function moveStudentToAnotherGroup(plan, group, studentIndex) {
  const student = group.students[studentIndex];
  if (!student) {
    return;
  }

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
    onConfirm(targetId) {
      const targetGroup = plan.groups.find((item) => item.id === targetId);
      if (!targetGroup) {
        return;
      }

      captureUndo();
      const [movedStudent] = group.students.splice(studentIndex, 1);
      targetGroup.students.push(movedStudent);
      savePlans(getPlans());
      render();
      showToast(movedStudent.name + " verschoben ✓");
    }
  });
}

function removeStudent(group, studentIndex) {
  const student = group.students[studentIndex];
  if (!student) {
    return;
  }

  showModal({
    title: "Schüler entfernen",
    message: "„" + student.name + "“ aus der Gruppe entfernen?",
    type: "confirm",
    confirmLabel: "Entfernen",
    confirmClass: "btn-danger",
    onConfirm() {
      captureUndo();
      group.students.splice(studentIndex, 1);
      savePlans(getPlans());
      render();
      showToast(student.name + " entfernt");
    }
  });
}

function handleInlineEdit(event) {
  const element = event.target;
  if (!element.dataset || !element.dataset.edit) {
    return;
  }

  const plan = getActivePlan();
  const editType = element.dataset.edit;
  const groupId = element.dataset.groupId;
  const studentIndex = Number(element.dataset.studentIndex);
  const newValue = element.innerText.trim();
  const group = plan.groups.find((item) => item.id === groupId);

  if (!group) {
    return;
  }

  let mutation = null;

  if (editType === "group-day") {
    const finalValue = newValue === "Wochentag" ? "" : newValue;
    if (group.day !== finalValue) {
      mutation = () => {
        group.day = finalValue;
      };
    }
  }

  if (editType === "group-time") {
    const finalValue = newValue || "Neue Gruppe";
    if (group.time !== finalValue) {
      mutation = () => {
        group.time = finalValue;
      };
    }
  }

  if (editType === "student-name" && group.students[studentIndex]) {
    const finalValue = newValue || "Name";
    if (group.students[studentIndex].name !== finalValue) {
      mutation = () => {
        group.students[studentIndex].name = finalValue;
      };
    }
  }

  if (editType === "student-class" && group.students[studentIndex]) {
    const finalValue = newValue || "Klasse";
    if (group.students[studentIndex].className !== finalValue) {
      mutation = () => {
        group.students[studentIndex].className = finalValue;
      };
    }
  }

  if (!mutation) {
    return;
  }

  captureUndo();
  mutation();
  savePlans(getPlans());
  render();
  showToast("Gespeichert ✓");
}

function finishInlineEditOnEnter(event) {
  const editable = event.target.closest("[contenteditable='true']");
  if (!editable || event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  editable.blur();
}
