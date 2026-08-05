# Közös fotógaléria és dugvány-képaláírás szerkesztés

Feature: vine-photo-model
Type: refactor
Status: ready-for-agent
Blocked by: –

Forrás: [A tőkefotók önálló modellje](../vine-photo-model/spec.md).

## Cél

A dugványok jelenlegi galériájából készüljön hívófüggetlen, közös
fotógaléria-modul, amelyet a következő issue-ban a tőkeoldal is használhat. A
kiemelés közben a dugványfotók képaláírása váljon szerkeszthetővé, a galéria és
a lightbox pedig következetesen a legújabb képpel kezdődjön.

## Kiindulás

A közös `features/photos` modul már birtokolja a fotó-metaadatot, a választót,
a feltöltést és a `PhotoLightbox`-ot, de a teljes galéria viselkedése a
`CuttingPhotoGallery` komponensbe van beégetve. A tőkeesemények külön
`VineEventPhotos` sort használnak. Az új modellben az eseményfotósor megszűnik,
a tőke pedig a dugványhoz hasonló önálló galériát kap.

Ez az issue még nem változtatja meg a tőke adattárolását vagy felületét. Olyan
közös interface-t készít, amelyet a tőkeoldali cutover készen talál.

## Scope

- közös galériamodul a `features/photos/ui/` alatt, amely:
  - nagy aktív képet és alatta bélyegrácsot jelenít meg;
  - egyetlen `PhotoLightbox`-ban járja be a teljes listát;
  - használja a közös kamera- és galériaválasztót;
  - admin módban hozzáadást, törlést és képaláírás-szerkesztést kínál;
  - opcionális interface-en támogatja a borítókép kijelölését, de nem ismeri a
    tőke domainmodelljét;
  - nem importál Firebase SDK-t és nem ismer Storage-útvonalat;
- közös, tiszta fotórendezés `capturedAt ?? uploadedAt` szerint csökkenően,
  azonos időnél `uploadedAt`, majd `id` tie-breakerrel;
- a valódi készítési és feltöltési idő nélküli legacy dugványfotók a dátummal
  rendelkező képek mögé kerülnek, egymás között a korábbi tömbsorrendjüket
  tartják meg; a dugvány `createdAt` értékét nem használjuk fotóidőpontként;
- a `CuttingPhotoGallery` cseréje vékony dugvány-adapterre a közös galéria
  fölött;
- a hozzáadás, a képaláírás-szerkesztés és a metaadat-törlés tranzakciós
  read–modify–write a dugvány aktuális `photos[]` tömbjén; nem írhatják felül a
  másik fül vagy párhuzamos művelet közben hozzáadott fotóit;
- a jelenlegi `latestPhotosRef` kliensoldali kerülőút eltávolítása, miután az
  írási invariáns a Firestore-modulba kerül;
- dugványfotó törlésekor először a Firestore-metaadat tűnik el, utána
  best-effort törlődik a nagy kép és az esetleges bélyeg Storage-objektuma;
- a dugvány `updatedAt` mezőjének frissítése képaláírás-módosításkor;
- a dugványfeltöltés 1000 px-es korlátjának és jelenlegi Storage-útvonalának
  megtartása;
- a dugványnál nincs kézi borítókép-kijelölés;
- a dugvány létrehozáskori fotóválasztása ebben az issue-ban nem változik.

## Interface-elvárás

A közös galéria a fotólistát és szándékalapú callbackeket kapja. A végleges
propnevek az implementáció során egyszerűsíthetők, de a seam jelentése ez:

```ts
interface PhotoGalleryProps {
  photos: readonly Photo[];
  isAdmin: boolean;
  maxSelectionCount?: number;
  onAddPhotos(files: File[]): Promise<void>;
  onDeletePhoto(photoId: string): Promise<void>;
  onEditCaption(photoId: string, caption: string): Promise<void>;
  cover?: {
    pinnedPhotoId: string | null;
    onPin(photoId: string | null): Promise<void>;
  };
}
```

A `pinnedPhotoId` kizárólag a kézi kijelölést jelenti; a galéria a saját közös
rendezéséből vezeti le és jelöli meg a tényleges automatikus borítót. A
`maxSelectionCount` alapértelmezése 6, és a galéria már a callback előtt erre
vágja a választást, érthető üzenettel. A méretkorlát és a Storage-írás a hívó
adapterében marad. A galéria nem kap `mode: 'vine' | 'cutting'` kapcsolót; a
ténylegesen változó képességeket kis, opcionális interface-ek fejezik ki.

## Elfogadási kritériumok

- [ ] A közös galéria nem importál Firebase SDK-t, tőke- vagy dugványtípust.
- [ ] A dugványoldal a közös galériát és a meglévő közös `PhotoLightbox`-ot
      használja, nem marad második teljes galéria-implementáció.
- [ ] A galéria és a lightbox legújabb → legrégebbi sorrendű, és ugyanazt a
      determinisztikus rendezőfüggvényt használja.
- [ ] A nagy aktív kép + bélyegrács layout mobilon és desktopon is használható;
      az adminműveletek az aktív kép műveleti sávjában vannak, nem fotónkénti
      külön sorokban.
- [ ] EXIF nélküli fotó a `uploadedAt` értékével kerül a sorrendbe, és a felület
      továbbra is `Feltöltve` címkével jelzi ezt.
- [ ] Valódi készítési és feltöltési idő nélküli legacy dugványfotó a dátumozott
      képek után marad, az ilyen fotók relatív sorrendje nem változik, és a
      dugvány létrehozási ideje nem válik fotóidőponttá.
- [ ] Admin a dugványfotó képaláírását szerkesztheti és üresre is törölheti.
- [ ] A képaláírás mentése nem módosítja a fotó más metaadatát, és frissíti a
      dugvány `updatedAt` értékét.
- [ ] Párhuzamos képaláírás-mentés és fotófeltöltés nem veszít el fotórekordot;
      ezt Firestore-tranzakciós teszt fedi.
- [ ] A dugványfotó hozzáadása és egyenkénti, megerősített törlése változatlanul
      működik.
- [ ] Dugványfotó törlésekor előbb a Firestore-metaadat tűnik el, majd
      best-effort a Storage-objektum; Storage-hiba nem hagy törött publikus
      fotórekordot.
- [ ] Egy kiválasztásból alapértelmezésben legfeljebb hat kép jut az
      `onAddPhotos` callbackhez, a kimaradt képekről a felület üzen.
- [ ] A dugványnál nem jelenik meg borítókép-kijelölő művelet.
- [ ] Bekapcsolt borító-interface esetén a galéria külön jelöli a rendezésből
      adódó automatikus és a `pinnedPhotoId` által kijelölt borítót.
- [ ] A dugványképek 1000 px-es korlátja és Storage-útvonala nem változik.
- [ ] Nem admin felhasználó nem lát írási műveleteket.
- [ ] Egységteszt fedi a rendezést, a lightbox kezdőindexét, a képaláírás
      szerkesztését és az opcionális borító-interface ki- és bekapcsolását.
- [ ] A dugványoldal pontos admin és publikus állapota mobilon és desktopon
      reprodukálva, DOM-mal és képernyőképpel ellenőrizve.
- [ ] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a releváns Playwright E2E zöld.

## Érintett terület

- `dashboard/src/features/photos/`
- `dashboard/src/components/CuttingPhotoGallery.tsx`
- `dashboard/src/components/CuttingDetail.tsx`
- `dashboard/src/hooks/queries/useCuttingsQuery.ts`
- kapcsolódó unit- és E2E-tesztek

## Nem része

- A tőkefotók adatmodelljének vagy UI-jának átállítása.
- Kézi dugvány-borítókép bevezetése.
- A dugvány képméretkorlátjának megváltoztatása.
- Bélyegkép készítése vagy visszamenőleges generálása a dugványfotókhoz; a
  közös galéria a meglévő `photoThumbnailUrl` fallbacket használja.
- Közös esemény–fotó idővonal.

## Comments

- A közös galéria mély modul: a hívó csak a fotólistát és a felhasználói
  szándékokat adja át, a rendezés, kiválasztás, lightbox-állapot és szerkesztő
  viselkedése a modul implementációjában marad.
