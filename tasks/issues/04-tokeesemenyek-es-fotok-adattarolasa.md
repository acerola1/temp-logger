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

- [ ] Egy esemény egy vagy több aktív tőkéhez hozzáadható; minden tőke saját,
      később külön szerkeszthető eseményazonosítót kap.
- [ ] 400-nál több célpont még feltöltés előtt érthető hibát eredményez.
- [ ] A fotók a
      `vines/{vineId}/events/{eventId}/photos/{photoId}.{extension}` útvonalra
      kerülnek, és a Firestore-ban megvan a szükséges metaadatuk.
- [ ] Több tőkés eseménynél egy példány törlése nem töri el más tőke fotóit.
- [ ] Sikertelen Firestore-írás után az adott művelet feltöltései best-effort módon
      törlődnek.
- [ ] Eseménytörlés előbb eltávolítja a publikus rekordot, majd best-effort törli
      annak Storage-objektumait.
- [ ] `ceased` esemény létrehozása ugyanabban a tőkefrissítésben megszűnt állapotot
      állít; szerkesztése vagy törlése nem aktiválja újra a tőkét.
- [ ] Esemény szerkesztése a típust, időpontot, címet és jegyzetet módosítja; a
      meglévő fotók egyenkénti módosítása nem része ennek a verziónak.
- [ ] Minden érintett tőke `updatedAt` értéke frissül.
- [ ] Emulatoros integrációs teszt fedi az egy- és többtőkés írást, a fotó-életciklust
      és a megszűnési átmenetet.

## Érintett terület

- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- kapcsolódó emulatoros tesztek

## Comments

