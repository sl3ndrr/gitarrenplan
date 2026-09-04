import {
  cancelUndoGroup,
  dispatch,
  finalizeUndoGroup,
  markLocalEditPending
} from "../state.js";

export const TEXT_INPUT_DEBOUNCE_MS = 300;

const sessions = new Map();

function clearSessionTimer(session) {
  if (session.timer !== null) {
    globalThis.clearTimeout(session.timer);
    session.timer = null;
  }
}

function createSession(element, config) {
  const session = {
    key: config.key,
    element,
    original: String(config.getValue() ?? ""),
    latest: element.value,
    getValue: config.getValue,
    createCommand: config.createCommand,
    timer: null
  };
  sessions.set(session.key, session);
  return session;
}

function ensureSession(element, config) {
  const existing = sessions.get(config.key);
  if (existing) {
    existing.element = element;
    existing.getValue = config.getValue;
    existing.createCommand = config.createCommand;
    return existing;
  }
  return createSession(element, config);
}

function finishFailedSession(session, finalize) {
  const currentValue = String(session.getValue() ?? "");
  if (session.element.value !== currentValue) {
    session.element.value = currentValue;
  }
  session.latest = currentValue;
  markLocalEditPending(session.key, false);
  if (finalize) {
    finalizeUndoGroup(session.key);
    sessions.delete(session.key);
  }
}

function commitSession(session, finalize) {
  clearSessionTimer(session);
  const result = dispatch(session.createCommand(session.latest), {
    undoGroup: session.key,
    finalize,
    silent: !finalize
  });

  if (!result.ok) {
    if (result.error?.code === "STATE_CONFLICT") {
      markLocalEditPending(session.key, true);
      return result;
    }
    finishFailedSession(session, finalize);
    return result;
  }

  const currentValue = String(session.getValue() ?? "");
  if (session.element.value !== currentValue) {
    session.element.value = currentValue;
  }
  session.latest = currentValue;
  markLocalEditPending(session.key, false);
  if (finalize) {
    sessions.delete(session.key);
  }
  return result;
}

export function beginTextEdit(element, config) {
  return ensureSession(element, config);
}

export function queueTextEdit(element, config) {
  const session = ensureSession(element, config);
  session.element = element;
  session.latest = element.value;
  markLocalEditPending(session.key, true);
  clearSessionTimer(session);
  session.timer = globalThis.setTimeout(() => {
    session.timer = null;
    commitSession(session, false);
  }, TEXT_INPUT_DEBOUNCE_MS);
}

export function finishTextEdit(element, config) {
  let session = sessions.get(config.key);
  if (!session) {
    if (element.value === String(config.getValue() ?? "")) {
      return { ok: true, changed: false, error: null };
    }
    session = createSession(element, config);
  }
  session.element = element;
  session.latest = element.value;
  return commitSession(session, true);
}

export function cancelTextEdit(element, config) {
  const session = sessions.get(config.key);
  if (!session) {
    element.value = String(config.getValue() ?? "");
    return { ok: true, changed: false, error: null };
  }

  clearSessionTimer(session);
  const result = cancelUndoGroup(
    session.key,
    session.createCommand(session.original)
  );
  if (result.ok) {
    element.value = String(session.getValue() ?? session.original);
    sessions.delete(session.key);
    markLocalEditPending(session.key, false);
  }
  return result;
}

export function hasTextEditSession(key) {
  return sessions.has(key);
}

export function flushPendingTextEdits() {
  let firstError = null;
  for (const session of [...sessions.values()]) {
    const result = commitSession(session, true);
    if (!result.ok && !firstError) {
      firstError = result.error;
    }
  }
  return firstError
    ? { ok: false, error: firstError }
    : { ok: true, error: null };
}

export function discardPendingTextEdits() {
  for (const session of sessions.values()) {
    clearSessionTimer(session);
    session.element.value = String(session.getValue() ?? "");
    markLocalEditPending(session.key, false);
  }
  sessions.clear();
}

export function disposeTextEdits() {
  for (const session of sessions.values()) {
    clearSessionTimer(session);
    markLocalEditPending(session.key, false);
    finalizeUndoGroup(session.key);
  }
  sessions.clear();
}

export function bindDebouncedTextInput(element, configFactory) {
  const getConfig = () => configFactory(element);
  const onFocus = () => beginTextEdit(element, getConfig());
  const onInput = () => queueTextEdit(element, getConfig());
  const onChange = () => finishTextEdit(element, getConfig());
  const onFocusOut = () => {
    const config = getConfig();
    if (hasTextEditSession(config.key)) {
      finishTextEdit(element, config);
    }
  };
  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishTextEdit(element, getConfig());
      element.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelTextEdit(element, getConfig());
      element.blur();
    }
  };

  element.addEventListener("focus", onFocus);
  element.addEventListener("input", onInput);
  element.addEventListener("change", onChange);
  element.addEventListener("focusout", onFocusOut);
  element.addEventListener("keydown", onKeyDown);

  return () => {
    element.removeEventListener("focus", onFocus);
    element.removeEventListener("input", onInput);
    element.removeEventListener("change", onChange);
    element.removeEventListener("focusout", onFocusOut);
    element.removeEventListener("keydown", onKeyDown);
  };
}
