# Datenformat und Grenzen

Die Anwendung speichert den vollständigen Zustand atomar unter
`gitarrenunterricht_state_v3`. Das Objekt hat diese Form:

```json
{
  "version": 3,
  "revision": 12,
  "updatedAt": "2026-09-04T12:00:00.000Z",
  "plans": [],
  "activePlanId": "…",
  "minRows": 6
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

## Harte Grenzen

| Bereich | Höchstwert |
| --- | ---: |
| JSON-Importdatei | 2 MiB (2.097.152 Bytes) |
| Pläne | 50 |
| Gruppen je Plan | 100 |
| Schüler je Gruppe | 100 |
| Schüler insgesamt | 5.000 |
| Plan- und Personennamen | 80 Zeichen |
| Andere Text-Metadaten | 160 Zeichen |

Alle Textfelder werden als einzeilige Strings normalisiert. Zeilenumbrüche
werden durch Leerzeichen ersetzt, skalare Zahlen und Wahrheitswerte sicher in
Strings umgewandelt und Objektwerte durch den jeweiligen Standardwert ersetzt.
Fehlende oder doppelte Plan-, Gruppen- und Schüler-IDs werden durch neue IDs
ersetzt.

## Migration und Import

Beim Start wird zuerst der V3-State gelesen. Falls er fehlt oder beschädigt
ist, werden die bisherigen V2-Schlüssel für Pläne und aktiven Plan bzw. die
V1-Schlüssel für Metadaten und Gruppen übernommen. Alte Schlüssel werden nur
gelöscht, wenn der vollständige V3-State erfolgreich gespeichert wurde.

Der Import akzeptiert weiterhin:

- Einzelexporte vom Typ `gitarrenunterricht-plan` in Version 1 oder 2,
- Gesamtexporte vom Typ `gitarrenunterricht-plans` in Version 1 oder 2,
- unverpackte Legacy-Einzelpläne mit `meta` oder `groups`,
- Legacy-Listen aus mehreren Plänen.

Unbekannte Typen, zukünftige Versionen und strukturell ungültige Daten werden
vor einer Änderung des App-Zustands abgelehnt.

## Export

Die Oberfläche erzeugt ausschließlich einen Gesamtexport vom Typ
`gitarrenunterricht-plans`. Er enthält alle Pläne sowie `version` und
`exportedAt` und wird als `gitarrenplan_sicherung_YYYY-MM-DD.json`
heruntergeladen. Der frühere Einzelplan-Export wird nicht mehr angeboten; sein
Format bleibt wie oben beschrieben vollständig importierbar.
