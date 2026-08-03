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

- [ ] Érintőeszközön a `Fotózás` gomb közvetlenül a hátsó kamerát nyitja, a
      `Galéria` a fájlválasztót többes kijelöléssel.
- [ ] Desktopon egyetlen `Kép kiválasztása` gomb jelenik meg.
- [ ] A kiválasztott képek bélyegként látszanak, egyenként eltávolíthatók, és az
      eltávolítás után a feltöltésbe sem kerülnek bele.
- [ ] Ugyanaz a fájl egymás után kétszer is kiválasztható.
- [ ] Több körben hozzáadott képek összeadódnak a limitig; a limit feletti
      kijelölés érthető üzenettel elutasításra kerül.
- [ ] A kiválasztás elhagyása után nem marad felszabadítatlan objectURL.
- [ ] Feltöltés közben a választógombok tiltottak, a progress sáv változatlanul
      működik.
- [ ] A tőkeesemény szerkesztő módja továbbra sem kezel fotót – ez nem ennek az
      issue-nak a scope-ja.
- [ ] Komponensteszt fedi a kiválasztást, az eltávolítást és a limitet.
- [ ] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/photos/ui/PhotoPickerButtons.tsx` (új)
- `dashboard/src/features/photos/ui/PhotoPreviewList.tsx` (új)
- `dashboard/src/components/SessionEventForm.tsx` (ugyanerre a komponensre áll)

## Comments
