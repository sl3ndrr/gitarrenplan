let lastSaveErrorAt = 0;
const SAVE_ERROR_THROTTLE_MS = 5000;
const feedbackTimers = new Set();
let activeDialog = null;

function schedule(callback, delay) {
  const timer = globalThis.setTimeout(() => {
    feedbackTimers.delete(timer);
    callback();
  }, delay);
  feedbackTimers.add(timer);
  return timer;
}

function cancelScheduled(timer) {
  if (timer === null) {
    return;
  }
  globalThis.clearTimeout(timer);
  feedbackTimers.delete(timer);
}

export function showToast(message, type = "success", undo = null) {
  const container = document.getElementById("toast-container");
  if (!container || !message) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  const symbol = document.createElement("span");
  symbol.className = "toast-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = type === "error" ? "⚠" : "✓";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(symbol, text);
  container.appendChild(toast);
  if (!undo) {
    schedule(() => toast.remove(), 2200);
    return;
  }

  toast.classList.add("undo-toast");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button btn-secondary";
  button.textContent = "Rückgängig";
  const progress = document.createElement("span");
  progress.className = "undo-toast-progress";
  progress.setAttribute("aria-hidden", "true");
  toast.append(button, progress);
  let remaining = 6000;
  let started = 0;
  let timer = null;
  const pause = () => {
    if (timer === null) return;
    remaining -= Date.now() - started;
    cancelScheduled(timer);
    timer = null;
  };
  const resume = () => {
    if (toast.matches(":hover, :focus-within") || timer !== null) return;
    started = Date.now();
    timer = schedule(() => toast.remove(), Math.max(0, remaining));
  };
  toast.addEventListener("mouseenter", pause);
  toast.addEventListener("mouseleave", resume);
  toast.addEventListener("focusin", pause);
  toast.addEventListener("focusout", () => schedule(resume, 0));
  button.addEventListener("click", () => {
    pause();
    toast.remove();
    undo();
    document.getElementById("undoBtn")?.focus();
  });
  resume();
}

export function clearUndoToast() {
  document.querySelectorAll(".undo-toast").forEach((toast) => toast.remove());
}

export function showSaveError(error) {
  const now = Date.now();
  if (now - lastSaveErrorAt < SAVE_ERROR_THROTTLE_MS) {
    return;
  }
  lastSaveErrorAt = now;
  const isUserFacing = ["INVALID_DATA", "COMMAND_INVALID"].includes(error?.code);
  showToast(
    isUserFacing
      ? error.message
      : "Speichern fehlgeschlagen – die Änderung wurde zurückgerollt.",
    "error"
  );
}

export function showModal({
  title = "",
  message = "",
  type = "alert",
  inputValue = "",
  inputPlaceholder = "",
  options = null,
  confirmLabel = "OK",
  confirmClass = "btn-primary",
  cancelLabel = "Abbrechen",
  onConfirm = null,
  alternative = null,
  preview = null,
  onCancel = null
} = {}) {
  const inheritedOrigin = activeDialog?.origin || null;
  activeDialog?.close({ restoreFocus: false });

  const overlay = document.getElementById("modal-overlay");
  const titleElement = document.getElementById("modal-title");
  const messageElement = document.getElementById("modal-message");
  const inputElement = document.getElementById("modal-input");
  const textarea = document.getElementById("modal-textarea");
  const previewElement = document.getElementById("modal-preview");
  const selectElement = document.getElementById("modal-select");
  const cancelButton = document.getElementById("modal-cancel");
  const alternativeButton = document.getElementById("modal-alternative");
  const confirmButton = document.getElementById("modal-confirm");
  const appShell = document.getElementById("app-shell");
  const activeElement = document.activeElement;
  const origin = inheritedOrigin || (
    activeElement instanceof HTMLElement && !overlay.contains(activeElement)
      ? activeElement
      : null
  );
  const appWasInert = appShell?.hasAttribute("inert") || false;
  let closed = false;
  let focusTimer = null;

  titleElement.textContent = title;
  messageElement.textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.className = "button " + confirmClass;
  cancelButton.textContent = cancelLabel;
  alternativeButton?.classList.toggle("hidden", !alternative);
  if (alternativeButton && alternative) alternativeButton.textContent = alternative.label;
  inputElement.classList.add("hidden");
  selectElement.classList.add("hidden");
  cancelButton.style.display = type === "alert" ? "none" : "";

  textarea?.classList.toggle("hidden", type !== "textarea");
  if (previewElement) previewElement.hidden = type !== "textarea";
  if (type === "textarea") {
    textarea.value = "";
    updatePreview();
    textarea.addEventListener("input", updatePreview);
  } else {
    confirmButton.disabled = false;
  }
  if (type === "prompt") {
    inputElement.classList.remove("hidden");
    inputElement.value = inputValue;
    inputElement.placeholder = inputPlaceholder;
  }
  if (type === "select" && Array.isArray(options)) {
    selectElement.classList.remove("hidden");
    selectElement.replaceChildren();
    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      selectElement.appendChild(element);
    });
  }
  overlay.classList.remove("hidden");
  appShell?.setAttribute("inert", "");

  function cleanup({ restoreFocus = true } = {}) {
    if (closed) {
      return;
    }
    closed = true;
    overlay.classList.add("hidden");
    alternativeButton?.removeEventListener("click", onAlternativeClick);
    confirmButton.removeEventListener("click", onConfirmClick);
    cancelButton.removeEventListener("click", onCancelClick);
    overlay.removeEventListener("click", onOverlayClick);
    inputElement.removeEventListener("keydown", onInputKey);
    textarea?.removeEventListener("input", updatePreview);
    document.removeEventListener("keydown", onDocumentKey);
    cancelScheduled(focusTimer);
    focusTimer = null;
    if (appShell && !appWasInert) {
      appShell.removeAttribute("inert");
    }
    if (activeDialog?.close === cleanup) {
      activeDialog = null;
    }
    if (restoreFocus && origin?.isConnected) {
      origin.focus({ preventScroll: true });
    }
  }

  function updatePreview() {
    const result = preview?.(textarea.value);
    confirmButton.disabled = !result?.valid;
    previewElement.textContent = result?.message || "";
  }

  function onConfirmClick() {
    const value = type === "prompt"
      ? inputElement.value
      : type === "select" ? selectElement.value
        : type === "textarea" ? textarea.value : undefined;
    cleanup();
    onConfirm?.(value);
  }

  function onAlternativeClick() {
    cleanup();
    alternative?.action();
  }

  function onCancelClick() {
    cleanup();
    onCancel?.();
  }

  function onOverlayClick(event) {
    if (event.target === overlay) {
      onCancelClick();
    }
  }

  function onInputKey(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirmClick();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancelClick();
    }
  }

  function onDocumentKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelClick();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = [inputElement, textarea, selectElement, cancelButton, alternativeButton, confirmButton]
      .filter((element) => (
        element && !element.disabled
        && !element.classList.contains("hidden")
        && element.style.display !== "none"
      ));
    if (focusable.length === 0) {
      event.preventDefault();
      overlay.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  alternativeButton?.addEventListener("click", onAlternativeClick);
  confirmButton.addEventListener("click", onConfirmClick);
  cancelButton.addEventListener("click", onCancelClick);
  overlay.addEventListener("click", onOverlayClick);
  inputElement.addEventListener("keydown", onInputKey);
  document.addEventListener("keydown", onDocumentKey);
  activeDialog = { close: cleanup, origin };

  focusTimer = schedule(() => {
    focusTimer = null;
    if (type === "prompt") {
      inputElement.focus();
      inputElement.select();
    } else if (type === "textarea") {
      textarea.focus();
    } else if (type === "select") {
      selectElement.focus();
    } else {
      confirmButton.focus();
    }
  }, 0);
}

export function disposeFeedback() {
  activeDialog?.close();
  activeDialog = null;
  feedbackTimers.forEach((timer) => globalThis.clearTimeout(timer));
  feedbackTimers.clear();
  document.getElementById("toast-container")?.replaceChildren();
  lastSaveErrorAt = 0;
}
