# Tőkelista, navigáció, keresés és szűrés

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 02, 03

## Cél

Készüljön el a publikus **Tőkék** lista, a route-kezelés és a lista vezérlősora a
production catalogra kötve.

## Megjelenési referencia

Ez UI-issue: a megjelenésnek és az interakcióknak a worktree-ben elkészült
UI-prototípus alapján kell működniük. A prototípus vizuális referencia; a mock adat,
a prototípus-admin kapcsoló és a komponensekbe épített üzleti logika nem emelendő át
production megoldásként.

## Scope

- **Tőkék** menüpont és `/tokek` route
- URL-ben megőrzött keresés, szűrés és rendezés
- responsive lista és desktop kiválasztott állapot
- loading-, hiba- és üres állapotok
- prototípussal egyező listakártya

## Elfogadási kritériumok

- [ ] A **Tőkék** menüpont megnyitja a `/tokek` oldalt.
- [ ] Alapértelmezésben csak aktív tőkék látszanak, utolsó módosítás szerint
      csökkenő sorrendben.
- [ ] A keresés, a négy szűrő és a három rendezési lehetőség a specifikáció szerint
      működik, és állapotuk URL-ben megmarad frissítés és visszanavigálás után.
- [ ] A listakártya kizárólag sorszámot, fajtát, gyökérzettípust, állapotot és
      címkéket mutat; területleírást és `Termett már` értéket nem.
- [ ] A lista loading-, lekérdezési hiba-, nincs felvitt tőke- és nincs találat
      állapotot érthetően jelenít meg.
- [ ] Desktopon a kiválasztás és a listaelrendezés, mobilon a lista és vezérlők
      megjelenése a prototípust követi.
- [ ] DOM-ellenőrzés és desktop/mobil screenshot bizonyítja a prototípussal való
      vizuális egyezést a releváns állapotokban.

## Érintett terület

- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/ui/VinesList.tsx`
- `dashboard/src/features/vines/index.ts`
- `dashboard/src/App.tsx` és routing

## Comments

