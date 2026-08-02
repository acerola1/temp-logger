# A tőkekövetés domainmodellje, űrlap-leképezése és listaállapota

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: -

## Cél

Készüljön el a production tőkekövetés tiszta, Firebase- és React-független alapja a
[PRD](../vine-tracking/spec.md) és a [codebase design](../vine-tracking/codebase-design.md)
alapján.

## Scope

- a kanonikus `Vine`, `VineEvent`, telepítési pontosság, gyökérzet- és állapottípusok
- a létrehozási, szerkesztési és eseményparancsok inputjai
- Zod-validáció és form → domain normalizálás
- a lista URL-állapotának parse/serialize műveletei
- keresés, szűrés és rendezés tiszta szelektora
- a feature publikus felületének előkészítése úgy, hogy később csak a `VinesPage`
  legyen exportálva

A prototípus `removed`/`removal`, `rootstockType`, `plantedAt` és általános
`Partial<Vine>` frissítési modellje nem production szerződés.

## Elfogadási kritériumok

- [ ] A production modell a `active`/`ceased`, illetve az
      `observation`/`pruning`/`spraying`/`ceased` kanonikus értékeket használja.
- [ ] A telepítési idő pontos dátumként, csak évként vagy explicit ismeretlenként
      reprezentálható.
- [ ] A fajta és területleírás trimelés után kötelező; ismeretlen fajtaként az
      `Ismeretlen` szabad szöveg elfogadható.
- [ ] Nem oltott tőkénél az alanyfajta üres stringre normalizálódik.
- [ ] Az üres eseménycím az eseménytípus magyar feliratára normalizálódik.
- [ ] Az URL-alapú listaállapot alapértéke: aktív tőkék, legutóbb módosított elöl.
- [ ] A keresés fajtában, sorszámban és területleírásban keres; a négy előírt
      szűrő és három rendezés működik.
- [ ] Telepítési idő szerinti rendezésnél az év január 1-jének felel meg, az
      ismeretlen értékek pedig a lista végére kerülnek.
- [ ] A tiszta modulokat unit tesztek fedik, beleértve az URL round-tripet és a
      normalizálási szélső eseteket.

## Érintett terület

- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/forms.ts`
- `dashboard/src/features/vines/listState.ts`
- kapcsolódó unit tesztek

## Nem része

- Firebase-adattárolás
- React UI
- a prototípus komponenseinek productionné alakítása

## Comments

