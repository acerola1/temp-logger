# Tőkeesemény: mobil kamera és fotó-előnézet a beküldés előtt

Feature: photo-handling
Type: feature
Status: ready-for-agent
Blocked by: 09

## Cél

A tőkeesemény-űrlapon mobilon egy koppintással induljon a kamera, és a
kiválasztott képek feltöltés előtt látszódjanak, egyenként eltávolíthatóan.

## Kiindulás

A `VineEventForm` nyers `<input type="file" multiple>`-t renderel: nincs
kameragomb, nincs előnézet, nincs eltávolítás. A dugványoldalon a
`Fotózás / Galéria` gombpár már megvan – itt maradt ki.

## Megjelenési referencia

A gombpár és a bélyegsor a `CuttingPhotoGallery` admin fejlécének vizuális
nyelvét kövesse (`rounded-xl` szegélyes gombok, `lucide` ikonok, dark mód).
Mobilon és desktopon is reprodukálni kell a látható állapotot módosítás előtt.

## Scope

- közös `PhotoPickerButtons` komponens a 09-es modulból, három állapottal:
  érintőeszközön `Fotózás` + `Galéria`, egyébként egy `Kép kiválasztása` gomb
- `PhotoPreviewList`: kiválasztott képek bélyegei ✕ gombbal, objectURL
  felszabadítással
- kiválasztott képek darabszám-korlátja és a maradék helyre vágás
- kamerával készített kép hozzáadódik a listához, nem írja felül
- a meglévő feltöltési progress sáv megmarad

## Elfogadási kritériumok

- [x] Érintőeszközön a `Fotózás` gomb közvetlenül a hátsó kamerát nyitja, a
      `Galéria` a fájlválasztót többes kijelöléssel.
- [x] Desktopon egyetlen `Kép kiválasztása` gomb jelenik meg.
- [x] A kiválasztott képek bélyegként látszanak, egyenként eltávolíthatók, és az
      eltávolítás után a feltöltésbe sem kerülnek bele.
- [x] Ugyanaz a fájl egymás után kétszer is kiválasztható.
- [x] Több körben hozzáadott képek összeadódnak a limitig; a limit feletti
      kijelölés érthető üzenettel elutasításra kerül.
- [x] A kiválasztás elhagyása után nem marad felszabadítatlan objectURL.
- [x] Feltöltés közben a választógombok tiltottak, a progress sáv változatlanul
      működik.
- [x] A tőkeesemény szerkesztő módja továbbra sem kezel fotót – ez nem ennek az
      issue-nak a scope-ja.
- [x] Komponensteszt fedi a kiválasztást, az eltávolítást és a limitet.
- [x] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/photos/ui/PhotoPickerButtons.tsx` (új)
- `dashboard/src/features/photos/ui/PhotoPreviewList.tsx` (új)
- `dashboard/src/components/SessionEventForm.tsx` (ugyanerre a komponensre áll)

## Comments

- 2026-08-03: Közös `PhotoPickerButtons` került a `features/photos/ui/`-ba: a
  rejtett inputot maga tartja, érintőeszközön `Fotózás` + `Galéria`, egyébként
  egyetlen, feliratozható választógomb. A `change` kezelő is nullázza az inputot,
  így ugyanaz a fájl egymás után újra kiválasztható.
- 2026-08-03: A kiválasztás állapotát a `photoSelection.ts` írja le
  (`appendSelectedPhotos` a maradék helyre vágással, `removeSelectedPhotoAt`,
  `releaseSelectedPhotos`). Az objectURL a befogadott képpel együtt keletkezik és
  eltávolításnál, illetve az űrlap lecsatolásánál szabadul fel, így a
  `PhotoPreviewList` effekt nélküli, tisztán prezentációs komponens maradt.
- 2026-08-03: A limit 6 kép (`DEFAULT_MAX_SELECTED_PHOTOS`), a felette lévő
  kijelölés `Legfeljebb 6 fotó választható ki, N kép kimaradt.` üzenetet ad. A
  `SessionEventForm` ugyanerre a gombra állt, a szerkesztő mód továbbra sem kezel
  fotót.
- 2026-08-03: A komponensteszthez `@testing-library/react` + `happy-dom` került a
  devDependencies közé (jsdom 30 a Node 20.15-ön `require(ESM)`-re esik), a
  vitest `.test.tsx`-eket is futtat fájlszintű `@vitest-environment happy-dom`
  docblockkal.
- 2026-08-03: Ellenőrzés: unit + komponenstesztek (61/61), lint, production build,
  teljes Playwright E2E (18/18) frissített tőkeesemény-snapshotokkal; a
  munkamenet-űrlap választógombját desktop és mobil viewporton is
  visszanéztem.
