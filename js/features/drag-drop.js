import { dispatch, getActivePlan } from "../state.js";

export function initialiseDragDrop(pages) {
  let dragged = null;
  let highlight = null;
  let source = null;
  const clear = () => {
    source?.classList.remove("is-dragging");
    highlight?.classList.remove("is-drop-target");
    dragged = highlight = source = null;
  };
  const findTarget = (event) => {
    if (!dragged) return null;
    const slot = event.target.closest?.(".timeslot");
    if (!slot || (dragged.kind === "group" && slot.dataset.groupId === dragged.groupId)) return null;
    return dragged.kind === "student" ? event.target.closest("tr[data-student-id]") || slot : slot;
  };
  const start = (event) => {
    const handle = event.target.closest?.("[data-drag-kind]");
    if (!handle || event.target.closest("input")) return;
    const slot = handle.closest(".timeslot");
    if (!slot) return;
    source = handle.dataset.dragKind === "group" ? slot : handle;
    dragged = { kind: handle.dataset.dragKind, groupId: slot.dataset.groupId, studentId: handle.dataset.studentId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "Gitarrenplan");
    event.dataTransfer.setDragImage(source, 24, 20);
    source.classList.add("is-dragging");
  };
  const over = (event) => {
    const target = findTarget(event);
    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (target !== highlight) {
      highlight?.classList.remove("is-drop-target");
      target.classList.add("is-drop-target");
      highlight = target;
    }
  };
  const drop = (event) => {
    const target = findTarget(event);
    if (!target) return;
    event.preventDefault();
    const { kind, groupId, studentId } = dragged;
    const targetGroupId = target.closest(".timeslot").dataset.groupId;
    const plan = getActivePlan();
    const targetGroup = plan.groups.find((group) => group.id === targetGroupId);
    const index = targetGroup?.students.findIndex((student) => student.id === target.dataset.studentId);
    clear();
    if (!targetGroup) return;
    if (kind === "group") {
      dispatch({ type: "group/move", payload: { groupId, toIndex: plan.groups.indexOf(targetGroup) } });
    } else if (targetGroupId === groupId) {
      const toIndex = index < 0 ? targetGroup.students.length - 1 : index;
      dispatch({ type: "student/move", payload: { groupId, studentId, toIndex } });
    } else {
      const toIndex = index < 0 ? targetGroup.students.length : index;
      dispatch({ type: "student/moveToGroup", payload: { sourceGroupId: groupId, targetGroupId, studentId, toIndex } });
    }
  };
  const leave = (event) => {
    if (!pages.contains(event.relatedTarget)) {
      highlight?.classList.remove("is-drop-target");
      highlight = null;
    }
  };
  const events = [["dragstart", start], ["dragover", over], ["dragleave", leave], ["drop", drop], ["dragend", clear]];
  events.forEach(([type, listener]) => pages.addEventListener(type, listener));
  return () => {
    clear();
    events.forEach(([type, listener]) => pages.removeEventListener(type, listener));
  };
}
