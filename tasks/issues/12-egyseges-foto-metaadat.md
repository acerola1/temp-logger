# Egységes fotó-metaadat és valódi készítési idő

Feature: photo-handling
Type: feature
Status: ready-for-agent
Blocked by: 09

## Cél

A fotórekord ugyanazt jelentse a dugványnál és a tőkénél, és a megjelenített
dátum a kép **készítési** ideje legyen, ne a feltöltésé.

## Kiindulás

- `CuttingPhoto`: `capturedAt` és `caption` van benne, `VineEventPhoto`-ban nincs.
- A `toCuttingPhotos` a `capturedAt`-be a feltöltés pillanatát írja, EXIF-ből
  nem olvasunk. A galéria és a bélyegek ezt a hamis dátumot mutatják.
- Az átméretezés canvasre rajzol, ami az EXIF-orientációt is eldobja: a
  telefonnal álló helyzetben készült kép elfekhet.

## Triage döntések

- **`caption` marad**, és a `VineEventPhoto`-ra is felkerül. A mező szerkesztő
  felülete a [13](./13-tokeesemeny-fotoinak-utolagos-kezelese.md) issue-ban
  készül el; addig üres marad, ahogy ma a dugványnál is.
- **Nincs visszamenőleges javítás.** A meglévő rekordok maradnak, csak nem
  szabad eltörniük.
- **Nincs új függőség.** Saját, minimális parser olvassa ki a
  `DateTimeOriginal` és `Orientation` mezőt; minden más EXIF-tag figyelmen
  kívül marad.

## Scope

- közös `Photo` metaadat-típus a `features/photos` modulban, amit a
  `CuttingPhoto` és a `VineEventPhoto` is ebből származtat
- saját EXIF-parser: a jpeg APP1 szegmensből a `DateTimeOriginal` és az
  `Orientation`, minden más tag kihagyva
- EXIF `DateTimeOriginal` kiolvasása a kép-előkészítéskor; hiánya esetén
  `capturedAt = null`, és a felület ilyenkor a feltöltés idejét jelzi, láthatóan
  megkülönböztetve
- EXIF `Orientation` alkalmazása az átméretezéskor
- a `VineEventPhoto` kiegészítése `capturedAt`-tal és `caption`-nel

## Elfogadási kritériumok

- [x] A dugvány- és a tőkefotó ugyanazt a metaadat-alakot használja,
      `capturedAt`-tal és `caption`-nel együtt.
- [x] Az EXIF-kiolvasás új npm-függőség nélkül, saját parserrel történik, és
      csak a `DateTimeOriginal` és `Orientation` mezőt fejti ki.
- [x] EXIF-fel rendelkező képnél a `capturedAt` a valódi készítési idő.
- [x] Nem jpeg bemenetre, sérült vagy hiányzó EXIF-blokkra a parser nem dob
      hibát, hanem `null`-t ad vissza.
- [x] EXIF nélküli képnél a `capturedAt` `null`, és a felület nem tesz úgy,
      mintha ismerné a készítés idejét.
- [x] Elforgatott EXIF-orientációjú kép feltöltés után álló helyzetben jelenik meg.
- [x] Meglévő, `capturedAt` nélküli rekordok megjelenítése nem törik el.
- [x] Egységteszt fedi az EXIF-kiolvasást és az orientáció-korrekciót.
- [x] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/photos/photoMetadata.ts` (új)
- `dashboard/src/features/photos/exif.ts` (új)
- `dashboard/src/features/photos/imageOrientation.ts` (új)
- `dashboard/src/features/photos/imageDecode.ts` (új)
- `dashboard/src/features/photos/decoderOrientation.ts` (új)
- `dashboard/src/features/photos/imagePreparation.ts`
- `dashboard/src/features/photos/photoUpload.ts`
- `dashboard/src/types/cutting.ts`
- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/components/cuttingsViewUtils.ts`
- `dashboard/src/components/CuttingPhotoGallery.tsx`
- `dashboard/src/components/CuttingTimeline.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`

## Comments

- 2026-08-03: A közös `Photo` a `features/photos/photoMetadata.ts`-ben él, és
  mind a `CuttingPhoto`, mind a `VineEventPhoto` ennek az aliasa. A
  `VineEventPhoto` így kapott `capturedAt`-ot és `caption`-t; a felirat
  szerkesztése a [13](./13-tokeesemeny-fotoinak-utolagos-kezelese.md) issue-ra
  marad, addig üresen jön létre.
- 2026-08-03: Az EXIF-parser (`exif.ts`) a jpeg szegmensláncból az első
  APP1/Exif blokkot keresi meg, és csak a `DateTimeOriginal` és az `Orientation`
  tagot fejti ki. Minden hibás bemenet (nem jpeg, csonka blokk, rossz TIFF-magic,
  `0000:00:00`, tartományon kívüli orientáció) `null`. A tag időzónát nem
  hordoz, ezért a kamera helyi idejeként értelmezzük.
- 2026-08-03: **A kiindulás egyik feltevése nem állta meg a helyét.** Valódi
  Chromiumban megmértem: a dekóder minden úton (`<img>`, `createImageBitmap`,
  még `imageOrientation: 'none'`-nal is) már elforgatva adja a képet, méretben és
  pixelben egyaránt — a canvasre rajzolás tehát nem dobja el az orientációt. Aki
  ilyenkor maga is forgat, az duplán forgat. Ezért a `decoderOrientation.ts`
  munkamenetenként egyszer *kiméri* egy beépített 2×1-es, `Orientation = 6`-os
  mérőképpel, hogy a dekóder forgat-e, és az `imageOrientation.ts`
  transzformációja csak akkor fut, ha nem.
- 2026-08-03: A `capturedAt` az előkészítés–feltöltés–rekord szálon megy végig
  (`PreparedImageUpload` → `UploadedPhotoObject` → `toCuttingPhotos` /
  `uploadPreparedVineEventPhotos`), nem a hívóhelyeken keletkezik. A `null` esetet
  a `photoDateLabel` fordítja felületre: `Készült:` a valódi időnél,
  `Feltöltve:` a feltöltésénél, a bélyegen `↑` és dőlt szedés.
- 2026-08-03: Visszamenőleges javítás nincs. A `mapPhoto` a hiányzó `capturedAt`-ot
  `null`-ra, a hiányzó `caption`-t üresre olvassa, és az e2e seed egyik
  eseményfotója szándékosan a régi alakban maradt, hogy ez a szál fedve legyen.
- 2026-08-03: Review után: az `${címke}: ${dátum}` összefűzés és a képnéző
  feliratának összeállítása egy helyre került (`photoDateText`,
  `photoLightboxCaption`), a feltöltésből a rekordot egyetlen `toPhotoRecord`
  képezi mindkét feature-nek (a dugványoldal így nem a tárolási útból bányássza
  vissza a fotó azonosítóját), a `features/photos` barrel csak a határon átmenő
  neveket exportálja, a dátum naptári érvényességét pedig a már használt
  `date-fns` `parse`/`isValid` dönti el a kézzel írt ellenőrzés helyett.
- 2026-08-03: Ellenőrzés: unit tesztek (121/121), lint, production build, teljes
  Playwright E2E (18/18). Valódi Chromiumban visszanéztem: EXIF-orientációval
  (6) feltöltött kép a méretében és a pixeleiben is állóvá fordul, a `capturedAt`
  a valódi felvételi idő, és a galéria a `Készült:` / `Feltöltve: ↑` állapotot
  desktopon és mobilon is helyesen mutatja.
