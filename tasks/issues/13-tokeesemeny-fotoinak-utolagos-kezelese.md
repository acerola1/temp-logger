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

- [x] Meglévő tőkeeseményhez admin utólag több fotót is fel tud venni, egy
      műveletben többet is.
- [x] Az utólag feltöltött fotó ugyanarra a
      `vines/{vineId}/events/{eventId}/photos/{photoId}.{extension}` útvonalra
      kerül, mint a létrehozáskoriak.
- [x] Egy fotó egyenként törölhető anélkül, hogy az esemény többi fotója vagy
      egy másik tőke azonos nevű eseménypéldánya sérülne.
- [x] Sikertelen Firestore-írás után az adott művelet feltöltései best-effort
      módon törlődnek.
- [x] A képaláírás szerkeszthető és megmarad; üres aláírás érvényes érték.
- [x] A darabszám-korlát elérésekor a felület érthető üzenetet ad, és nem indít
      feltöltést.
- [x] Nem admin felhasználó nem lát fotóműveleti gombot, és a Storage-szabály
      sem engedi neki az írást.
- [x] Minden érintett tőke `updatedAt` értéke frissül.
- [x] Emulatoros integrációs teszt fedi a hozzáadást, az egyedi törlést, az
      aláírás-szerkesztést és a hibakompenzációt.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/forms.ts`
- `dashboard/src/features/vines/ui/VineEventPhotos.tsx` (új)
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- `dashboard/src/features/vines/firestoreVines.integration.test.ts`
- `dashboard/e2e/zz-vine-mutation.spec.ts`, `dashboard/e2e/vine-detail-form.spec.ts`

## Comments

- 2026-08-03: A három parancs (`addEventPhotos`, `deleteEventPhoto`,
  `editEventPhotoCaption`) egyetlen közös `updateEventPhotos` tranzakciós
  read–modify–write-ra épül: beolvassa a tőkét, megkeresi az eseményt id
  szerint, és csak annak a `photos` tömbjét cseréli. Így egy másik tőke azonos
  nevű eseménypéldánya nem sérülhet, és a tőke `updatedAt`-ja, valamint az
  esemény `updatedAt`-ja minden műveletnél frissül.
- 2026-08-03: A törlés sorrendje szándékos: előbb a Firestore-rekordból tűnik el
  a kép, utána megy a best-effort Storage-törlés. A fordított sorrendben egy
  megszakadt művelet olyan bélyeget hagyna a felületen, ami már nem letölthető.
  A hozzáadás ezzel szimmetrikus: hibás Firestore-írás után az adott művelet
  feltöltései takarításra kerülnek, ahogy az `addEvents`-nél.
- 2026-08-03: Az eseményenkénti korlát `MAX_VINE_EVENT_PHOTOS = 12`, azaz két
  teli választás (`DEFAULT_MAX_SELECTED_PHOTOS = 6`). A korlátot két helyen
  nézzük: a felület a `selectVineEventPhotos`-szal a maradék helyre vág, üzen a
  kimaradt képekről, és nulla szabad helynél fel sem tölt; az adatréteg még a
  fotók előkészítése előtt, majd a tranzakcióban is ellenőriz, hogy párhuzamos
  írás se csúszhasson át.
- 2026-08-03: A választó- és néző-komponensekből nem született harmadik változat:
  a fotófelvétel a közös `PhotoPickerButtons`, a nagyítás a közös
  `PhotoLightbox`. Az eseménykártya fotósora külön komponens
  (`VineEventPhotos`), mert a `VineDetail` már így is nagy volt; a nem admin
  nézet változatlan bélyegsor, admin módban a `CuttingPhotoGallery` admin
  fejlécének nyelvét követi (bal oldalt `Fotók n/12`, jobb oldalt a
  hozzáadás-gomb).
- 2026-08-03: A katalógus `mutation` állapota közös, ezért a `VineDetail`
  megjegyzi, melyik esemény fotóműveletéhez tartozik éppen a progressz és a
  hibaüzenet (`photoEventId`), különben minden nyitott űrlap ugyanazt a hibát
  mutatta volna.
- 2026-08-03: A meglévő E2E-lokátorok `Szerkesztés`/`Törlés` néven kerestek, ami
  a Playwright részszöveg-egyezése miatt már a fotónkénti `…fotó törlése` és
  `…képaláírásának szerkesztése` gombokra is illeszkedett: ezeket `exact: true`-ra
  szigorítottam a címkék elrontása helyett.
- 2026-08-03: Mobilon a fotósor behúzása (`pl-11`) csak `sm` fölött van meg. Az
  első valódi renderelésen látszott, hogy 375 px-en a 44 px behúzás a felirat
  helyét vitte el; a szűkebb elrendezéssel a dátum és a gombok egy sorba kerülnek.
- 2026-08-03: Ellenőrzés: unit tesztek (135/135, ebből 11 új komponens- és
  űrlapteszt), emulatoros integrációs tesztek (18/18, ebből 5 új: utólagos
  többfotós felvétel, egyedi törlés két tőkén, aláírás megőrzése és üresre
  törlése, hibakompenzáció, korlát), lint, production build, teljes Playwright
  E2E (18/18) új képernyőképekkel a fotósorról és az aláírás-szerkesztőről
  desktopon és mobilon.
