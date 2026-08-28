import { DEFAULT_META } from "./config.js";

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function createPlanId() {
  return createId();
}

export function createGroupId() {
  return createId();
}

export function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(date) {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function sanitizeFilename(name) {
  return String(name)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "gitarrenunterricht";
}

export function moveItem(array, from, to) {
  if (from < 0 || to < 0 || from >= array.length || to >= array.length) {
    return false;
  }

  const [item] = array.splice(from, 1);
  array.splice(to, 0, item);
  return true;
}

export function normalizeGroups(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((group) => {
    const sourceGroup = group && typeof group === "object" ? group : {};

    return {
      id: sourceGroup.id || createGroupId(),
      day: sourceGroup.day || "",
      time: sourceGroup.time || "Neue Gruppe",
      students: Array.isArray(sourceGroup.students)
        ? sourceGroup.students.map((student) => {
            const sourceStudent = student && typeof student === "object" ? student : {};

            return {
              name: sourceStudent.name || "Name",
              className: sourceStudent.className || "Klasse"
            };
          })
        : []
    };
  });
}

export function normalizePlan(plan = {}) {
  const sourcePlan = plan && typeof plan === "object" ? plan : {};

  return {
    id: sourcePlan.id || createPlanId(),
    name: sourcePlan.name || "Gitarrenunterricht",
    meta: { ...clone(DEFAULT_META), ...(sourcePlan.meta || {}) },
    groups: normalizeGroups(Array.isArray(sourcePlan.groups) ? sourcePlan.groups : [])
  };
}

export function createDefaultPlan(name = "Gitarrenunterricht") {
  return {
    id: createPlanId(),
    name,
    meta: clone(DEFAULT_META),
    groups: []
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
