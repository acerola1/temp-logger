# Tőkejogosultságok, végponttól végpontig tesztek és prototípus-takarítás

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 03, 04, 05, 06, 07

## Cél

A teljes tőkekövetés kapjon adattárolási jogosultsági védelmet, végponttól végpontig
regressziós teszteket, majd kerüljenek ki a production ágból a prototípus-only
részek.

## Scope

- Firestore és Storage szabályok
- publikus olvasás, admin-only írás kikényszerítése nemcsak a UI-ban
- emulator seed és Playwright E2E lefedettség
- a throwaway prototípus vizuális összehasonlítása a kész production UI-val
- mock adatok, prototípus-admin kapcsoló és régi top-level tőkemodulok eltávolítása

## Megjelenési referencia

Ez részben UI-issue: a végső E2E és screenshot ellenőrzésben a production lista,
adatlap, létrehozó/szerkesztő és eseményállapotok megjelenésének a jóváhagyott
UI-prototípust kell követnie desktopon és mobilon.

## Elfogadási kritériumok

- [x] `vines/{vineId}` publikus read és admin-only create/update/delete szabályt kap.
- [x] A `vines/{vineId}/events/{eventId}/photos/{fileName}` Storage útvonal publikus
      read és admin-only write/delete szabályt kap.
- [x] Emulatoros negatív teszt bizonyítja, hogy nem admin közvetlen Firestore- és
      Storage-írása elutasításra kerül.
- [x] E2E teszt fedi a publikus listát/adatlapot, admin létrehozást és szerkesztést,
      keresést/szűrést/rendezést, dugványlinket, egy- és többtőkés eseményt,
      fotófeltöltést/törlést és megszűnés/visszaállítás folyamatot.
- [x] E2E teszt fedi a közvetlen detail URL-t, böngésző-visszát és a desktop/mobil
      használatot.
- [x] A releváns autentikációs, admin-, adat-, loading-, üres- és hibaállapotokat
      a prototípussal azonos viewporton reprodukált DOM-ellenőrzés és screenshot
      validálja.
- [x] A production belépési pont kizárólag a feature `VinesPage` exportját használja;
      az `App` nem ismer domain- vagy Firebase-részleteket.
- [x] A `useMockVines`, mock seed UI, prototípus-admin kapcsoló, prototípusjelölések
      és felülírt production komponensek kikerülnek.
- [x] A build, lint, unit/integrációs és teljes E2E suite zöld.

## Érintett terület

- `firestore.rules`
- `storage.rules`
- `dashboard/scripts/seed-e2e-data.mjs`
- `dashboard/e2e/`
- prototípus-only `dashboard/src/components/`, `dashboard/src/hooks/`,
  `dashboard/src/data/` és `dashboard/src/types/` fájlok

## Comments

- 2026-08-03: Az autentikált nem-admin közvetlen Firestore- és Storage-írásának
  tiltását emulatoros integrációs teszt igazolja.
- 2026-08-03: A throwaway tőkeprototípus komponensei, mock tárolója, régi domain-
  és űrlaptípusai eltávolítva; az `App` kizárólag a feature exportját használja.
- 2026-08-03: Ellenőrzés: unit tesztek (27/27), lint, production build, integrációs
  tesztek (13/13) és teljes Playwright E2E (18/18), desktop/mobil screenshotokkal.
