import { initialiseBackupNotices } from "./features/backup-notices.js";
import { initialiseDataTransfer } from "./features/data-transfer.js";
import { initialiseEditor } from "./features/editor.js";
import {
  initialiseHistory,
  undo,
  updateUndoButton
} from "./features/history.js";
import { initialiseLifecycle } from "./features/lifecycle.js";
import { initialisePlanActions } from "./features/plan-actions.js";
import { initialiseScheduleActions } from "./features/schedule-actions.js";
import { initialiseWorkspace } from "./features/workspace.js";
import {
  disposeRenderScheduler,
  flushRender,
  render,
  requestRender
} from "./render.js";
import {
  initialiseState,
  resolveExternalConflict,
  subscribe
} from "./state.js";
import { loadState } from "./storage.js";
import {
  discardPendingTextEdits,
  disposeTextEdits,
  flushPendingTextEdits
} from "./ui/text-edit.js";
import {
  clearUndoToast,
  disposeFeedback,
  showModal,
  showSaveError,
  showToast
} from "./ui/feedback.js";

const ANIMATED_COMMANDS = new Set([
  "group/add", "group/remove", "group/move", "group/sort", "groups/sortSchedule",
  "student/add", "student/addMany", "student/remove", "student/move", "student/moveToGroup", "plan/select"
]);

let cleanupApp = null;
let pendingBootstrapListener = null;

function showConflictDialog() {
  showModal({
    title: "Änderungen in einem anderen Tab",
    message: "Es gibt eine neuere externe Version und gleichzeitig lokale Änderungen. Welche Version soll verwendet werden?",
    type: "select",
    options: [
      { value: "external", label: "Externe Version übernehmen" },
      { value: "local", label: "Lokale Version beibehalten" }
    ],
    confirmLabel: "Auswahl anwenden",
    onConfirm(choice) {
      if (choice === "external") {
        discardPendingTextEdits();
        resolveExternalConflict("external");
        return;
      }
      const resolved = resolveExternalConflict("local");
      if (resolved.ok) {
        flushPendingTextEdits();
        flushRender();
      }
    }
  });
}

function handleStateEvent(event) {
  if (event.type === "change") {
    const scope = { ...(event.render || {}) };
    if (event.commandType === "group/add" && event.value?.groupId) {
      scope.preferredGroupId = event.value.groupId;
    }
    if (ANIMATED_COMMANDS.has(event.commandType)) scope.motion = event.commandType;
    requestRender(scope);
    const status = document.getElementById("saveStatus");
    if (status) status.textContent = "Alle Änderungen sind lokal gespeichert";
    updateUndoButton();
    clearUndoToast();
  } else if (event.type === "undo-stack") {
    updateUndoButton();
  } else if (event.type === "error") {
    const status = document.getElementById("saveStatus");
    if (status) status.textContent = "Änderung konnte nicht gespeichert werden";
    showSaveError(event.error);
  } else if (event.type === "conflict") {
    showConflictDialog();
  }

  if (event.notification) {
    const removal = event.type === "change" && ["group/remove", "student/remove"].includes(event.commandType);
    showToast(event.notification.message, event.notification.type, removal ? undo : null);
  }
}

export function bootstrap() {
  cleanupApp?.();
  const issues = [];
  initialiseState(loadState(undefined, (issue) => issues.push(issue)));
  const status = document.getElementById("saveStatus");
  if (status) status.textContent = issues.some((issue) => issue.future || !issue.saved)
    ? "Speichern gesperrt · Gespeicherte Daten prüfen"
    : "Alle Änderungen sind lokal gespeichert";

  const cleanups = [
    subscribe(handleStateEvent),
    initialiseEditor(),
    initialiseHistory(),
    initialisePlanActions(),
    initialiseScheduleActions(),
    initialiseDataTransfer(),
    initialiseBackupNotices(issues),
    initialiseLifecycle()
  ];

  render();
  cleanups.push(initialiseWorkspace());
  updateUndoButton();

  cleanupApp = () => {
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    disposeTextEdits();
    disposeRenderScheduler();
    disposeFeedback();
    cleanupApp = null;
  };
  return cleanupApp;
}

export function destroyApp() {
  cleanupApp?.();
  if (pendingBootstrapListener) {
    document.removeEventListener("DOMContentLoaded", pendingBootstrapListener);
    pendingBootstrapListener = null;
  }
}

if (document.readyState === "loading") {
  pendingBootstrapListener = () => {
    pendingBootstrapListener = null;
    bootstrap();
  };
  document.addEventListener("DOMContentLoaded", pendingBootstrapListener, { once: true });
} else {
  bootstrap();
}
