import { flushRender, setPrintPresentation } from "../render.js";
import { handleStorageEvent } from "../state.js";
import { showModal } from "../ui/feedback.js";
import { flushPendingTextEdits } from "../ui/text-edit.js";

export function flushImmediately() {
  const result = flushPendingTextEdits();
  if (result.ok) {
    flushRender();
  }
  return result;
}

export function measurePrintOverflow() {
  const stylesheet = document.getElementById("printLayoutStyles");
  if (!stylesheet) return [];
  const previousMedia = stylesheet.media;
  const shell = document.getElementById("app-shell");
  shell?.classList.add("is-measuring-print");
  stylesheet.media = "all";
  try {
    return [...document.querySelectorAll("#pages .timeslot, #pages [data-print-check]")]
      .filter((slot) => slot.clientHeight > 0 && (
        slot.scrollHeight > slot.clientHeight + 1 ||
        (slot.classList.contains("week-card") && slot.getBoundingClientRect().bottom
          > slot.closest(".page-content").getBoundingClientRect().bottom + 1)
      ))
      .map((slot) => ({
        id: slot.dataset.groupId,
        label: slot.getAttribute("aria-label")
      }));
  } finally {
    stylesheet.media = previousMedia;
    shell?.classList.remove("is-measuring-print");
  }
}

let approvedPrint = false;
let nativeOverflow = [];

function invokePrint() {
  approvedPrint = true;
  setPrintPresentation("print", true);
  try {
    window.print();
  } finally {
    approvedPrint = false;
    setPrintPresentation("print", false);
  }
}

function warnAboutOverflow(groups, afterNativePrint = false) {
  const labels = [...new Set(groups.map(({ label }) => label))].join(", ");
  showModal({
    title: "Inhalt passt nicht auf die Druckseite",
    message: (afterNativePrint ? "Beim Drucken über das Browsermenü können Inhalte abgeschnitten sein. " : "")
      + "Betroffen: " + labels + ".",
    type: "confirm",
    confirmLabel: "Trotzdem drucken",
    onConfirm: invokePrint
  });
}

export function printPlan() {
  if (!flushImmediately().ok) return;
  setPrintPresentation("print", true);
  const groups = measurePrintOverflow();
  setPrintPresentation("print", false);
  if (groups.length) warnAboutOverflow(groups);
  else invokePrint();
}

export function initialiseLifecycle() {
  const printButton = document.getElementById("printBtn");
  const onBeforePrint = () => {
    if (!flushImmediately().ok) return;
    setPrintPresentation("print", true);
    const groups = measurePrintOverflow();
    if (!approvedPrint) nativeOverflow = groups;
  };
  const onAfterPrint = () => {
    setPrintPresentation("print", false);
    if (nativeOverflow.length) warnAboutOverflow(nativeOverflow, true);
    nativeOverflow = [];
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushImmediately();
    }
  };
  const onPageHide = () => {
    flushImmediately();
  };
  const onStorage = (event) => {
    handleStorageEvent(event);
  };

  printButton.addEventListener("click", printPlan);
  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("storage", onStorage);

  return () => {
    printButton.removeEventListener("click", printPlan);
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("storage", onStorage);
  };
}

