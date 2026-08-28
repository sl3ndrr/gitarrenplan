export const STORAGE_KEYS = Object.freeze({
  plans: "gitarrenunterricht_plans_v2",
  activePlan: "gitarrenunterricht_active_plan_v2",
  minRows: "gitarrenunterricht_min_rows",
  legacyGroups: "gitarrenunterricht_plan_v1",
  legacyMeta: "gitarrenunterricht_meta_v1"
});

export const MAX_UNDO_STEPS = 10;
export const DEFAULT_MIN_ROWS = 6;

export const DEFAULT_META = Object.freeze({
  title: "Gitarrenunterricht",
  teacher: "Lehrkraft",
  location: "Lernwerkstatt",
  term: ""
});
