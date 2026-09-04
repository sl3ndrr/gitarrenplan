import {
  APP_STATE_VERSION,
  DATA_LIMITS,
  DEFAULT_META,
  DEFAULT_MIN_ROWS,
  SUPPORTED_EXPORT_VERSIONS
} from "./config.js";
import {
  createGroupId,
  createPlanId,
  createStudentId
} from "./utils.js";

export class DataValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataValidationError";
    this.code = "INVALID_DATA";
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new DataValidationError(label + " muss eine Liste sein.");
  }

  return value;
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw new DataValidationError(label + " hat eine ungültige Struktur.");
  }

  return value;
}

function scalarToString(value, fallback) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return fallback;
}

export function normalizeSingleLineText(value, {
  fallback = "",
  maxLength = DATA_LIMITS.metadataLength
} = {}) {
  const safeFallback = typeof fallback === "string" ? fallback : "";
  const text = scalarToString(value, safeFallback)
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\t ]+/g, " ")
    .trim()
    .slice(0, maxLength);

  return text || safeFallback.slice(0, maxLength);
}

function uniqueId(value, usedIds, createId) {
  let candidate = normalizeSingleLineText(value, {
    fallback: "",
    maxLength: DATA_LIMITS.idLength
  });

  if (!candidate || usedIds.has(candidate)) {
    do {
      candidate = createId();
    } while (usedIds.has(candidate));
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeStudent(student, usedStudentIds) {
  const source = typeof student === "string"
    ? { name: student }
    : requirePlainObject(student, "Ein Schüler");

  return {
    id: uniqueId(source.id, usedStudentIds, createStudentId),
    name: normalizeSingleLineText(source.name, {
      fallback: "Name",
      maxLength: DATA_LIMITS.personNameLength
    }),
    className: normalizeSingleLineText(source.className, {
      fallback: "Klasse",
      maxLength: DATA_LIMITS.metadataLength
    })
  };
}

function normalizeGroup(group, usedGroupIds, usedStudentIds, counters) {
  const source = requirePlainObject(group, "Eine Gruppe");
  const students = source.students === undefined
    ? []
    : requireArray(source.students, "Die Schüler einer Gruppe");

  if (students.length > DATA_LIMITS.studentsPerGroup) {
    throw new DataValidationError(
      "Eine Gruppe darf höchstens " + DATA_LIMITS.studentsPerGroup + " Schüler enthalten."
    );
  }

  counters.students += students.length;
  if (counters.students > DATA_LIMITS.totalStudents) {
    throw new DataValidationError(
      "Ein Datenbestand darf höchstens " + DATA_LIMITS.totalStudents + " Schüler enthalten."
    );
  }

  return {
    id: uniqueId(source.id, usedGroupIds, createGroupId),
    day: normalizeSingleLineText(source.day, {
      fallback: "",
      maxLength: DATA_LIMITS.metadataLength
    }),
    time: normalizeSingleLineText(source.time, {
      fallback: "Neue Gruppe",
      maxLength: DATA_LIMITS.metadataLength
    }),
    students: students.map((item) => normalizeStudent(item, usedStudentIds))
  };
}

function normalizeMeta(meta) {
  const source = meta === undefined
    ? {}
    : requirePlainObject(meta, "Die Plan-Metadaten");

  return {
    title: normalizeSingleLineText(source.title, {
      fallback: DEFAULT_META.title,
      maxLength: DATA_LIMITS.metadataLength
    }),
    teacher: normalizeSingleLineText(source.teacher, {
      fallback: DEFAULT_META.teacher,
      maxLength: DATA_LIMITS.personNameLength
    }),
    location: normalizeSingleLineText(source.location, {
      fallback: DEFAULT_META.location,
      maxLength: DATA_LIMITS.metadataLength
    }),
    term: normalizeSingleLineText(source.term, {
      fallback: DEFAULT_META.term,
      maxLength: DATA_LIMITS.metadataLength
    })
  };
}

function normalizePlanWithContext(plan, context, regeneratePlanId = false) {
  const source = requirePlainObject(plan, "Ein Plan");
  const groups = source.groups === undefined
    ? []
    : requireArray(source.groups, "Die Gruppen eines Plans");

  if (groups.length > DATA_LIMITS.groupsPerPlan) {
    throw new DataValidationError(
      "Ein Plan darf höchstens " + DATA_LIMITS.groupsPerPlan + " Gruppen enthalten."
    );
  }

  return {
    id: uniqueId(regeneratePlanId ? "" : source.id, context.planIds, createPlanId),
    name: normalizeSingleLineText(source.name, {
      fallback: "Gitarrenunterricht",
      maxLength: DATA_LIMITS.planNameLength
    }),
    meta: normalizeMeta(source.meta),
    groups: groups.map((group) => normalizeGroup(
      group,
      context.groupIds,
      context.studentIds,
      context.counters
    ))
  };
}

function createNormalizationContext() {
  return {
    planIds: new Set(),
    groupIds: new Set(),
    studentIds: new Set(),
    counters: { students: 0 }
  };
}

export function normalizePlans(plans, { regeneratePlanIds = false } = {}) {
  const list = requireArray(plans, "Die Pläne");

  if (list.length === 0) {
    throw new DataValidationError("Mindestens ein Plan ist erforderlich.");
  }

  if (list.length > DATA_LIMITS.plans) {
    throw new DataValidationError(
      "Es dürfen höchstens " + DATA_LIMITS.plans + " Pläne gespeichert werden."
    );
  }

  const context = createNormalizationContext();
  return list.map((plan) => normalizePlanWithContext(plan, context, regeneratePlanIds));
}

export function normalizePlan(plan, { regeneratePlanId = false } = {}) {
  const context = createNormalizationContext();
  return normalizePlanWithContext(plan, context, regeneratePlanId);
}

export function normalizeGroups(groups) {
  const context = createNormalizationContext();
  const list = requireArray(groups, "Die Gruppen");

  if (list.length > DATA_LIMITS.groupsPerPlan) {
    throw new DataValidationError(
      "Ein Plan darf höchstens " + DATA_LIMITS.groupsPerPlan + " Gruppen enthalten."
    );
  }

  return list.map((group) => normalizeGroup(
    group,
    context.groupIds,
    context.studentIds,
    context.counters
  ));
}

export function createDefaultPlan(name = "Gitarrenunterricht") {
  return normalizePlan({
    id: createPlanId(),
    name,
    meta: DEFAULT_META,
    groups: []
  });
}

function normalizeMinRows(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MIN_ROWS;
  }

  return Math.max(0, Math.min(20, parsed));
}

function normalizeUpdatedAt(value, fallback) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return fallback;
}

export function normalizeAppState(value, { now = new Date().toISOString() } = {}) {
  const source = requirePlainObject(value, "Der App-Zustand");

  if (source.version !== APP_STATE_VERSION) {
    throw new DataValidationError("Unbekannte App-State-Version.");
  }

  const plans = normalizePlans(source.plans);
  const requestedActivePlanId = normalizeSingleLineText(source.activePlanId, {
    fallback: "",
    maxLength: DATA_LIMITS.idLength
  });
  const activePlanId = plans.some((plan) => plan.id === requestedActivePlanId)
    ? requestedActivePlanId
    : plans[0].id;
  const revision = Number.isSafeInteger(source.revision) && source.revision >= 0
    ? source.revision
    : 0;

  return {
    version: APP_STATE_VERSION,
    revision,
    updatedAt: normalizeUpdatedAt(source.updatedAt, now),
    plans,
    activePlanId,
    minRows: normalizeMinRows(source.minRows)
  };
}

export function createDefaultAppState({ now = new Date().toISOString() } = {}) {
  const plan = createDefaultPlan();

  return {
    version: APP_STATE_VERSION,
    revision: 0,
    updatedAt: now,
    plans: [plan],
    activePlanId: plan.id,
    minRows: DEFAULT_MIN_ROWS
  };
}

function validateExportVersion(envelope) {
  if (!Number.isInteger(envelope.version)
    || !SUPPORTED_EXPORT_VERSIONS.includes(envelope.version)) {
    throw new DataValidationError("Die Export-Version wird nicht unterstützt.");
  }
}

export function normalizeImportPayload(value) {
  if (Array.isArray(value)) {
    return {
      kind: "all",
      plans: normalizePlans(value, { regeneratePlanIds: true })
    };
  }

  const source = requirePlainObject(value, "Die Importdatei");

  if (source.type === "gitarrenunterricht-plans") {
    validateExportVersion(source);
    return {
      kind: "all",
      plans: normalizePlans(
        requireArray(source.plans, "Die Pläne des Exports"),
        { regeneratePlanIds: true }
      )
    };
  }

  if (source.type === "gitarrenunterricht-plan") {
    validateExportVersion(source);
    return {
      kind: "single",
      plans: [normalizePlan(
        requirePlainObject(source.plan, "Der exportierte Plan"),
        { regeneratePlanId: true }
      )]
    };
  }

  if (source.type !== undefined || source.version !== undefined) {
    throw new DataValidationError("Exporttyp oder Versionsnummer ist unbekannt.");
  }

  if (source.meta !== undefined || source.groups !== undefined) {
    return {
      kind: "single",
      plans: [normalizePlan({
        ...source,
        name: source.name === undefined ? "Importierter Plan" : source.name
      }, { regeneratePlanId: true })]
    };
  }

  throw new DataValidationError("Unbekanntes Importformat.");
}
