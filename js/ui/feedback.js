export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => toast.remove(), 2200);
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
  onConfirm = null,
  onCancel = null
} = {}) {
  const overlay = document.getElementById("modal-overlay");
  const titleElement = document.getElementById("modal-title");
  const messageElement = document.getElementById("modal-message");
  const inputElement = document.getElementById("modal-input");
  const selectElement = document.getElementById("modal-select");
  const cancelButton = document.getElementById("modal-cancel");
  const confirmButton = document.getElementById("modal-confirm");

  titleElement.textContent = title;
  messageElement.textContent = message;
  confirmButton.textContent = confirmLabel;
  confirmButton.className = confirmClass;

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
    selectElement.innerHTML = "";

    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      selectElement.appendChild(element);
    });
  }

  overlay.classList.remove("hidden");

  window.setTimeout(() => {
    if (type === "prompt") {
      inputElement.select();
    }

    if (type === "select") {
      selectElement.focus();
    }

    if (type === "alert") {
      confirmButton.focus();
    }
  }, 0);

  function cleanup() {
    overlay.classList.add("hidden");
    confirmButton.removeEventListener("click", onConfirmClick);
    cancelButton.removeEventListener("click", onCancelClick);
    overlay.removeEventListener("click", onOverlayClick);
    inputElement.removeEventListener("keydown", onInputKey);
    document.removeEventListener("keydown", onDocumentKey);
  }

  function onConfirmClick() {
    cleanup();

    if (!onConfirm) {
      return;
    }

    if (type === "prompt") {
      onConfirm(inputElement.value);
    } else if (type === "select") {
      onConfirm(selectElement.value);
    } else {
      onConfirm();
    }
  }

  function onCancelClick() {
    cleanup();

    if (onCancel) {
      onCancel();
    }
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
    }

    if (event.key === "Escape") {
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
}
