let lastSaveErrorAt = 0;
const SAVE_ERROR_THROTTLE_MS = 5000;
const feedbackTimers = new Set();
let activeModalCleanup = null;

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

export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container || !message) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.textContent = message;
  container.appendChild(toast);
  schedule(() => toast.remove(), 2200);
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
  onCancel = null
} = {}) {
  activeModalCleanup?.();

  const overlay = document.getElementById("modal-overlay");
  const titleElement = document.getElementById("modal-title");
  const messageElement = document.getElementById("modal-message");
  const inputElement = document.getElementById("modal-input");
  const selectElement = document.getElementById("modal-select");
  const cancelButton = document.getElementById("modal-cancel");
  const confirmButton = document.getElementById("modal-confirm");
  let closed = false;
  let focusTimer = null;

  titleElement.textContent = title;
  messageElement.textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.className = confirmClass;
  cancelButton.textContent = cancelLabel;
  inputElement.classList.add("hidden");
  selectElement.classList.add("hidden");
  cancelButton.style.display = type === "alert" ? "none" : "";

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

  function cleanup() {
    if (closed) {
      return;
    }
    closed = true;
    overlay.classList.add("hidden");
    confirmButton.removeEventListener("click", onConfirmClick);
    cancelButton.removeEventListener("click", onCancelClick);
    overlay.removeEventListener("click", onOverlayClick);
    inputElement.removeEventListener("keydown", onInputKey);
    document.removeEventListener("keydown", onDocumentKey);
    cancelScheduled(focusTimer);
    focusTimer = null;
    if (activeModalCleanup === cleanup) {
      activeModalCleanup = null;
    }
  }

  function onConfirmClick() {
    const value = type === "prompt"
      ? inputElement.value
      : type === "select"
        ? selectElement.value
        : undefined;
    cleanup();
    onConfirm?.(value);
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
    }
  }

  confirmButton.addEventListener("click", onConfirmClick);
  cancelButton.addEventListener("click", onCancelClick);
  overlay.addEventListener("click", onOverlayClick);
  inputElement.addEventListener("keydown", onInputKey);
  document.addEventListener("keydown", onDocumentKey);
  activeModalCleanup = cleanup;

  focusTimer = schedule(() => {
    focusTimer = null;
    if (type === "prompt") {
      inputElement.select();
    } else if (type === "select") {
      selectElement.focus();
    } else {
      confirmButton.focus();
    }
  }, 0);
}

export function disposeFeedback() {
  activeModalCleanup?.();
  activeModalCleanup = null;
  feedbackTimers.forEach((timer) => globalThis.clearTimeout(timer));
  feedbackTimers.clear();
  document.getElementById("toast-container")?.replaceChildren();
  lastSaveErrorAt = 0;
}

