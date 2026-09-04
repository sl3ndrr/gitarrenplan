export function mountAppFixture() {
  document.body.innerHTML = `
    <select id="planSelect"></select>
    <input id="planName" type="text">
    <input id="metaTitle" type="text">
    <input id="metaTeacher" type="text">
    <input id="metaLocation" type="text">
    <input id="metaTerm" type="text">
    <input id="minRows" type="number">
    <button id="newPlanBtn" type="button">Neu</button>
    <button id="duplicatePlanBtn" type="button">Duplizieren</button>
    <button id="deletePlanBtn" type="button">Löschen</button>
    <button id="clearPlanBtn" type="button">Leeren</button>
    <button id="resetBtn" type="button">Zurücksetzen</button>
    <select id="newGroupDay">
      <option value="">Kein Wochentag</option>
      <option value="Montag">Montag</option>
      <option value="Dienstag">Dienstag</option>
    </select>
    <input id="newGroupTime" type="text">
    <button id="addGroupBtn" type="button">Gruppe hinzufügen</button>
    <select id="groupSelect"></select>
    <input id="studentName" type="text">
    <input id="studentClass" type="text">
    <button id="addStudentBtn" type="button">Schüler hinzufügen</button>
    <button id="undoBtn" type="button"></button>
    <button id="printBtn" type="button">Drucken</button>
    <button id="exportBtn" type="button">Export</button>
    <button id="exportAllBtn" type="button">Alle exportieren</button>
    <button id="importBtn" type="button">Import</button>
    <input id="importFile" type="file">
    <section id="pages"></section>
    <div id="toast-container"></div>
    <div id="modal-overlay" class="hidden">
      <h3 id="modal-title"></h3>
      <p id="modal-message"></p>
      <input id="modal-input" class="hidden">
      <select id="modal-select" class="hidden"></select>
      <button id="modal-cancel" type="button"></button>
      <button id="modal-confirm" type="button"></button>
    </div>
  `;
}

