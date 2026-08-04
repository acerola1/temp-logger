# Fotó-bélyegkép: a tőkelista ne töltse le a nagy képeket

Feature: photo-handling
Type: enhancement
Status: done
Blocked by: 15

## Cél

A tőkelista mobil adatforgalma ne nőjön a tőkék számával arányosan a nagy
képekkel. A 80×80 px-es helyen megjelenő borítóbélyeg egy kicsi, külön feltöltött
változatot töltsön le, ne az 1280 px-es eredetit.

## Kiindulás

A `15` issue-val a lista kártyája egy 80×80 px-es keretben (`h-20 w-20`) mutatja a
borítót, de a teljes méretű képre hivatkozik
([VinesList.tsx:85-89](../../dashboard/src/features/vines/ui/VinesList.tsx#L85-L89)).
A tőkeeseményfotók a hosszabbik oldalon 1280 px-esek
([vineEventPhotos.ts:17](../../dashboard/src/features/vines/vineEventPhotos.ts#L17)),
ami JPEG-ben nagyságrendileg 300–500 KB/kép. Ugyanez a helyzet az eseménykártya
fotósorában is, ott is 80×80 px-es keretben
([VineEventPhotos.tsx:63-69](../../dashboard/src/features/vines/ui/VineEventPhotos.tsx#L63-L69)).
Ötven tőke listája így több tíz MB, miközben a megjelenített felület ennek a
századát igényli.

A kliensoldali átméretezés egy helyen, tesztelve él: a
[imagePreparation.ts:69-93](../../dashboard/src/features/photos/imagePreparation.ts#L69-L93)
egyszer dekódolja a fájlt, kiolvassa az EXIF-et, és canvasra rajzolja a
méretkorlátra skálázott képet. A feltöltés a
[photoUpload.ts:57-109](../../dashboard/src/features/photos/photoUpload.ts#L57-L109)
soros hurkában megy, hibára a részleges eredményt takarítja
([photoUpload.ts:40-53](../../dashboard/src/features/photos/photoUpload.ts#L40-L53)).

## Triage döntések

- **Bélyeg minden feltöltött fotóhoz készül, nem csak a borítóhoz.** A borító
  kijelölés nélkül a legutóljára fényképezett kép, azaz minden új fotóval
  elmozdul (`15` triage döntése). Feltöltéskor tehát nem tudható, melyik fotó
  lesz a borító, és amikor elmozdul, nincs olyan kliensoldali pillanat, ahol a
  bélyeg ingyen elkészülne: a böngészőnek le kellene töltenie az 1280 px-es
  képet. Egy bélyeg viszont ~20–35 KB, azaz ~5% storage-többlet és egy extra kis
  PUT feltöltésenként.
- **Kliensoldali, feltöltéskori generálás, nem Storage-trigger.** A dekódolás és
  az EXIF-olvasás már megvan, a második, kisebb canvas-rajzolás ugyanabból a
  dekódolt képből szinte ingyen van. Így a fotórekord már bélyeggel születik,
  nincs aszinkron rés a kártya megjelenése és a bélyeg elkészülése között, nem
  kell új futásidő és `sharp`, és emulátorban is tesztelhető. A szerveroldal
  egyetlen igazi előnye a visszamenőleges backfill lenne, amiről lásd a
  következő döntést.
- **Nincs visszamenőleges generálás.** A meglévő fotók bélyeg nélkül maradnak, és
  a felület ilyenkor a nagy képre esik vissza. A `15` ugyanezt a nyelvet
  használja a `coverPhoto`-nál: a hiányzó mező nem hiba, hanem a régi viselkedés.
- **A bélyeg a fotórekord beágyazott mezője**, nem kikövetkeztetett Storage-út.
  Az útból képzett URL letöltési tokent igényelne, azaz futásidejű
  `getDownloadURL` hívást minden kártyához; a mező viszont a tőkedokumentummal
  együtt jön, amit a `subscribeToVines` amúgy is behoz.
- **A bélyeg ugyanabba a mappába kerül** (`.../photos/{photoId}_thumb.{ext}`),
  mert a `storage.rules` mintája (`photos/{fileName}`) így változtatás nélkül
  érvényes marad rá.
- **A bélyeg contentType-ja megegyezik a nagy képével.** A png forrás nem
  konvertálódik jpeg-be, hogy az alfacsatorna ne váljon fekete háttérré.
- **A már kicsi kép nem kap bélyeget.** Ha az eredeti hosszabbik oldala nem
  nagyobb a bélyegméretnél, `thumbnail: null` marad, és a fallback maga a
  nagy kép — ami ilyenkor már eleve kicsi.
- **A bélyeg csak a kis keretekben jelenik meg.** A tőke adatlap fejlécének
  borítója (`h-48 sm:h-56`,
  [VineDetail.tsx:290-294](../../dashboard/src/features/vines/ui/VineDetail.tsx#L290-L294))
  és a `PhotoLightbox` a nagy képet tartja: egy 320 px-es bélyeg ezeken már
  látványosan mosott lenne. A `15` „az adatlap ugyanazt a képet mutatja, mint a
  lista" kritériuma emiatt nem sérül: ugyanaz a fotó, csak más változata.
- **A dugványoldal ebben az issue-ban nem változik.** Az új opció opt-in a
  `prepareImageUpload`-on, a `usePhotoUpload` hívói
  ([usePhotoUpload.ts:74](../../dashboard/src/features/photos/usePhotoUpload.ts#L74))
  nem adják meg, tehát a dugvány- és munkamenetfotók viselkedése változatlan. A
  `CuttingsList` bélyege
  ([CuttingsList.tsx:28](../../dashboard/src/components/CuttingsList.tsx#L28))
  marad a nagy képen, ahogy a `15` is kihagyta a dugványoldalt.

## Scope

- `prepareImageUpload` új opciója `thumbnailMaxSide`; megadása esetén a
  visszatérő érték tartalmaz egy `thumbnail: { blob; width; height } | null`
  mezőt is
- a mostani inline canvas-blokk kiemelve egy közös skálázó helperbe, és kétszer
  meghívva ugyanarra a dekódolt képre, hogy a fájl egyszer dekódolódjon
- a bélyegbe is bele kell égetni az EXIF-forgatást, mert az átméretezett kép nem
  hordoz EXIF-et — a nagy képnél már ez a szabály
- a tőkeeseményfotó bélyegmérete a `vineEventPhotos.ts`-ben van kimondva a
  1280 px mellé: `VINE_EVENT_PHOTO_THUMBNAIL_MAX_SIDE = 320` (a 80 px-es keret
  3× DPR-en is éles)
- `uploadPreparedPhotos` a bélyeget a nagy kép után, ugyanazzal a `photoId`-val,
  `_thumb` utótaggal tölti fel; a visszatérő `UploadedPhotoObject` egy
  `thumbnail: { storagePath; downloadUrl; width; height } | null` mezőt is ad
- a feltöltés `totalBytes` összege a bélyegek méretét is tartalmazza, hogy a
  folyamatjelző ne ugorjon
- a hibaági takarítás (`uploadedPaths`) a bélyegek útjait is tartalmazza, hogy
  ne maradjon árva objektum
- `Photo` új mezője `thumbnail: PhotoThumbnail | null`, a `toPhotoRecord` tölti;
  új tiszta helper a fallbackre: `photoThumbnailUrl(photo)`, ami a bélyeg URL-jét
  adja, hiányában a `downloadUrl`-t
- `mapPhoto` olvasása: hiányzó vagy hibás alakú `thumbnail` → `null`
- fotótörlésnél a bélyeg Storage-objektuma is törlődik (`deleteVineEventPhotos`,
  és a `deleteEvent` fotótakarítása)
- UI, tőkelista: a borító `img` a `photoThumbnailUrl`-t használja, `loading="lazy"`
  és fix `width`/`height` attribútummal, hogy a képernyőn kívüli kártyák ne
  töltsenek és ne ugráljon a layout
- UI, eseménykártya fotósora: ugyanez a `photoThumbnailUrl` és `loading="lazy"`
- E2E seed: a tőkefotók egy része bélyeggel, legalább egy szándékosan bélyeg
  nélkül, hogy a fallback is fedve legyen

## Elfogadási kritériumok

- [x] Új tőkeeseményfotó feltöltése után a Storage-ban két objektum van
      (`{photoId}.jpg` és `{photoId}_thumb.jpg`), és a fotórekord `thumbnail`
      mezője a kisebbre mutat.
- [x] A bélyeg hosszabbik oldala 320 px, a képaránya megegyezik a nagy képével.
- [x] Álló, EXIF-forgatást igénylő fotó bélyege is a helyes állásban van, nem
      fekszik el.
- [x] Png forrásból png bélyeg készül, és az átlátszó háttér nem lesz fekete.
- [x] 320 px-nél nem nagyobb eredeti kép esetén nem készül külön bélyeg, a
      rekord `thumbnail` mezője `null`, és a felület a nagy képet mutatja.
- [x] A tőkelista kártyáin az `img` a bélyegre hivatkozik, bélyeg nélküli fotónál
      a nagy képre, hibaüzenet és üres keret nélkül.
- [x] A tőkelista első betöltésekor letöltött képadat nagyságrendekkel kisebb,
      mint a bélyeg előtt: mérhetően a `_thumb` objektumok jönnek le, az 1280
      px-esek nem.
- [x] A képernyőn kívüli kártyák képei nem töltődnek le, amíg a felhasználó nem
      görget odáig.
- [x] A tőke adatlap fejlécének borítója és a `PhotoLightbox` továbbra is a nagy
      képet tölti.
- [x] Az eseménykártya fotósora is a bélyeget mutatja, a nagyítás viszont a nagy
      képet nyitja.
- [x] Fotó törlésekor a bélyeg objektuma is törlődik; esemény törlésekor az
      összes hozzá tartozó bélyeg is.
- [x] Ha a bélyeg feltöltése hibára fut, a nagy kép sem marad a Storage-ban, és a
      fotórekord sem jön létre.
- [x] A feltöltés folyamatjelzője monoton nő, nem ugrik vissza a bélyeg
      feltöltésénél.
- [x] A dugvány- és munkamenetfotók feltöltése és megjelenítése változatlan, a
      Storage-ban nem keletkezik hozzájuk `_thumb` objektum.
- [x] `storage.rules` és `firestore.rules` nem változik, és a bélyeg olvasása
      mégis engedélyezett.
- [x] Egységteszt fedi a bélyeggenerálást (méret, képarány, forgatás, kicsi kép
      kihagyása), a `photoThumbnailUrl` fallbackjét, és a `mapPhoto` hiányzó vagy
      hibás `thumbnail` olvasását.
- [x] Emulatoros integrációs teszt fedi, hogy a fotó- és eseménytörlés a bélyeg
      objektumát is elviszi.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      zöld.
- [x] Playwright E2E zöld; a lista és az adatlap képernyőképei érdemben
      változatlanok, azaz a bélyeg nem látszik rosszabb minőségűnek a 80 px-es
      keretben.

## Érintett terület

- `dashboard/src/features/photos/imagePreparation.ts`
- `dashboard/src/features/photos/imagePreparation.test.ts`
- `dashboard/src/features/photos/photoUpload.ts`
- `dashboard/src/features/photos/photoUpload.test.ts`
- `dashboard/src/features/photos/photoMetadata.ts`
- `dashboard/src/features/photos/photoMetadata.test.ts`
- `dashboard/src/features/photos/index.ts`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/firestoreVines.integration.test.ts`
- `dashboard/src/features/vines/ui/VinesList.tsx`
- `dashboard/src/features/vines/ui/VineEventPhotos.tsx`
- `dashboard/scripts/seed-e2e-data.mjs`
- `dashboard/e2e/vines-list.spec.ts`

## Comments

- 2026-08-04: A `15` kommentje már kimondta, hogy a lista nem igényel új
  Firestore-olvasást, viszont a bélyeg helyett az 1280 px-es képet töltené le, és
  hogy a kisebb változat generálása külön feladat — ez az az issue.
- 2026-08-04: A bélyeg a `usePhotoUpload`-on át a dugványoldalra is egy soros
  bekötés lenne (`maxImageSide` mellé a `thumbnailMaxSide`), és a `CuttingsList`
  előnézete is a nagy képet tölti ma. Ez szándékosan kimaradt, hogy az issue a
  tőkeoldalra fókuszáljon; ha a megoldás beválik, a dugványoldal külön issue-ban
  követheti.
- 2026-08-04: A `mapPhoto` bélyegolvasását nem egységteszt fedi, hanem az
  emulátoros integrációs teszt: a `mapPhoto` a modul belső részlete, és a
  `firestoreVines`-hoz nincs egységtesztfájl. A seedelt tőke három fotója a
  bélyeggel, a bélyeg nélküli régi alakkal és a hibás (URL nélküli) bélyeggel
  együtt megy át a valódi Firestore-körön, ami erősebb bizonyíték, mint a
  privát függvény közvetlen hívása. A `photoThumbnailUrl` fallbackje és a
  bélyeggenerálás viszont egységteszttel van fedve.
- 2026-08-04: A szerveroldali alternatíva (Storage-trigger `sharp`-pal, vagy a
  Resize Images extension) azért esett ki, mert a régi fotók backfilljén kívül
  minden szempontból drágább: Blaze-függés, aszinkron rés a rekord és a bélyeg
  között, az extension `thumbs/` alkönyvtára miatt `storage.rules`-változás, és
  emulátorban törékeny trigger. Ha később mégis kell backfill a meglévő
  fotókhoz, az egyszeri szkriptként futtatható a `functions/scripts/` migrációk
  mintájára, a felület fallbackje pedig változatlanul jó marad hozzá.
