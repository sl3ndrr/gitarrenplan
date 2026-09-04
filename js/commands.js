import { DATA_LIMITS, DEFAULT_META } from "./config.js";
import { createDefaultPlan, normalizeSingleLineText } from "./normalization.js";
import {
  clone,
  createGroupId,
  createPlanId,
  createStudentId,
  moveItem
} from "./utils.js";

const RENDER_ALL = Object.freeze({
  pages: true,
  planSelect: true,
  groupSelect: true,
  editor: true
});
const RENDER_PAGES = Object.freeze({ pages: true });
const RENDER_PLAN_SELECT = Object.freeze({ planSelect: true });
const RENDER_GROUPS = Object.freeze({ pages: true, groupSelect: true });

export class CommandValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommandValidationError";
    this.code = "COMMAND_INVALID";
  }
}

function notice(message, type = "success") {
  return { message, type };
}

function activePlan(draft) {
  const plan = draft.plans.find((item) => item.id === draft.activePlanId);
  if (!plan) {
    throw new CommandValidationError("Der aktive Plan existiert nicht.");
  }
  return plan;
}

function findPlan(draft, planId) {
  const plan = draft.plans.find((item) => item.id === planId);
  if (!plan) {
    throw new CommandValidationError("Der ausgewählte Plan existiert nicht.");
  }
  return plan;
}

function findGroup(plan, groupId) {
  const group = plan.groups.find((item) => item.id === groupId);
  if (!group) {
    throw new CommandValidationError("Die ausgewählte Gruppe existiert nicht.");
  }
  return group;
}

function findStudent(group, studentId) {
  const student = group.students.find((item) => item.id === studentId);
  if (!student) {
    throw new CommandValidationError("Der ausgewählte Schüler existiert nicht.");
  }
  return student;
}

function requiredText(value, message, maxLength = DATA_LIMITS.metadataLength) {
  const text = normalizeSingleLineText(value, { fallback: "", maxLength });
  if (!text) {
    throw new CommandValidationError(message);
  }
  return text;
}

function define(label, mutate) {
  return Object.freeze({ label, mutate });
}

export const COMMAND_HANDLERS = Object.freeze({
  "plan/select": define("Plan auswählen", (draft, payload) => {
    const plan = findPlan(draft, payload?.planId);
    draft.activePlanId = plan.id;
    return { render: RENDER_ALL };
  }),

  "plan/create": define("Plan erstellen", (draft, payload) => {
    const plan = createDefaultPlan(payload?.name || "Neuer Gitarrenunterricht-Plan");
    draft.plans.push(plan);
    draft.activePlanId = plan.id;
    return {
      render: RENDER_ALL,
      notification: notice("Plan „" + plan.name + "“ erstellt ✓"),
      value: { planId: plan.id }
    };
  }),

  "plan/duplicate": define("Plan duplizieren", (draft, payload) => {
    const source = findPlan(draft, payload?.planId || draft.activePlanId);
    const duplicate = {
      ...clone(source),
      id: createPlanId(),
      name: source.name + " – Kopie"
    };
    draft.plans.push(duplicate);
    draft.activePlanId = duplicate.id;
    return {
      render: RENDER_ALL,
      notification: notice("Plan dupliziert ✓"),
      value: { planId: duplicate.id }
    };
  }),

  "plan/delete": define("Plan löschen", (draft, payload) => {
    if (draft.plans.length <= 1) {
      throw new CommandValidationError("Der letzte vorhandene Plan kann nicht gelöscht werden.");
    }
    const plan = findPlan(draft, payload?.planId || draft.activePlanId);
    draft.plans = draft.plans.filter((item) => item.id !== plan.id);
    draft.activePlanId = draft.plans[0].id;
    return { render: RENDER_ALL, notification: notice("Plan gelöscht") };
  }),

  "plan/clear": define("Plan leeren", (draft, payload) => {
    const plan = findPlan(draft, payload?.planId || draft.activePlanId);
    plan.groups = [];
    return { render: RENDER_GROUPS, notification: notice("Plan geleert") };
  }),

  "plan/reset": define("Plan zurücksetzen", (draft, payload) => {
    const plan = findPlan(draft, payload?.planId || draft.activePlanId);
    plan.name = "Gitarrenunterricht";
    plan.meta = clone(DEFAULT_META);
    plan.groups = [];
    return { render: RENDER_ALL, notification: notice("Plan zurückgesetzt") };
  }),

  "plan/nameSet": define("Planname ändern", (draft, payload) => {
    activePlan(draft).name = normalizeSingleLineText(payload?.name, {
      fallback: "Unbenannter Plan",
      maxLength: DATA_LIMITS.planNameLength
    });
    return { render: RENDER_PLAN_SELECT };
  }),

  "meta/set": define("Metadaten ändern", (draft, payload) => {
    const field = payload?.field;
    if (!["title", "teacher", "location", "term"].includes(field)) {
      throw new CommandValidationError("Unbekanntes Metadatenfeld.");
    }
    const fallbacks = {
      title: DEFAULT_META.title,
      teacher: DEFAULT_META.teacher,
      location: DEFAULT_META.location,
      term: DEFAULT_META.term
    };
    activePlan(draft).meta[field] = normalizeSingleLineText(payload?.value, {
      fallback: fallbacks[field],
      maxLength: field === "teacher"
        ? DATA_LIMITS.personNameLength
        : DATA_LIMITS.metadataLength
    });
    return { render: RENDER_PAGES };
  }),

  "minRows/set": define("Mindestzeilen ändern", (draft, payload) => {
    draft.minRows = payload?.value;
    return { render: RENDER_PAGES };
  }),

  "group/add": define("Gruppe hinzufügen", (draft, payload) => {
    const time = requiredText(
      payload?.time,
      "Bitte eine Zeit oder einen Gruppennamen eingeben."
    );
    const group = {
      id: createGroupId(),
      day: normalizeSingleLineText(payload?.day, {
        fallback: "",
        maxLength: DATA_LIMITS.metadataLength
      }),
      time,
      students: []
    };
    activePlan(draft).groups.push(group);
    return {
      render: RENDER_GROUPS,
      notification: notice("Gruppe hinzugefügt ✓"),
      value: { groupId: group.id }
    };
  }),

  "group/move": define("Gruppe verschieben", (draft, payload) => {
    const plan = activePlan(draft);
    const from = plan.groups.findIndex((item) => item.id === payload?.groupId);
    if (from < 0) {
      throw new CommandValidationError("Die ausgewählte Gruppe existiert nicht.");
    }
    const to = Number.isInteger(payload?.toIndex)
      ? payload.toIndex
      : from + Number(payload?.offset || 0);
    if (!moveItem(plan.groups, from, to)) {
      return { changed: false };
    }
    return { render: RENDER_GROUPS, notification: notice("Gruppe verschoben ✓") };
  }),

  "group/sort": define("Gruppe sortieren", (draft, payload) => {
    const group = findGroup(activePlan(draft), payload?.groupId);
    if (group.students.length < 2) {
      return {
        changed: false,
        notification: notice("Nichts zu sortieren.", "error"),
        notifyOnNoop: true
      };
    }
    const before = group.students.map((student) => student.id).join("\u0000");
    group.students.sort((first, second) => first.name.localeCompare(second.name, "de"));
    if (before === group.students.map((student) => student.id).join("\u0000")) {
      return {
        changed: false,
        notification: notice("Die Gruppe ist bereits alphabetisch sortiert."),
        notifyOnNoop: true
      };
    }
    return { render: RENDER_PAGES, notification: notice("Alphabetisch sortiert ✓") };
  }),

  "group/remove": define("Gruppe entfernen", (draft, payload) => {
    const plan = activePlan(draft);
    findGroup(plan, payload?.groupId);
    plan.groups = plan.groups.filter((item) => item.id !== payload.groupId);
    return { render: RENDER_GROUPS, notification: notice("Gruppe entfernt") };
  }),

  "group/update": define("Gruppe bearbeiten", (draft, payload) => {
    const group = findGroup(activePlan(draft), payload?.groupId);
    if (payload?.field === "day") {
      group.day = normalizeSingleLineText(payload.value, {
        fallback: "",
        maxLength: DATA_LIMITS.metadataLength
      });
    } else if (payload?.field === "time") {
      group.time = normalizeSingleLineText(payload.value, {
        fallback: "Neue Gruppe",
        maxLength: DATA_LIMITS.metadataLength
      });
    } else {
      throw new CommandValidationError("Unbekanntes Gruppenfeld.");
    }
    return { render: RENDER_GROUPS, notification: notice("Gespeichert ✓") };
  }),

  "student/add": define("Schüler hinzufügen", (draft, payload) => {
    const name = requiredText(
      payload?.student?.name,
      "Bitte einen Namen eingeben.",
      DATA_LIMITS.personNameLength
    );
    const student = {
      id: createStudentId(),
      name,
      className: normalizeSingleLineText(payload?.student?.className, {
        fallback: "Klasse",
        maxLength: DATA_LIMITS.metadataLength
      })
    };
    const group = findGroup(activePlan(draft), payload?.groupId);
    group.students.push(student);
    return {
      render: RENDER_PAGES,
      notification: notice(name + " hinzugefügt ✓"),
      value: { studentId: student.id }
    };
  }),

  "student/move": define("Schüler verschieben", (draft, payload) => {
    const group = findGroup(activePlan(draft), payload?.groupId);
    const from = group.students.findIndex((item) => item.id === payload?.studentId);
    if (from < 0) {
      throw new CommandValidationError("Der ausgewählte Schüler existiert nicht.");
    }
    const to = Number.isInteger(payload?.toIndex)
      ? payload.toIndex
      : from + Number(payload?.offset || 0);
    if (!moveItem(group.students, from, to)) {
      return { changed: false };
    }
    return { render: RENDER_PAGES };
  }),

  "student/moveToGroup": define("Schüler in andere Gruppe verschieben", (draft, payload) => {
    const plan = activePlan(draft);
    const sourceGroup = findGroup(plan, payload?.sourceGroupId);
    const targetGroup = findGroup(plan, payload?.targetGroupId);
    if (sourceGroup.id === targetGroup.id) {
      return { changed: false };
    }
    const studentIndex = sourceGroup.students.findIndex(
      (item) => item.id === payload?.studentId
    );
    if (studentIndex < 0) {
      throw new CommandValidationError("Der ausgewählte Schüler existiert nicht.");
    }
    const [student] = sourceGroup.students.splice(studentIndex, 1);
    targetGroup.students.push(student);
    return {
      render: RENDER_PAGES,
      notification: notice(student.name + " verschoben ✓")
    };
  }),

  "student/remove": define("Schüler entfernen", (draft, payload) => {
    const group = findGroup(activePlan(draft), payload?.groupId);
    const student = findStudent(group, payload?.studentId);
    group.students = group.students.filter((item) => item.id !== student.id);
    return {
      render: RENDER_PAGES,
      notification: notice(student.name + " entfernt")
    };
  }),

  "student/update": define("Schüler bearbeiten", (draft, payload) => {
    const student = findStudent(
      findGroup(activePlan(draft), payload?.groupId),
      payload?.studentId
    );
    if (payload?.field === "name") {
      student.name = normalizeSingleLineText(payload.value, {
        fallback: "Name",
        maxLength: DATA_LIMITS.personNameLength
      });
    } else if (payload?.field === "className") {
      student.className = normalizeSingleLineText(payload.value, {
        fallback: "Klasse",
        maxLength: DATA_LIMITS.metadataLength
      });
    } else {
      throw new CommandValidationError("Unbekanntes Schülerfeld.");
    }
    return { render: RENDER_PAGES, notification: notice("Gespeichert ✓") };
  }),

  "import/add": define("Pläne importieren", (draft, payload) => {
    if (!Array.isArray(payload?.plans) || payload.plans.length === 0) {
      throw new CommandValidationError("Keine Pläne zum Importieren gefunden.");
    }
    const plans = clone(payload.plans);
    if (draft.plans.length === 1 && draft.plans[0].groups.length === 0) {
      draft.plans = plans;
    } else {
      draft.plans.push(...plans);
    }
    draft.activePlanId = plans[0].id;
    const message = payload.kind === "all"
      ? plans.length + " Plan(e) importiert ✓"
      : "Plan „" + plans[0].name + "“ importiert ✓";
    return {
      render: RENDER_ALL,
      notification: notice(message),
      value: { count: plans.length, planId: plans[0].id }
    };
  })
});

export function getCommandDefinition(type) {
  return COMMAND_HANDLERS[type] || null;
}

