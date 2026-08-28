# Gitarrenplan

Eine browserbasierte, druckfreundliche Übersicht für Gitarrenunterricht. Pläne, Gruppen und Schüler werden ausschließlich im Local Storage des jeweiligen Browsers gespeichert. Es gibt keinen Server und keine externen Abhängigkeiten.

## Funktionen

- Mehrere Pläne anlegen, duplizieren, löschen, leeren und zurücksetzen
- Gruppen und Schüler verwalten, verschieben, sortieren und direkt in der Vorschau bearbeiten
- Bis zu zehn Änderungen rückgängig machen
- Einzelne oder alle Pläne als JSON exportieren und wieder importieren
- A4-optimierte Druckansicht mit automatischem Seitenumbruch
- Responsive Bearbeitungsansicht für kleinere Bildschirme

## Projektstruktur

~~~text
gitarrenplan/
├── index.html                  # Semantisches Dokument und Einstiegspunkt
├── css/
│   └── styles.css              # Layout, Komponenten, Druck- und Mobile-Stile
├── js/
│   ├── app.js                  # Initialisierung und Zusammensetzen der Anwendung
│   ├── config.js               # Konfiguration und Standardwerte
│   ├── state.js                # Zentraler Laufzeit-Zustand
│   ├── storage.js              # Local-Storage-Laden, -Migration und -Speichern
│   ├── utils.js                # Reine Hilfsfunktionen
│   ├── render.js               # Erzeugt die Druckvorschau und Auswahlfelder
│   ├── ui/
│   │   └── feedback.js         # Modal- und Toast-Komponenten
│   └── features/
│       ├── data-transfer.js    # JSON-Import und -Export
│       ├── editor.js           # Formularfelder der Planverwaltung
│       ├── history.js          # Undo-Verlauf
│       ├── plan-actions.js     # Plan anlegen, duplizieren, löschen, leeren
│       └── schedule-actions.js # Gruppen, Schüler und Inline-Bearbeitung
└── .gitignore
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

## Daten und Datenschutz

Die eingegebenen Namen werden im Browser gespeichert. Nutze Exportieren, um vor einem Browserwechsel oder dem Löschen von Browserdaten eine JSON-Sicherung anzulegen. Importieren fügt diese Daten wieder lokal hinzu.

## Auf GitHub veröffentlichen

Die App ist eine rein statische Website und kann direkt über GitHub Pages ausgeliefert werden. In den Repository-Einstellungen unter Pages den Branch main und den Ordner /(root) wählen.
