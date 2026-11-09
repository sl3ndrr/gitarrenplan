import { safeGetItem, safeSetItem } from "../persistence.js";
import { subscribe } from "../state.js";
import { downloadText } from "../utils.js";

const LAST_BACKUP = "gitarrenunterricht_letzte_sicherung";
const BACKUP_CHANGES = "gitarrenunterricht_sicherung_aenderungen";
const REMINDER_THRESHOLD = 12;

export function markBackup(date) {
  safeSetItem(LAST_BACKUP, date.toISOString());
  safeSetItem(BACKUP_CHANGES, "0");
  updateBackupStatus();
}

function updateBackupStatus() {
  const status = document.getElementById("backupStatus");
  const overview = document.getElementById("overviewBackupStatus");
  const reminder = document.getElementById("backupReminder");
  const previous = Date.parse(safeGetItem(LAST_BACKUP));
  const days = Math.max(0, Math.floor((Date.now() - previous) / 86400000));
  const message = !Number.isFinite(days) ? "Noch nie gesichert"
    : days === 0 ? "Letzte Sicherung: heute"
      : "Letzte Sicherung: vor " + days + (days === 1 ? " Tag" : " Tagen");
  if (status) status.textContent = message;
  if (overview) overview.textContent = message;
  if (reminder) reminder.hidden = Number(safeGetItem(BACKUP_CHANGES)) < REMINDER_THRESHOLD;
}

export function initialiseBackupNotices(issues) {
  const notice = document.getElementById("recoveryNotice");
  const dismiss = document.getElementById("dismissBackupReminder");
  const closeReminder = () => {
    safeSetItem(BACKUP_CHANGES, "0");
    updateBackupStatus();
  };
  dismiss?.addEventListener("click", closeReminder);
  updateBackupStatus();
  try {
    globalThis.navigator?.storage?.persist?.()?.catch(() => {});
  } catch {
    // The browser can disallow persistent storage.
  }

  notice?.replaceChildren();
  issues.forEach(({ raw, backupKey, saved, future, discarded }) => {
    const dismissKey = backupKey + "_geschlossen";
    if (!notice || safeGetItem(dismissKey)) return;
    const row = document.createElement("div");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = future
      ? "Die gespeicherten Daten stammen aus einer neueren App-Version. Sie bleiben erhalten. Öffne die passende Version, um weiterzuarbeiten."
      : "Gespeicherte Daten waren nicht lesbar.";
    message.textContent += saved ? " Eine Kopie wurde gesichert." : " Die Rohdaten sind weiterhin im Browser gespeichert.";
    if (discarded) {
      message.textContent += " Übersprungen: " + discarded.groups + " Gruppe(n), " + discarded.students + " Teilnehmende.";
    }
    const download = document.createElement("button");
    download.type = "button";
    download.className = "button btn-secondary";
    download.textContent = "Kopie herunterladen";
    download.onclick = () => downloadText(raw, "gitarrenplan-rohdaten.json", "application/json");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "button btn-secondary";
    close.textContent = "Hinweis schließen";
    close.onclick = () => {
      safeSetItem(dismissKey, "1");
      row.remove();
      notice.hidden = !notice.childElementCount;
    };
    row.append(message, download, close);
    notice.append(row);
  });
  if (notice) notice.hidden = !notice.childElementCount;
  const unsubscribe = subscribe((event) => {
    if (event.type !== "change" || event.commandType?.startsWith("external/")
      || event.commandType === "plan/select") return;
    const count = Number(safeGetItem(BACKUP_CHANGES)) || 0;
    if (count < REMINDER_THRESHOLD) safeSetItem(BACKUP_CHANGES, String(count + 1));
    updateBackupStatus();
  });
  return () => {
    unsubscribe();
    dismiss?.removeEventListener("click", closeReminder);
    notice?.replaceChildren();
  };
}
