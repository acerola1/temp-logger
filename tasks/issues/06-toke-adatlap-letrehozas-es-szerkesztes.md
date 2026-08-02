# Tőke-adatlap, létrehozás és szerkesztés

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 03, 05

## Cél

Készüljön el a tőke részletes oldala és az admin létrehozó/szerkesztő folyamata a
production catalog parancsaira kötve.

## Megjelenési referencia

Ez UI-issue: a megjelenésnek és az interakcióknak a worktree-ben elkészült
UI-prototípus alapján kell működniük. Ugyanazokat a desktop és mobil állapotokat kell
reprodukálni, mielőtt layout- vagy spacing-eltérésen módosítás történik.

## Scope

- `/tokek/{vineId}` közvetlenül megnyitható adatlap
- mobil részletmodal és desktop master-detail állapot
- admin **Új tőke** és szerkesztés
- publikus read-only megjelenés
- opcionális forrásdugvány kiválasztás és visszanavigálás

## Elfogadási kritériumok

- [x] A tőkeadatlap a teljes **Szőlőtőke** elnevezést használja, és megjeleníti a
      specifikált alapadatokat, jegyzetet és audit-időket.
- [x] A `/tokek/{vineId}` közvetlen navigáció, a böngésző vissza/előre gombja és a
      lista URL-állapotának megőrzése működik.
- [x] Admin létrehozhat tőkét kötelező fajta, gyökérzettípus és területleírás
      megadásával; a sorszám automatikus és nem szerkeszthető.
- [x] Pontos dátum, csak év és ismeretlen telepítési idő is felvihető.
- [x] Admin a sorszámon kívül minden előírt adatot szerkeszthet, a megszűnt állapotot
      aktívra is visszaállíthatja; végleges törlés nincs a UI-ban.
- [x] Az eredeti dugvány kiválasztható és linkként megnyitható; hiányzó cél esetén
      „A hivatkozott dugvány nem elérhető” állapot látszik.
- [x] Nem admin felhasználó nem lát módosító vezérlőket.
- [x] Mentési pending és hibaállapot nem veszít el bevitt adatot és nem enged
      duplikált beküldést.
- [x] Desktopon és mobilon a lista–adatlap átmenet, az adatlap és az űrlap a
      prototípus megjelenését követi; ezt DOM-ellenőrzés és screenshot igazolja.

## Érintett terület

- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineForm.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`

## Comments

- 2026-08-02: Elkészült a közvetlenül címezhető desktop master–detail és mobil
  részletmodal, a publikus read-only adatlap, valamint az admin létrehozó és
  szerkesztő űrlap a production katalógus-parancsokra kötve.
- 2026-08-02: A review során talált pending alatti mobil bezárást, a dugványlista
  betöltési/hibaállapotát és a lista–adatlap prezentáció eltérését javítottuk.
- 2026-08-02: Ellenőrzés: unit tesztek (26/26), lint, production build és teljes
  Playwright E2E (15/15). A desktop és mobil adatlap-, űrlap- és listasnapshotok
  vizuálisan ellenőrizve.
