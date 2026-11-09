import { getActivePlan } from "../state.js";
import { exportAllPlans } from "./data-transfer.js";
import { measurePrintOverflow } from "./lifecycle.js";

function jumpToGroup(id) {
  const groups = document.querySelectorAll('.timeslot[data-segment-part="1"]');
  const group = [...groups].find((element) => element.dataset.groupId === id);
  if (!group) return;
  document.getElementById("previewViewBtn")?.click();
  group.focus({ preventScroll: true });
  group.scrollIntoView({ block: "center", inline: "nearest" });
}

function linkToGroup(label, id, description = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "overview-link";
  button.textContent = label;
  if (description) button.setAttribute("aria-label", label + ", " + description);
  button.onclick = () => jumpToGroup(id);
  return button;
}

export function analyseSchedule(groups) {
  const names = new Map();
  const overlaps = [];
  for (const [index, group] of groups.entries()) {
    const label = [group.day, group.time].filter(Boolean).join(" · ");
    if (group.day && group.start && group.end > group.start) {
      groups.slice(index + 1).forEach((other) => {
        if (group.day === other.day && other.start && other.end > other.start
          && group.start < other.end && other.start < group.end) {
          overlaps.push({ id: group.id, label: label + " und " + other.time });
        }
      });
    }
    group.students.forEach((student) => {
      const key = student.name.toLocaleLowerCase("de");
      if (!key) return;
      const existing = names.get(key) || [];
      existing.push({ id: group.id, label: student.name + " · " + label });
      names.set(key, existing);
    });
  }
  return { duplicates: [...names.values()].filter((items) => items.length > 1), overlaps };
}

function warning(title, items, style = "warning") {
  const box = document.createElement("div");
  box.className = "overview-note " + style;
  const heading = document.createElement("strong");
  heading.textContent = title;
  box.append(heading);
  items.slice(0, 30).forEach(({ id, label }) => box.append(linkToGroup(label, id)));
  if (items.length > 30) {
    const remaining = document.createElement("p");
    remaining.textContent = (items.length - 30) + " weitere Fundstellen";
    box.append(remaining);
  }
  return box;
}

export function initialiseOverview(pages) {
  const panel = document.getElementById("overviewPanel");
  if (!panel) return () => {};
  const metrics = document.getElementById("overviewMetrics");
  const occupancy = document.getElementById("overviewOccupancy");
  const warnings = document.getElementById("overviewWarnings");
  const backup = document.getElementById("overviewBackupBtn");
  const wide = window.matchMedia("(min-width: 1800px)");
  const applyWidth = () => { panel.open = wide.matches; };
  const save = () => exportAllPlans();
  let pending = null;

  const render = () => {
    const plan = getActivePlan();
    const groups = plan.groups;
    const total = groups.reduce((sum, group) => sum + group.students.length, 0);
    const metric = (count, label) => {
      const item = document.createElement("div");
      const number = document.createElement("strong");
      number.textContent = count;
      item.append(number, label);
      return item;
    };
    metrics.replaceChildren(metric(groups.length, "Gruppen"), metric(total, "Teilnehmende"));
    occupancy.replaceChildren(...groups.map((group) => {
      const max = Math.max(group.students.length, plan.layout.minRows);
      const label = [group.day, group.time].filter(Boolean).join(" · ");
      const ratio = group.students.length + " / " + max;
      const button = linkToGroup(label, group.id, ratio + " Plätze");
      const value = document.createElement("strong");
      value.textContent = ratio;
      const bar = document.createElement("progress");
      bar.max = Math.max(1, max);
      bar.value = group.students.length;
      bar.setAttribute("aria-hidden", "true");
      button.append(value, bar);
      return button;
    }));
    const { overlaps, duplicates } = analyseSchedule(groups);
    warnings.replaceChildren();
    if (overlaps.length) warnings.append(warning(overlaps.length + " zeitliche Überschneidung(en)", overlaps));
    if (duplicates.length) warnings.append(warning(duplicates.length + " doppelte Namen", duplicates.flat()));
    if (pending !== null) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      pending = null;
      if (!panel.open || !pages.clientWidth) return;
      if (total > 1000) {
        warnings.append(warning("Druckprüfung beim Drucken", [], "info"));
        return;
      }
      const overflow = measurePrintOverflow();
      warnings.append(overflow.length ? warning("Möglicher Druck-Überlauf", overflow)
        : warning("Druck geprüft · Alle Einträge passen auf die Seite", [], "success"));
    }, 160);
  };
  const observer = new window.MutationObserver(render);
  observer.observe(pages, { childList: true });
  panel.addEventListener("toggle", render);
  wide.addEventListener("change", applyWidth);
  backup.addEventListener("click", save);
  applyWidth();
  render();
  return () => {
    if (pending !== null) window.clearTimeout(pending);
    observer.disconnect();
    panel.removeEventListener("toggle", render);
    wide.removeEventListener("change", applyWidth);
    backup.removeEventListener("click", save);
  };
}
