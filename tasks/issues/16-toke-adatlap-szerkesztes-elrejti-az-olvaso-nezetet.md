# Tőke adatlap: szerkesztéskor csak a szerkesztő űrlap látszódjon

Feature: vine-detail
Type: enhancement
Status: done
Blocked by: –

## Cél

A tőke adatlapon az `Alapadatok szerkesztése` gomb megnyomása után csak a
szerkesztő űrlap legyen látható. Jelenleg az olvasó nézet adatblokkjai
ott maradnak az űrlap fölött, így ugyanaz az adat kétszer szerepel a
képernyőn, és feleslegesen sok helyet foglal – mobilon különösen.

## Kiindulás

A [VineDetail.tsx:321-344](../../dashboard/src/features/vines/ui/VineDetail.tsx#L321-L344)
az `editMode` mellé rendeli a `VineForm`-ot, de a fölötte lévő olvasó nézetet
nem érinti:

- [VineDetail.tsx:258-295](../../dashboard/src/features/vines/ui/VineDetail.tsx#L258-L295) – a `dl` metaadat-rács (telepítési idő, termett már, alanyfajta, eredeti dugvány, területleírás, létrehozva, módosítva)
- [VineDetail.tsx:297-302](../../dashboard/src/features/vines/ui/VineDetail.tsx#L297-L302) – az általános jegyzet blokk

Ezek mind olyan mezők, amelyeket a `VineForm` is szerkeszthetően megjelenít,
tehát szerkesztés közben tiszta duplikáció.

## Scope

- `editMode && isAdmin` esetén a `dl` metaadat-rács és az általános jegyzet
  blokk ne renderelődjön
- a tőke azonosító fejléce (sorszám, fajta, státusz- és címkebadge-ek) maradjon
  látható, hogy szerkesztés közben is egyértelmű legyen, melyik tőkéről van szó
- az eseménynapló szekció szerkesztés közben is maradjon, mert nem duplikálja az
  űrlap mezőit; ha a képernyőterület így is szűk, az űrlap kerüljön a napló elé
  (ez a jelenlegi sorrend, tehát változtatás nélkül teljesül)
- a szerkesztő bezárása (`Szerkesztő bezárása`, `Mégse`, sikeres `Mentés`) után
  az olvasó nézet hiánytalanul térjen vissza
- a `Módosítva` érték mentés után frissülve látszódjon, amikor az olvasó nézet
  visszatér

## Elfogadási kritériumok

- [x] Admin megnyomja az `Alapadatok szerkesztése` gombot, és a metaadat-rács
      és a jegyzet blokk eltűnik, csak az űrlap marad.
- [x] Az azonosító fejléc (`Szőlőtőke #NN`, fajta, badge-ek) szerkesztés közben
      is látszik.
- [x] `Mégse`, `Szerkesztő bezárása` és sikeres `Mentés` után is visszatér a
      teljes olvasó nézet, a mentett értékekkel.
- [x] Sikertelen mentésnél az űrlap nyitva marad a hibaüzenettel, és az olvasó
      nézet ekkor sem jelenik meg duplán.
- [x] Nem admin felhasználónál semmi nem változik.
- [x] A látható állapot mobilon (375 px) és desktopon is reprodukálva és
      képernyőképpel ellenőrizve.
- [x] `npm test`, `npm run lint`, `npm run build` és a Playwright E2E zöld,
      frissített képernyőképekkel.

## Érintett terület

- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/e2e/admin.spec.ts`
- `dashboard/e2e/zz-vine-mutation.spec.ts`
- `dashboard/e2e/vine-detail-form.spec.ts`

## Comments

- 2026-08-04: Ugyanez a duplikáció megvan a dugvány adatlapon is
  ([CuttingDetail.tsx:381](../../dashboard/src/components/CuttingDetail.tsx#L381)
  körül), de a kérés kifejezetten a tőke adatlapra szólt. Ha a megoldás beválik,
  a dugványoldal külön issue-ban követheti, hogy a két adatlap ne csússzon szét.
- 2026-08-04: Megvalósítva. A `dl` és a jegyzet blokk egy származtatott
  `isEditingBasics` jelzőre került, amit az űrlap megjelenítése is használ – így
  a két rész nem tud szétcsúszni, ha nyitott szerkesztő mellett elvész az admin
  jog. A blokkok `data-testid="vine-meta"` és `data-testid="vine-notes"`
  horgonyt kaptak, hogy az E2E az „Általános jegyzet” szövegre ne ütközzön az
  űrlap saját címkéjével.
- 2026-08-04: A borítókép szerkesztés közben is látszik. A scope csak a `dl`-t
  és a jegyzet blokkot nevezte meg, és a borító nem duplikálja az űrlap egyik
  mezőjét sem – a fejléchez hasonlóan azonosítja a tőkét. Ha mobilon így is
  szűk a hely, külön issue döntheti el, hogy szerkesztés közben összecsukódjon.
- 2026-08-04: Menet közben kiderült, hogy a
  `toke-esemeny-urlap-szerkesztes-desktop.png` már a változás előtt is
  instabil volt: a `Szerkesztés` gomb kattintása görget, a dev módban futó
  React Query devtools gombja viszont fix pozíciójú, így a teljes lapos képen
  futásonként máshova esett. A képernyőkép előtti görgetésnullázás és az
  újragenerált snapshot ezt rendezi.
