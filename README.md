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
│   ├── pagination.js           # Reine 2×2-/2×3-Paginierung für A4
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
├── scripts/                    # Prüfung und Rendering der Beispiel-PDFs
├── tests/                      # Vitest-/jsdom-, Browser- und PDF-Regressionstests
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
npm run lint
npm run test:unit
npm run test:browser
npm run test:pdf
# oder vollständig:
npm run test:all
~~~

## Daten und Datenschutz

Die eingegebenen Namen werden im Browser gespeichert. **Exportieren** lädt immer sämtliche Pläne inklusive Formatversion und Exportzeitpunkt als Datei `gitarrenplan_sicherung_YYYY-MM-DD.json` herunter. Diese JSON-Datei ist die bearbeitbare Datensicherung für einen Browserwechsel oder das Löschen von Browserdaten; **Importieren** fügt sie wieder lokal hinzu. Historische Einzelplan- und Gesamtplan-Exporte bleiben importierbar.

**Drucken / PDF** ist davon getrennt: Diese Aktion erzeugt das aktuell sichtbare Dokument über den Druckdialog des Browsers. Eine PDF-Datei ist eine Darstellung zum Lesen und Drucken, keine Datensicherung zum erneuten Bearbeiten.

## A4-Drucklayout und Fortsetzungen

Die Druckausgabe verwendet echtes A4-Porträtformat. Pläne mit bis zu vier logischen Gruppen werden auf jeder Seite in einem festen 2×2-Raster dargestellt. Ab fünf logischen Gruppen gilt auf allen Seiten ein festes 2×3-Raster mit höchstens sechs gleich großen Slots. Unbelegte Slots bleiben frei; eine einzelne letzte Gruppe wird harmonisch zentriert, aber niemals auf volle Breite gestreckt.

Passt der Inhalt einer Gruppe nicht lesbar in einen Slot, teilt die Anwendung die echten Schülerdaten auf weitere, gleich große Slots auf. Diese tragen denselben Gruppennamen und den Zusatz **Fortsetzung** und zählen wie jede andere Gruppe als belegter Rasterplatz. Konfigurierte Leerzeilen werden zuerst reduziert; vorhandene Schülernamen werden weder ausgeblendet noch für ein Ein-Seiten-Ergebnis unlesbar verkleinert.

Vor dem Öffnen des Druckdialogs speichert und rendert **Drucken / PDF** alle noch offenen Texteingaben synchron. Editorflächen, Aktionsbuttons, Empty States, Schatten und Rundungen werden nicht in das PDF übernommen.

`npm run test:pdf` erzeugt zwölf repräsentative PDF-Dateien unter `output/pdf`, kontrolliert Seitenzahl und A4-Abmessungen mit Poppler und rendert jede Seite zusätzlich als PNG zur visuellen Abnahme. Dafür müssen `pdfinfo`, `pdftotext` und `pdftoppm` verfügbar sein.

## Auf GitHub veröffentlichen

Die App ist eine rein statische Website und kann direkt über GitHub Pages ausgeliefert werden. In den Repository-Einstellungen unter Pages den Branch main und den Ordner /(root) wählen.
