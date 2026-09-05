export function mountAppFixture() {
  document.body.innerHTML = `
    <main id="app-shell">
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
    <fieldset id="studentForm" aria-describedby="studentFormHint">
      <select id="groupSelect"></select>
      <input id="studentName" type="text">
      <input id="studentClass" type="text">
      <button id="addStudentBtn" type="button">Schüler hinzufügen</button>
      <p id="studentFormHint" class="hidden"></p>
    </fieldset>
    <button id="undoBtn" type="button"></button>
    <button id="printBtn" type="button">Drucken</button>
    <button id="exportBtn" type="button">Export</button>
    <button id="importBtn" type="button">Import</button>
    <input id="importFile" type="file">
    <section id="pages"></section>
    </main>
    <div id="toast-container"></div>
    <div id="modal-overlay" class="hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message" tabindex="-1">
      <h3 id="modal-title"></h3>
      <p id="modal-message"></p>
      <input id="modal-input" class="hidden">
      <select id="modal-select" class="hidden"></select>
      <button id="modal-cancel" class="button btn-secondary" type="button"></button>
      <button id="modal-confirm" class="button btn-primary" type="button"></button>
    </div>
  `;
}
