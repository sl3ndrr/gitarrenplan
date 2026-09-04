import { STORAGE_KEYS } from "./config.js";
import { normalizeAppState } from "./normalization.js";

export function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function safeGetItem(key, storage = getDefaultStorage()) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSetItem(key, value, storage = getDefaultStorage()) {
  try {
    if (!storage) {
      throw new DOMException("LocalStorage ist nicht verfügbar.", "SecurityError");
    }
    storage.setItem(key, value);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

export function persistState(state, storage = getDefaultStorage()) {
  try {
    return safeSetItem(STORAGE_KEYS.state, JSON.stringify(state), storage);
  } catch (error) {
    return { ok: false, error };
  }
}

export function readStoredState(storage = getDefaultStorage()) {
  const raw = safeGetItem(STORAGE_KEYS.state, storage);
  if (raw === null) {
    return { ok: true, state: null, raw: null, error: null };
  }
  try {
    return {
      ok: true,
      state: normalizeAppState(JSON.parse(raw)),
      raw,
      error: null
    };
  } catch (error) {
    return { ok: false, state: null, raw, error };
  }
}

