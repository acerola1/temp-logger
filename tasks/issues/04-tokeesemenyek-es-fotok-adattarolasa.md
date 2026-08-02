# Tőkeesemények és eseményfotók adattárolása

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 03

## Cél

A catalog valósítsa meg az események hozzáadását, szerkesztését és törlését,
beleértve a több tőkés rögzítést és a fotók robusztus Storage-életciklusát.

## Scope

- `addEvents`, `editEvent` és `deleteEvent` szándék-alapú parancsok
- beágyazott eseménytömb biztonságos read–modify–write kezelése
- legfeljebb 400 céltőke egy műveletben
- tőkénként önálló eseménypéldány és önálló fotóobjektumok
- legfeljebb 1000 px-es kliensoldali kép-előkészítés
- feltöltési progress és részleges hibák kompenzálása
- `ceased` esemény állapotátmenete

## Elfogadási kritériumok

- [x] Egy esemény egy vagy több aktív tőkéhez hozzáadható; minden tőke saját,
      később külön szerkeszthető eseményazonosítót kap.
- [x] 400-nál több célpont még feltöltés előtt érthető hibát eredményez.
- [x] A fotók a
      `vines/{vineId}/events/{eventId}/photos/{photoId}.{extension}` útvonalra
      kerülnek, és a Firestore-ban megvan a szükséges metaadatuk.
- [x] Több tőkés eseménynél egy példány törlése nem töri el más tőke fotóit.
- [x] Sikertelen Firestore-írás után az adott művelet feltöltései best-effort módon
      törlődnek.
- [x] Eseménytörlés előbb eltávolítja a publikus rekordot, majd best-effort törli
      annak Storage-objektumait.
- [x] `ceased` esemény létrehozása ugyanabban a tőkefrissítésben megszűnt állapotot
      állít; szerkesztése vagy törlése nem aktiválja újra a tőkét.
- [x] Esemény szerkesztése a típust, időpontot, címet és jegyzetet módosítja; a
      meglévő fotók egyenkénti módosítása nem része ennek a verziónak.
- [x] Minden érintett tőke `updatedAt` értéke frissül.
- [x] Emulatoros integrációs teszt fedi az egy- és többtőkés írást, a fotó-életciklust
      és a megszűnési átmenetet.

## Érintett terület

- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- kapcsolódó emulatoros tesztek

## Comments

- Megvalósítva a catalog `addEvents`, `editEvent` és `deleteEvent` parancsait
  tranzakciós Firestore read–modify–write-tal, 400-as célpontlimittel, Storage
  kompenzációval és feltöltési progress-szel.
- Elkészült a `vineEventPhotos` adapter, a tőkénként izolált Storage-útvonal és
  a `vines/.../events/.../photos/...` publikus olvasás/admin írás szabálya.
- Ellenőrzés: `npm test` (26 teszt), `npm run test:integration` (11 teszt),
  `npm run lint`, `npm run build`.
