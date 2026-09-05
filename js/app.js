import { initialiseDataTransfer } from "./features/data-transfer.js";
import { initialiseEditor } from "./features/editor.js";
import {
  initialiseHistory,
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
  disposeFeedback,
  showModal,
  showSaveError,
  showToast
} from "./ui/feedback.js";

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
    requestRender(scope);
    updateUndoButton();
  } else if (event.type === "undo-stack") {
    updateUndoButton();
  } else if (event.type === "error") {
    showSaveError(event.error);
  } else if (event.type === "conflict") {
    showConflictDialog();
  }

  if (event.notification) {
    showToast(event.notification.message, event.notification.type);
  }
}

export function bootstrap() {
  cleanupApp?.();
  initialiseState(loadState());

  const cleanups = [
    subscribe(handleStateEvent),
    initialiseEditor(),
    initialiseHistory(),
    initialisePlanActions(),
    initialiseScheduleActions(),
    initialiseDataTransfer(),
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
