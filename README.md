# Gitarrenplan

Eine browserbasierte, druckfreundliche Übersicht für Gitarrenunterricht. Pläne, Gruppen und Schüler werden ausschließlich im Local Storage des jeweiligen Browsers gespeichert. Es gibt keinen Server und keine Runtime-Abhängigkeiten.

## Funktionen

- Mehrere Pläne anlegen, duplizieren, löschen, leeren und zurücksetzen
- Gruppen und Schüler verwalten, verschieben, sortieren und direkt in der Vorschau bearbeiten
- Bis zu zehn Änderungen rückgängig machen
- Alle Pläne mit einem Klick als bearbeitbare JSON-Sicherung exportieren und wieder importieren
- A4-optimierte Druckansicht mit automatischem Seitenumbruch
- Responsive Bearbeitungsansicht für kleinere Bildschirme

## Projektstruktur

~~~text
gitarrenplan/
├── index.html                  # Semantisches Dokument und Einstiegspunkt
├── css/
│   ├── tokens.css              # Farben, Abstände und gemeinsame Designwerte
│   ├── base.css                # Reset, Dokumentbasis, Fokus und Buttons
│   ├── editor.css              # Editor, Aktionen, Dialog und Toasts
│   ├── preview.css             # Semantische Bildschirm-/Dokumentvorschau
│   ├── print.css               # Ausschließliches A4-Drucklayout
│   └── responsive.css          # Bildschirm-Breakpoints und reduzierte Bewegung
├── js/
│   ├── app.js                  # Initialisierung und Zusammensetzen der Anwendung
│   ├── config.js               # Konfiguration und Standardwerte
│   ├── state.js                # Gekapselter Store, Dispatch, Undo und Mehrtab-Schutz
│   ├── commands.js             # Fachliche Command-Handler
│   ├── storage.js              # Migration und Phase-1-Adapter
│   ├── persistence.js          # Fehlerisolierte V3-Lese-/Schreiboperationen
│   ├── normalization.js        # Zentrale Validierung des Datenvertrags
│   ├── utils.js                # Reine Hilfsfunktionen
│   ├── render.js               # Erzeugt die Druckvorschau und Auswahlfelder
│   ├── ui/
│   │   ├── feedback.js         # Modal- und Toast-Komponenten
│   │   └── text-edit.js        # Debounce und gruppierte Text-Undo-Schritte
│   └── features/
│       ├── data-transfer.js    # JSON-Import und -Export
│       ├── editor.js           # Formularfelder der Planverwaltung
│       ├── history.js          # Undo-Verlauf
│       ├── lifecycle.js        # Print/Pagehide/Storage-Listener
│       ├── plan-actions.js     # Plan-Dialoge und Commands
│       └── schedule-actions.js # Gruppen-, Schüler- und Inline-Events
├── tests/                      # Vitest-/jsdom- und Browser-Regressionstests
└── docs/                       # Datenvertrag und Architektur
~~~

Für spätere Bilder, Logos oder andere statische Dateien kann ein Ordner namens assets direkt im Projektstamm angelegt werden. Da Git leere Ordner nicht versioniert, wird er erst dann eingecheckt, wenn er Inhalt hat.

## Lokal starten

Die Anwendung benötigt keinen Build-Schritt und keine Paketinstallation. Starte im Projektordner einen lokalen Webserver:

~~~bash
python3 -m http.server 8000
~~~

Anschließend im Browser öffnen:

~~~text
http://localhost:8000
~~~

Ein lokaler Server ist für JavaScript-Module nötig; das Öffnen der HTML-Datei per Dateipfad ist nicht vorgesehen.

Qualitätssicherung nutzt ausschließlich Dev-Abhängigkeiten:

~~~bash
npm install
npm test
npm run test:browser
~~~

## Daten und Datenschutz

Die eingegebenen Namen werden im Browser gespeichert. **Exportieren** lädt immer sämtliche Pläne inklusive Formatversion und Exportzeitpunkt als Datei `gitarrenplan_sicherung_YYYY-MM-DD.json` herunter. Diese JSON-Datei ist die bearbeitbare Datensicherung für einen Browserwechsel oder das Löschen von Browserdaten; **Importieren** fügt sie wieder lokal hinzu. Historische Einzelplan- und Gesamtplan-Exporte bleiben importierbar.

**Drucken / PDF** ist davon getrennt: Diese Aktion erzeugt das aktuell sichtbare Dokument über den Druckdialog des Browsers. Eine PDF-Datei ist eine Darstellung zum Lesen und Drucken, keine Datensicherung zum erneuten Bearbeiten.

## Auf GitHub veröffentlichen

Die App ist eine rein statische Website und kann direkt über GitHub Pages ausgeliefert werden. In den Repository-Einstellungen unter Pages den Branch main und den Ordner /(root) wählen.
