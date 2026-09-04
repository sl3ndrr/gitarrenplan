import { getActivePlan } from "../state.js";
import { render } from "../render.js";
import { createGroupId, createStudentId, moveItem } from "../utils.js";
import { showModal, showSaveError, showToast } from "../ui/feedback.js";
import { commitWithUndo, undo } from "./history.js";

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

function commitScheduleChange(mutator, preferredGroupId, successMessage = "") {
  const result = commitWithUndo(mutator);

  if (!result.ok) {
    showSaveError(result.error);
    render(preferredGroupId);
    return false;
  }

  render(preferredGroupId);
  if (successMessage) {
    showToast(successMessage);
  }

  return true;
}

export function addGroup() {
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

  const groupId = createGroupId();
  const saved = commitScheduleChange((draft) => {
    const plan = draft.plans.find((item) => item.id === draft.activePlanId);
    plan.groups.push({ id: groupId, day, time, students: [] });
  }, groupId, "Gruppe hinzugefügt ✓");

  if (!saved) {
    return;
  }

  dayInput.value = "Montag";
  timeInput.value = "";
  timeInput.focus();
}

export function addStudent() {
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

  const studentId = createStudentId();
  const saved = commitScheduleChange((draft) => {
    const plan = draft.plans.find((item) => item.id === draft.activePlanId);
    const group = plan.groups.find((item) => item.id === groupId);

    if (!group) {
      throw new Error("Die ausgewählte Gruppe existiert nicht mehr.");
    }

    group.students.push({ id: studentId, name, className: className || "Klasse" });
  }, groupId, name + " hinzugefügt ✓");

  if (!saved) {
    return;
  }

  nameInput.value = "";
  classInput.value = "";
  nameInput.focus();
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
    moveGroup(groupIndex, groupIndex - 1, groupId);
    return;
  }

  if (action === "group-down") {
    moveGroup(groupIndex, groupIndex + 1, groupId);
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

  const studentId = button.dataset.studentId;
  const studentIndex = group.students.findIndex((student) => student.id === studentId);

  if (action === "student-up") {
    moveStudent(group, studentIndex, studentIndex - 1);
    return;
  }

  if (action === "student-down") {
    moveStudent(group, studentIndex, studentIndex + 1);
    return;
  }

  if (action === "move-student") {
    moveStudentToAnotherGroup(plan, group, studentId);
    return;
  }

  if (action === "remove-student") {
    removeStudent(group, studentId);
  }
}

function moveGroup(from, to, groupId) {
  const plan = getActivePlan();
  if (to < 0 || to >= plan.groups.length) {
    return;
  }

  commitScheduleChange((draft) => {
    const targetPlan = draft.plans.find((item) => item.id === draft.activePlanId);
    moveItem(targetPlan.groups, from, to);
  }, groupId, "Gruppe verschoben ✓");
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
      commitScheduleChange((draft) => {
        const plan = draft.plans.find((item) => item.id === draft.activePlanId);
        const target = plan.groups.find((item) => item.id === group.id);
        target.students.sort((first, second) => first.name.localeCompare(second.name, "de"));
      }, group.id, "Alphabetisch sortiert ✓");
    }
  });
}

function removeGroup(group) {
  const label = group.day ? group.day + " · " + group.time : group.time;
  const selectedGroupId = document.getElementById("groupSelect").value;

  showModal({
    title: "Gruppe entfernen",
    message: "Gruppe „" + label + "“ wirklich entfernen? Alle Schüler dieser Gruppe werden ebenfalls gelöscht.",
    type: "confirm",
    confirmLabel: "Entfernen",
    confirmClass: "btn-danger",
    onConfirm() {
      commitScheduleChange((draft) => {
        const plan = draft.plans.find((item) => item.id === draft.activePlanId);
        plan.groups = plan.groups.filter((item) => item.id !== group.id);
      }, selectedGroupId, "Gruppe entfernt");
    }
  });
}

function moveStudent(group, from, to) {
  if (from < 0 || to < 0 || to >= group.students.length) {
    return;
  }

  commitScheduleChange((draft) => {
    const plan = draft.plans.find((item) => item.id === draft.activePlanId);
    const target = plan.groups.find((item) => item.id === group.id);
    moveItem(target.students, from, to);
  }, group.id);
}

function moveStudentToAnotherGroup(plan, group, studentId) {
  const student = group.students.find((item) => item.id === studentId);
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
      commitScheduleChange((draft) => {
        const targetPlan = draft.plans.find((item) => item.id === draft.activePlanId);
        const sourceGroup = targetPlan.groups.find((item) => item.id === group.id);
        const targetGroup = targetPlan.groups.find((item) => item.id === targetId);
        const studentIndex = sourceGroup.students.findIndex((item) => item.id === studentId);

        if (!targetGroup || studentIndex < 0) {
          throw new Error("Der Schüler oder die Zielgruppe existiert nicht mehr.");
        }

        const [movedStudent] = sourceGroup.students.splice(studentIndex, 1);
        targetGroup.students.push(movedStudent);
      }, targetId, student.name + " verschoben ✓");
    }
  });
}

function removeStudent(group, studentId) {
  const student = group.students.find((item) => item.id === studentId);
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
      commitScheduleChange((draft) => {
        const plan = draft.plans.find((item) => item.id === draft.activePlanId);
        const target = plan.groups.find((item) => item.id === group.id);
        target.students = target.students.filter((item) => item.id !== studentId);
      }, group.id, student.name + " entfernt");
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
  const studentId = element.dataset.studentId;
  const newValue = String(element.innerText ?? element.textContent ?? "").trim();
  const group = plan.groups.find((item) => item.id === groupId);

  if (!group) {
    return;
  }

  let mutation = null;

  if (editType === "group-day") {
    const finalValue = newValue === "Wochentag" ? "" : newValue;
    if (group.day !== finalValue) {
      mutation = (draftGroup) => {
        draftGroup.day = finalValue;
      };
    }
  }

  if (editType === "group-time") {
    const finalValue = newValue || "Neue Gruppe";
    if (group.time !== finalValue) {
      mutation = (draftGroup) => {
        draftGroup.time = finalValue;
      };
    }
  }

  const student = group.students.find((item) => item.id === studentId);
  if (editType === "student-name" && student) {
    const finalValue = newValue || "Name";
    if (student.name !== finalValue) {
      mutation = (draftGroup) => {
        draftGroup.students.find((item) => item.id === studentId).name = finalValue;
      };
    }
  }

  if (editType === "student-class" && student) {
    const finalValue = newValue || "Klasse";
    if (student.className !== finalValue) {
      mutation = (draftGroup) => {
        draftGroup.students.find((item) => item.id === studentId).className = finalValue;
      };
    }
  }

  if (!mutation) {
    return;
  }

  commitScheduleChange((draft) => {
    const targetPlan = draft.plans.find((item) => item.id === draft.activePlanId);
    const draftGroup = targetPlan.groups.find((item) => item.id === groupId);
    mutation(draftGroup);
  }, groupId, "Gespeichert ✓");
}

function finishInlineEditOnEnter(event) {
  const editable = event.target.closest("[contenteditable='true']");
  if (!editable || event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  editable.blur();
}
