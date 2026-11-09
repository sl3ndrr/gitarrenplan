# Datenformat und Grenzen

Die Anwendung speichert den vollständigen Zustand atomar unter
`gitarrenunterricht_state_v3`. Das Objekt hat diese Form:

```json
{
  "version": 4,
  "revision": 12,
  "updatedAt": "2026-09-04T12:00:00.000Z",
  "plans": [],
  "activePlanId": "…"
}
```

Ein Commit normalisiert und validiert zunächst eine Kopie des aktuellen
Zustands. Erst danach wird der vollständige Zustand mit genau einem
`localStorage.setItem` geschrieben. Schlägt Validierung, Serialisierung oder
Speicherung fehl, bleibt der Laufzeit-Zustand unverändert.

Jeder erfolgreiche lokale Schreibvorgang erhöht `revision` und aktualisiert
`updatedAt`. Vor einem Write wird ein bereits gespeicherter neuerer Zustand
erkannt. Valide neuere Zustände aus dem `storage`-Event werden automatisch
übernommen, solange keine lokale Texteingabe offen ist; andernfalls wird eine
explizite Konfliktentscheidung verlangt.

## Plan-Gestaltung

Jeder Plan kann zusätzlich zur `meta`-Struktur eine planweite
`appearance`-Struktur enthalten:

```json
{
  "colorIntensity": 100,
  "showOccupancy": true,
  "titleBoxPadding": 20
}
```

- `colorIntensity` ist ein ganzzahliger Prozentwert von 0 bis 100.
- `showOccupancy` steuert die Belegungsanzeige in sämtlichen Gruppen des Plans.
- `titleBoxPadding` ist der vertikale Innenabstand der Titel-Farbbox in Pixeln
  und liegt zwischen 0 und 48.

Fehlende Gestaltungswerte werden beim Laden alter Daten mit den Standardwerten
ergänzt; dadurch bleiben bestehende Sicherungen ohne Migration nutzbar.

## Ausgabeformat und Gruppenzeiten

`plan.layout` speichert diese Einstellungen pro Plan:

| Feld | Werte | Standard |
| --- | --- | --- |
| `minRows` | 0–20 | 6 |
| `orientation` | `portrait`, `landscape` | `portrait` |
| `output` | `groups`, `week`, `attendance` | `groups` |
| `attendanceColumns` | 8–12 Datumsspalten | 10 |
| `showNotes` | Notizspalte bei Gruppenplan und Anwesenheitsliste | `false` |
| `showUpdatedAt` | Letzte Planänderung in der Fußzeile | `true` |
| `monochrome` | Preset für S/W-Druck | `false` |

`plan.updatedAt` ist der ISO-Zeitpunkt der letzten inhaltlichen Änderung.
Bei älteren Daten ohne Planzeitpunkt dient der gespeicherte App-Zeitpunkt
als Ausgangswert. Undo und Redo stellen den Zeitstempel des jeweiligen
Snapshots wieder her.

Gruppen speichern `day`, `time`, `start`, `end` und `label`. Zeitgrenzen
verwenden `HH:MM` oder einen leeren String. Eindeutige alte Zeitintervalle
werden beim Laden aufgeteilt. Freie Angaben bleiben als Bezeichnung und
Anzeige erhalten. Gängige Abkürzungen werden auf Wochentagsnamen abgebildet.

Letzter Export, Sicherungserinnerung, Zoom und Editorbereiche sind
Geräteeinstellungen mit eigenen Local-Storage-Schlüsseln.

## Harte Grenzen

| Bereich | Höchstwert |
| --- | ---: |
| JSON-Importdatei | 2 MiB (2.097.152 Bytes) |
| Pläne | 50 |
| Gruppen je Plan | 100 |
| Teilnehmende je Gruppe | 100 |
| Teilnehmende insgesamt | 5.000 |
| Plan- und Personennamen | 80 Zeichen |
| Andere Text-Metadaten | 160 Zeichen |

Alle Textfelder werden als einzeilige Strings normalisiert. Zeilenumbrüche
werden durch Leerzeichen ersetzt, skalare Zahlen und Wahrheitswerte sicher in
Strings umgewandelt und Objektwerte durch den jeweiligen Standardwert ersetzt.
Fehlende oder doppelte Plan-, Gruppen- und Teilnehmenden-IDs werden durch neue IDs
ersetzt.

## Migration und Import

Der bestehende Schlüssel bleibt für den Mehrtab-Schutz erhalten. Version 4
speichert Mindestzeilen als `plan.layout.minRows` (0–20, Standard 6). Beim
Laden von V3 wird der globale Wert in alle Pläne übernommen. Für V2- und
V1-Schlüssel gilt dieselbe Migration. Alte Schlüssel werden erst nach
erfolgreichem Speichern gelöscht. Defekte Rohdaten werden zuvor unter
`<Schlüssel>_defekt_<Zeitstempel>_…` gesichert. Einzelne defekte Gruppen
oder Teilnehmende werden beim Laden übersprungen und gemeldet. Neuere
Zustände bleiben unverändert, und Schreibzugriffe sind solange gesperrt.

Der Import akzeptiert weiterhin:

- Einzelexporte vom Typ `gitarrenunterricht-plan` in Version 1, 2 oder 3,
- Gesamtexporte vom Typ `gitarrenunterricht-plans` in Version 1, 2 oder 3,
- unverpackte Legacy-Einzelpläne mit `meta` oder `groups`,
- Legacy-Listen aus mehreren Plänen.

Unbekannte Typen, zukünftige Versionen und strukturell ungültige Daten werden
vor einer Änderung des App-Zustands abgelehnt.

## Export

Die Oberfläche erzeugt ausschließlich einen Gesamtexport vom Typ
`gitarrenunterricht-plans`. Er enthält alle Pläne inklusive Mindestzeilen sowie `version: 3` und
`exportedAt` und wird als `gitarrenplan_sicherung_YYYY-MM-DD.json`
heruntergeladen. Der frühere Einzelplan-Export wird nicht mehr angeboten; sein
Format bleibt wie oben beschrieben vollständig importierbar.
