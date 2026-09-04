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
