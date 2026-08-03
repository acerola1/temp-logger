# Tőkeesemény fotóinak utólagos kezelése

Feature: photo-handling
Type: feature
Status: ready-for-agent
Blocked by: 10, 11

## Cél

Egy már rögzített tőkeeseményhez utólag is lehessen fotót felvenni, egyenként
törölni, és a képaláírást megadni – ne csak a létrehozás pillanatában.

## Kiindulás

Létrehozáskor a `VineEventForm` már több fájlt is elfogad. A hiányzó képesség
az utólagos kezelés: az `editEvent` parancs a
[firestoreVines.ts:371](../../dashboard/src/features/vines/firestoreVines.ts)-ben
csak a típust, időpontot, címet és jegyzetet írja, a `photos` tömböt érintetlenül
hagyja. Ezt a `04` issue tudatosan hagyta ki az akkori verzióból.

A dugványoldalon ez a `CuttingPhotoGallery`-ben megvan (hozzáadás, aktív kép
törlése), csak dugvány szintjén, nem eseményhez kötve.

## Megjelenési referencia

Az eseménykártyán belüli fotósor és a hozzá tartozó admin műveletek a
`CuttingPhotoGallery` admin fejlécének vizuális nyelvét kövessék. A közös
választó- és néző-komponensek (`10`, `11`) újrahasználandók, ne szülessen
harmadik változat. Mobilon és desktopon is reprodukálni kell a látható
állapotot módosítás előtt.

## Scope

- új catalog parancsok a `firestoreVines.ts`-ben:
  - `addEventPhotos(vineId, eventId, files)`
  - `deleteEventPhoto(vineId, eventId, photoId)`
  - `editEventPhotoCaption(vineId, eventId, photoId, caption)`
- mindhárom tranzakciós read–modify–write az esemény beágyazott `photos`
  tömbjén, a meglévő `addEvents` mintája szerint
- feltöltési hiba után Storage-kompenzáció, ahogy az `addEvents`-nél
- fotótörlés előbb a Firestore-rekordból veszi ki a képet, majd best-effort
  törli a Storage-objektumot
- a tőke `updatedAt` értéke minden műveletnél frissül
- UI: az eseménykártyán admin módban `Fotó hozzáadása` a közös
  `PhotoPickerButtons`-szel, fotónként törlés és aláírás-szerkesztés
- eseményenkénti fotódarabszám-korlát

## Elfogadási kritériumok

- [ ] Meglévő tőkeeseményhez admin utólag több fotót is fel tud venni, egy
      műveletben többet is.
- [ ] Az utólag feltöltött fotó ugyanarra a
      `vines/{vineId}/events/{eventId}/photos/{photoId}.{extension}` útvonalra
      kerül, mint a létrehozáskoriak.
- [ ] Egy fotó egyenként törölhető anélkül, hogy az esemény többi fotója vagy
      egy másik tőke azonos nevű eseménypéldánya sérülne.
- [ ] Sikertelen Firestore-írás után az adott művelet feltöltései best-effort
      módon törlődnek.
- [ ] A képaláírás szerkeszthető és megmarad; üres aláírás érvényes érték.
- [ ] A darabszám-korlát elérésekor a felület érthető üzenetet ad, és nem indít
      feltöltést.
- [ ] Nem admin felhasználó nem lát fotóműveleti gombot, és a Storage-szabály
      sem engedi neki az írást.
- [ ] Minden érintett tőke `updatedAt` értéke frissül.
- [ ] Emulatoros integrációs teszt fedi a hozzáadást, az egyedi törlést, az
      aláírás-szerkesztést és a hibakompenzációt.
- [ ] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- kapcsolódó emulatoros tesztek

## Comments
