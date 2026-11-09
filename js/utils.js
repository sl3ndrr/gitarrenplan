function createId(prefix) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function createPlanId() {
  return createId("plan");
}

export function createGroupId() {
  return createId("group");
}

export function createStudentId() {
  return createId("student");
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

export function moveItem(array, from, to) {
  if (from < 0 || to < 0 || from >= array.length || to >= array.length) {
    return false;
  }

  const [item] = array.splice(from, 1);
  array.splice(to, 0, item);
  return true;
}

export function downloadJson(data, filename) {
  downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}

export function downloadText(text, filename, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
