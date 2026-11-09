import { DATA_LIMITS } from "../config.js";
import { normalizeSingleLineText } from "../normalization.js";
import { dispatch, getActivePlan, getPlans } from "../state.js";
import { showModal } from "../ui/feedback.js";

export function parseBulkStudents(text) {
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const [name, className] = line.split(/[;\t]/, 2);
    return {
      name: normalizeSingleLineText(name, { maxLength: DATA_LIMITS.personNameLength }),
      className: normalizeSingleLineText(className)
    };
  });
}

export function openBulkEntry() {
  const groupId = document.getElementById("groupSelect").value;
  const group = getActivePlan().groups.find((item) => item.id === groupId);
  if (!group) return;
  const total = getPlans().flatMap((plan) => plan.groups)
    .reduce((sum, item) => sum + item.students.length, 0);
  const remaining = Math.min(DATA_LIMITS.studentsPerGroup - group.students.length, DATA_LIMITS.totalStudents - total);
  showModal({
    type: "textarea",
    title: "Mehrere Teilnehmende einfügen",
    message: "Eine Person pro Zeile. Trenne Name und Klasse mit einem Semikolon oder einem Tab.",
    confirmLabel: "Hinzufügen",
    preview(text) {
      const students = parseBulkStudents(text);
      const valid = students.length > 0 && students.length <= remaining && students.every((student) => student.name);
      const names = students.slice(0, 5).map(({ name, className }) => name + (className ? " · " + className : ""));
      const error = students.length > remaining ? " Hier passen noch " + remaining + " Personen." :
        students.some((student) => !student.name) ? " Gib in jeder Zeile einen Namen an." : "";
      return {
        valid,
        message: students.length + " Zeile(n) erkannt. " + names.join(", ")
          + (students.length > names.length ? " …" : "") + error
      };
    },
    onConfirm: (text) => dispatch({
      type: "student/addMany",
      payload: { groupId, students: parseBulkStudents(text) }
    })
  });
}
