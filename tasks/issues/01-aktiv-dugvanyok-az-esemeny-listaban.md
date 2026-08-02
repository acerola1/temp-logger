# Az új esemény "Érintett dugványok" listája csak aktív egyedeket mutasson

Feature: cuttings-tracking
Type: bug
Status: needs-triage
Blocked by: -

## Probléma

A dugványos fülön, a részletes nézet **Esemény napló → Új esemény** űrlapján az
"Érintett dugványok" checkbox-lista minden dugványt felsorol, függetlenül az állapotától.
Így `lost` (elpusztult) és `archived` (archivált) egyedek is kiválaszthatók, sőt a **Mind**
gomb be is jelöli mindet.

Ez két gondot okoz:

- olyan egyedekre kerül új esemény, amelyek már ki vannak vezetve a nyilvántartásból
- a lista feleslegesen hosszú, a szezon során folyamatosan hízik

A lista forrása a `cuttings` prop, amit a [CuttingsPage.tsx](../../dashboard/src/components/CuttingsPage.tsx)
szűrés nélkül ad át (a `statusFilter` csak a listanézetre hat).

## Elvárt működés

- az "Érintett dugványok" listában csak `status === 'active'` dugványok jelenjenek meg
- a **Mind** gomb is csak az aktív egyedeket jelölje ki
- a mentés gomb számlálója (`Esemény mentése (N)`) ezzel konzisztens legyen
- ha nincs egyetlen aktív dugvány sem, a lista helyén legyen érthető üres állapot,
  ne néma üres box

## Elfogadási kritériumok

- [x] `lost` és `archived` státuszú dugvány nem szerepel a listában
- [x] a **Mind** gomb kijelölése után a kiválasztott azonosítók között nincs nem-aktív egyed
- [x] egy dugvány archiválása után (az űrlap `archive` checkbox-a) újranyitott űrlapon már
      nem szerepel a listában
- [x] a meglévő tömeges mentés viselkedése egyébként nem változik

## Érintett fájlok

- [dashboard/src/components/CuttingDetail.tsx](../../dashboard/src/components/CuttingDetail.tsx) — a lista és a **Mind** gomb (kb. 500–545. sor)
- [dashboard/src/components/CuttingsPage.tsx](../../dashboard/src/components/CuttingsPage.tsx) — itt dől el, milyen `cuttings` megy le a detail nézetbe

## Nyitott kérdés

Mi történjen, ha az éppen megnyitott dugvány maga nem aktív (pl. archivált egyedet nyitunk
meg)? Feltételezés a fenti kritériumokban: az aktuálisan megnyitott dugvány mindig
megjelenik a listában, státusztól függetlenül — különben a saját eseménynaplója sem
bővíthető. Ha ez nem kívánt, a kritériumokat pontosítani kell.

## Comments

### 2026-08-02 — implementálva

A szűrés a `CuttingDetail`-ben történik, nem a `CuttingsPage`-ben: a detail nézetnek
ismernie kell a megnyitott egyedet is, ezért a `cuttings` prop változatlan marad.

- `eventTargetCuttings`: `status === 'active'`, plusz a most megnyitott dugvány
  (a nyitott kérdésnél leírt feltételezés szerint). A nem aktív egyed mellett
  státusz badge jelzi, miért van ott.
- `selectedTargetIds`: a kijelölés render közben szűrve a listában szereplő
  azonosítókra, így a `Esemény mentése (N)` számláló és a mentés is konzisztens,
  ha egy dugvány közben kikerült az aktívak közül.
- a **Mind** gomb és a `handleAddEvent` is `eventTargetCuttings`-ből dolgozik.
- üres állapot: "Nincs aktív dugvány, amire eseményt lehetne rögzíteni." — a fenti
  feltételezés mellett védőhálónak számít, mert a megnyitott egyed mindig szerepel.

Teszt: `dashboard/e2e/cutting-event-targets.spec.ts` (2 eset). A javítás nélkül
mindkettő elhasal, vele a teljes e2e suite zöld (9/9).
