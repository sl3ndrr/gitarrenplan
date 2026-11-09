# Gitarrenplan

Eine browserbasierte, druckfreundliche Übersicht für Gitarrenunterricht. Pläne, Gruppen und Teilnehmende werden ausschließlich im Local Storage des jeweiligen Browsers gespeichert. Es gibt keinen Server und keine Runtime-Abhängigkeiten.

## Funktionen

- Pläne anlegen, duplizieren, leeren und zurücksetzen
- Gruppen nach Wochentag und Uhrzeit sortieren, Personen nach Namen oder Nachnamen
- Teilnehmende im Editor, direkt in der Gruppe oder zeilenweise aus der Zwischenablage hinzufügen
- Gruppen und Teilnehmende mit der Maus ziehen oder über die Aktionsmenüs verschieben
- Bis zu zehn Änderungen rückgängig machen und wiederholen
- Alle Pläne als JSON sichern, bei einem Import hinzufügen oder komplett ersetzen
- A4-Gruppenplan, Wochenübersicht oder Anwesenheitsliste im Hoch- oder Querformat
- Zoom, Seitenauswahl, Doppelseite und Übersicht mit Belegung, Duplikaten, Zeitkonflikten und Sicherungsstatus

## Projektstruktur

~~~text
gitarrenplan/
├── index.html                  # Semantisches Dokument und Einstiegspunkt
├── css/
│   ├── tokens.css              # Farben, Abstände und gemeinsame Designwerte
│   ├── base.css                # Reset, Dokumentbasis, Fokus und Buttons
│   ├── editor.css              # Editor, Aktionen, Dialog und Toasts
│   ├── preview.css             # Semantische Bildschirm-/Dokumentvorschau
│   ├── print.css               # Physisches Seitenformat und Druck-Shell
│   ├── print-layout.css        # Gemeinsame Regeln für Druck und genaue Vorschau
│   ├── motion.css              # Bewegungen bei erlaubter Animation
│   └── responsive.css          # Bildschirm-Breakpoints und reduzierte Bewegung
├── js/
│   ├── app.js                  # Initialisierung und Zusammensetzen der Anwendung
│   ├── config.js               # Konfiguration und Standardwerte
│   ├── state.js                # Gekapselter Store, Dispatch, Undo, Redo und Mehrtab-Schutz
│   ├── commands.js             # Fachliche Command-Handler
│   ├── storage.js              # Migration und Phase-1-Adapter
│   ├── persistence.js          # Fehlerisolierte Lese-/Schreiboperationen
│   ├── normalization.js        # Zentrale Validierung des Datenvertrags
│   ├── pagination.js           # Reine 2×2-/2×3-Paginierung für A4
│   ├── utils.js                # Reine Hilfsfunktionen
│   ├── print-formats.js        # Wochenübersicht und Anwesenheitsliste
│   ├── render.js               # Erzeugt die Planseiten und Auswahlfelder
│   ├── ui/
│   │   ├── feedback.js         # Modal- und Toast-Komponenten
│   │   ├── motion.js           # FLIP, Ein- und Ausblenden
│   │   └── text-edit.js        # Debounce und gruppierte Text-Undo-Schritte
│   └── features/
│       ├── backup-notices.js   # Rohdatenhinweise, Sicherungsdatum und Erinnerung
│       ├── bulk-entry.js       # Vorschau der Sammelerfassung
│       ├── drag-drop.js        # Native Mausaktionen
│       ├── overview.js         # Belegung, Konflikte und Druckprüfung
│       ├── data-transfer.js    # JSON-Import und -Export
│       ├── editor.js           # Formularfelder der Planverwaltung
│       ├── history.js          # Undo-Verlauf
│       ├── lifecycle.js        # Print/Pagehide/Storage-Listener
│       ├── plan-actions.js     # Plan-Dialoge und Commands
│       ├── schedule-actions.js # Gruppen-, Teilnehmende- und Inline-Events
│       └── workspace.js        # Bildschirm-Skalierung und Editorbereiche
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

Die Namen der Teilnehmenden sind personenbezogene Daten. Der Browser speichert
sie lokal. Local Storage gilt für den gesamten Origin. Auf `nutzer.github.io`
teilen sich daher alle Projektseiten dieses Kontos den Speicher. Nutze für
Unterrichtsdaten möglichst eine eigene Domain für diese Anwendung.

**Exportieren** lädt alle Pläne mit Exportversion 3 einschließlich der
planbezogenen Mindestzeilen und Druckeinstellungen herunter. Mit
**Importieren** kannst du die Pläne hinzufügen oder den Bestand ersetzen.
Ein versehentliches Ersetzen kannst du rückgängig machen. Die Anwendung zeigt
den letzten Export und erinnert nach zwölf weiteren Änderungen an eine Sicherung.

Bei beschädigten Daten erhältst du einen Hinweis mit einem Download der
Rohdaten. Ein neueres Speicherformat bleibt erhalten, und Speichern ist bis
zur Verwendung einer passenden App-Version gesperrt.

**Drucken / PDF** gibt das gewählte Ausgabeformat über den Browserdruck aus.
Für eine bearbeitbare Sicherung verwendest du **Exportieren**.

## A4-Drucklayout und Fortsetzungen

Der Gruppenplan verwendet standardmäßig A4 im Hochformat. Pläne mit bis zu vier logischen Gruppen werden auf jeder Seite in einem festen 2×2-Raster dargestellt. Ab fünf logischen Gruppen gilt auf allen Seiten ein festes 2×3-Raster mit höchstens sechs gleich großen Slots. Unbelegte Slots bleiben frei; eine einzelne letzte Gruppe wird harmonisch zentriert, aber niemals auf volle Breite gestreckt.

Passt der Inhalt einer Gruppe nicht lesbar in einen Slot, teilt die Anwendung die echten Teilnehmendedaten auf weitere, gleich große Slots auf. Diese tragen denselben Gruppennamen und den Zusatz **Fortsetzung** und zählen wie jede andere Gruppe als belegter Rasterplatz. Konfigurierte Leerzeilen werden zuerst reduziert; vorhandene Namen werden weder ausgeblendet noch für ein Ein-Seiten-Ergebnis unlesbar verkleinert.

Vor dem Öffnen des Druckdialogs speichert und rendert **Drucken / PDF** alle noch offenen Texteingaben synchron. Editorflächen, Aktionsbuttons, Empty States und Schatten werden nicht in das PDF übernommen. Die Druckseite bleibt 210 × 297 mm groß; die dezente Dokumentrundung bleibt erhalten.

Benachbarte Slots desselben Tages erhalten eine gemeinsame Tagesüberschrift. Bei gemischten Tagen bleiben beide Beschriftungen erhalten; die manuelle Gruppenreihenfolge wird nicht geändert. Tagesfarben haben auch bei freien Tagesnamen eine neutrale Rückfallfarbe.

Die Belegung zeigt `Teilnehmendezahl / max(Teilnehmendezahl, Mindest-Zeilen) Plätze`. Mindest-Zeilen sind keine Obergrenze. Die Kennzahlen zählen logische Gruppen und Teilnehmende jeweils einmal, unabhängig von Fortsetzungssegmenten.

**Genau so wird gedruckt** zeigt das gewählte Format mit den Druckregeln.
**Bearbeiten** und **Vorschau** wechseln auf schmalen Bildschirmen zwischen
den Arbeitsbereichen. Ab 1180 px bleibt die Werkzeugleiste beim Scrollen
sichtbar. Ab 1800 px steht die Übersicht als dritte Spalte zur Verfügung.
Die Doppelseite passt sich im Automatikmodus der verfügbaren Breite an.
Zoom und aufgeklappte Editorbereiche merkt sich dein Browser.

| Kürzel | Aktion |
| --- | --- |
| N | Neue Gruppe |
| S | Zur Namenseingabe |
| Strg/Cmd+Z | Rückgängig |
| Strg/Cmd+Umschalt+Z | Wiederholen |
| Strg/Cmd+P | Eingaben speichern und Druck prüfen |
| Strg/Cmd mit +, − oder Mausrad in der Vorschau | Zoomen |
| ? | Hilfe zu Tastenkürzeln |

Die App-Kürzel greifen außerhalb von Eingabefeldern. Wenn der Druck über
das Browsermenü gestartet wird, kann der Browserdialog nicht von der App
unterbrochen werden. Eine Überlaufmeldung erscheint dann nach dem Schließen.

GitHub Actions führt Lint, Unit- und Browser-Tests sowie den PDF-Test aus.
Die Prüfbelege enthalten Bildschirmansichten von 375 bis 3440 px und die
Druckbeispiele. `npm run test:pdf` benötigt Chromium und Poppler. Für den
historischen Vorher-Vergleich benötigt der Browser-Test Commit `d6898a3`
in der lokalen Git-Historie.

## Auf GitHub veröffentlichen

Die App ist eine rein statische Website und kann direkt über GitHub Pages ausgeliefert werden. In den Repository-Einstellungen unter Pages den Branch main und den Ordner /(root) wählen.

## Mitwirkende

[<img src="https://avatars.githubusercontent.com/u/267193182?s=64&v=4" width="32" height="32" alt="Codex-Profilbild">](https://github.com/codex)

[Codex](https://github.com/codex) hat zu diesem Projekt beigetragen.
