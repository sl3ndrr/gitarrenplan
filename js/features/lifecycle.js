import { flushRender } from "../render.js";
import { handleStorageEvent } from "../state.js";
import { flushPendingTextEdits } from "../ui/text-edit.js";

export function flushImmediately() {
  const result = flushPendingTextEdits();
  if (result.ok) {
    flushRender();
  }
  return result;
}

export function initialiseLifecycle() {
  const printButton = document.getElementById("printBtn");
  const onPrint = () => {
    if (flushImmediately().ok) {
      window.print();
    }
  };
  const onBeforePrint = () => {
    flushImmediately();
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

  printButton.addEventListener("click", onPrint);
  window.addEventListener("beforeprint", onBeforePrint);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("storage", onStorage);

  return () => {
    printButton.removeEventListener("click", onPrint);
    window.removeEventListener("beforeprint", onBeforePrint);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("storage", onStorage);
  };
}

