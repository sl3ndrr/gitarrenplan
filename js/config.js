export const STORAGE_KEYS = Object.freeze({
  state: "gitarrenunterricht_state_v3",
  plansV2: "gitarrenunterricht_plans_v2",
  activePlanV2: "gitarrenunterricht_active_plan_v2",
  minRowsV1: "gitarrenunterricht_min_rows",
  legacyGroupsV1: "gitarrenunterricht_plan_v1",
  legacyMetaV1: "gitarrenunterricht_meta_v1"
});

export const APP_STATE_VERSION = 3;
export const EXPORT_VERSION = 2;
export const SUPPORTED_EXPORT_VERSIONS = Object.freeze([1, 2]);
export const MAX_UNDO_STEPS = 10;
export const DEFAULT_MIN_ROWS = 6;

// These limits are part of the persisted/imported data contract. Keep the
// matching documentation in docs/DATENFORMAT.md in sync when changing them.
export const DATA_LIMITS = Object.freeze({
  importBytes: 2 * 1024 * 1024,
  plans: 50,
  groupsPerPlan: 100,
  studentsPerGroup: 100,
  totalStudents: 5000,
  planNameLength: 80,
  personNameLength: 80,
  metadataLength: 160,
  idLength: 160
});

export const DEFAULT_META = Object.freeze({
  title: "Gitarrenunterricht",
  teacher: "Lehrkraft",
  location: "Lernwerkstatt",
  term: ""
});
