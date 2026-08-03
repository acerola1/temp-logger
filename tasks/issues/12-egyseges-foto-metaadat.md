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

- [ ] A dugvány- és a tőkefotó ugyanazt a metaadat-alakot használja,
      `capturedAt`-tal és `caption`-nel együtt.
- [ ] Az EXIF-kiolvasás új npm-függőség nélkül, saját parserrel történik, és
      csak a `DateTimeOriginal` és `Orientation` mezőt fejti ki.
- [ ] EXIF-fel rendelkező képnél a `capturedAt` a valódi készítési idő.
- [ ] Nem jpeg bemenetre, sérült vagy hiányzó EXIF-blokkra a parser nem dob
      hibát, hanem `null`-t ad vissza.
- [ ] EXIF nélküli képnél a `capturedAt` `null`, és a felület nem tesz úgy,
      mintha ismerné a készítés idejét.
- [ ] Elforgatott EXIF-orientációjú kép feltöltés után álló helyzetben jelenik meg.
- [ ] Meglévő, `capturedAt` nélküli rekordok megjelenítése nem törik el.
- [ ] Egységteszt fedi az EXIF-kiolvasást és az orientáció-korrekciót.
- [ ] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/photos/imagePreparation.ts`
- `dashboard/src/types/cutting.ts`
- `dashboard/src/features/vines/model.ts`
- `dashboard/src/components/cuttingsViewUtils.ts`

## Comments
