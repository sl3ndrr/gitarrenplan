# State-, Command- und Rendering-Architektur

Die Anwendung bleibt eine statische Vanilla-JavaScript-Anwendung. Fachliche
Änderungen laufen ab Phase 2 ausschließlich durch den Store in `js/state.js`.

## Öffentliche State-Schnittstellen

- `getState()`, `getPlans()` und `getActivePlan()` liefern tiefe Kopien.
  Interne Store-Objekte können daher nicht außerhalb des Stores verändert
  werden.
- `dispatch({ type, payload })` führt einen benannten Command aus.
- `subscribe(listener)` meldet bestätigte Änderungen, Undo-Änderungen,
  Fehler und Mehrtab-Konflikte. Die Rückgabe entfernt den Listener.
- `runUndoable(label, mutation, options)` ist die zentrale Transaktion für
  Validierung, genau einen V3-Schreibvorgang, Undo und Benachrichtigung.
- `undo()` stellt `plans`, `activePlanId` und `minRows` gemeinsam wieder
  her. Ein fehlgeschlagener Schreibvorgang verändert weder State noch Stack.

Die Handler in `js/commands.js` enthalten die fachlichen Mutationen für
Pläne, Metadaten, Mindestzeilen, Gruppen, Schüler und Import. Feature-Module
übersetzen nur noch DOM-Ereignisse in Commands und koordinieren Dialoge.

## Texteingaben und Undo

`js/ui/text-edit.js` gruppiert eine Bearbeitung anhand eines stabilen Keys.
Fortlaufende `input`-Ereignisse werden 300 ms verzögert gespeichert; mehrere
Zwischenstände teilen denselben Undo-Snapshot. `change`, Enter,
`visibilitychange`, `pagehide` und Drucken schließen die Bearbeitung
sofort ab. Escape persistiert den Originalwert und entfernt den zugehörigen
Undo-Schritt erst nach erfolgreichem Schreiben.

Inline-Felder sind native einzeilige Inputs. Schüler werden ausschließlich
über ihre stabile ID adressiert. Für den Druck enthält das Markup getrennte
Text-Spans; die Inputs werden dort ausgeblendet.

## Rendering

`requestRender(scope)` vereinigt Render-Anforderungen und plant höchstens
einen `requestAnimationFrame`. Strukturelle State-Änderungen werden weiterhin
sofort persistiert; nur die DOM-Aktualisierung wird gebündelt.
`flushRender()` führt einen geplanten Render synchron aus, insbesondere vor
dem Drucken und beim Verlassen der Seite.

Seiten entstehen zunächst in einem `DocumentFragment`. Die Scopes
`pages`, `planSelect`, `groupSelect` und `editor` verhindern unnötige
Teil-Updates. Select-Optionen tragen zusätzlich eine Inhaltssignatur und
werden nur ersetzt, wenn Werte oder Beschriftungen tatsächlich wechseln.

## Mehrtab-Schutz

Jeder erfolgreiche Schreibvorgang erhöht `revision` und setzt `updatedAt`.
Vor lokalen Writes wird der gespeicherte V3-State erneut gelesen. Eine neuere
Revision wird daher nicht still überschrieben.

Ein valides neueres `storage`-Event wird ohne offene lokale Bearbeitung
direkt übernommen, ohne erneut zu speichern. Bei einer offenen Bearbeitung
wird ein Konflikt gemeldet. Die Benutzerin oder der Benutzer entscheidet
zwischen:

- externer Version: übernehmen, lokale Bearbeitung und Undo-Historie verwerfen;
- lokaler Version: vor dem Schreiben nochmals auf eine noch neuere externe
  Revision prüfen und anschließend mit einer höheren Revision speichern.

Alle von Features registrierten Timer und Listener liefern bzw. besitzen
kontrollierte Cleanup-Pfade.

## Kompatibilitätsadapter

Die Selektoren `getPlans()` und `getActivePlan()` bleiben unter ihren
bisherigen Namen verfügbar, liefern nun aber sichere Snapshots.
`storage.commitState(mutator, storage)` bleibt als nicht-undoender
Phase-1-Adapter erhalten und delegiert an dieselbe atomare Transaktion; neue
Features dürfen nur `dispatch()` verwenden.
`render()`, `renderPlanSelect()`, `renderGroupSelect()` und
`updateEditorValues()` bleiben synchrone Einstiegspunkte. Auch der bisherige
Aufruf `render(preferredGroupId)` wird weiterhin akzeptiert. Datenmigration
und Importformate sind in `DATENFORMAT.md` beschrieben.
