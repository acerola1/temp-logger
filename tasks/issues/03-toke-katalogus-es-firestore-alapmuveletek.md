# Tőkekatalógus és Firestore-alapműveletek

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 02

## Cél

A tőkék production olvasása, létrehozása és szerkesztése kerüljön egy szándék-alapú
catalog interface mögé, Firebase-részletek kiszivárgása nélkül.

## Scope

- realtime, publikus `vines` lekérdezés és Firestore → domain leképezés
- `createVine` és `editVine` parancs
- automatikus, pozitív, nem szerkeszthető sorszám kiosztása
- szerveroldali `createdAt` és `updatedAt`
- külön tőke-címkejavaslati készlet
- opcionális, navigációs jellegű `sourceCuttingId`
- loading-, mutation-, progress- és hibaállapotot rejtő `useVineCatalog`

Az elfogadott egyszerűsítés szerint a következő sorszám a betöltött tőkék legnagyobb
sorszáma plusz egy; a felület nem kínál végleges tőketörlést.

## Elfogadási kritériumok

- [x] Publikus felhasználó realtime olvashatja a tőkéket.
- [x] Admin a kötelező minimumadatokkal létrehozhat tőkét, amely alapértelmezésben
      aktív és automatikus sorszámot kap.
- [x] Korábban kiosztott sorszámot a normál alkalmazásfolyamat nem használ újra, és
      szerkesztés nem változtatja meg a sorszámot vagy a létrehozási időt.
- [x] A catalog teljes `EditVineInput`-ot fogad, nem `Partial<Vine>` értéket.
- [x] Tőke- és eseménymódosításra alkalmas, beágyazott `events` tömböt tartalmazó
      Firestore-leképezés készül.
- [x] A forrásdugvány linkjének mentése nem hoz létre tőkét, nem másol és nem
      szinkronizál adatot.
- [x] Törölt vagy nem elérhető forrásdugvány kezelhető domain/UI hiba nélkül.
- [x] A tőkecímke-javaslatok csak a tőkék címkéiből származnak.
- [x] Az implementációt Firebase Emulator Suite integrációs tesztek fedik.

## Érintett terület

- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- emulator seed és integrációs tesztek

## Nem része

- eseményfotók Storage-kezelése
- lista, adatlap és űrlap megjelenítése

## Comments

- Megvalósítva TDD-ben a catalog/firestore seam-en; ellenőrzés:
  `npm run build`, `npm test`, `npm run test:integration`.
