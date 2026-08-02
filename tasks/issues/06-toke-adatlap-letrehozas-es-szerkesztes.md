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

- [ ] A tőkeadatlap a teljes **Szőlőtőke** elnevezést használja, és megjeleníti a
      specifikált alapadatokat, jegyzetet és audit-időket.
- [ ] A `/tokek/{vineId}` közvetlen navigáció, a böngésző vissza/előre gombja és a
      lista URL-állapotának megőrzése működik.
- [ ] Admin létrehozhat tőkét kötelező fajta, gyökérzettípus és területleírás
      megadásával; a sorszám automatikus és nem szerkeszthető.
- [ ] Pontos dátum, csak év és ismeretlen telepítési idő is felvihető.
- [ ] Admin a sorszámon kívül minden előírt adatot szerkeszthet, a megszűnt állapotot
      aktívra is visszaállíthatja; végleges törlés nincs a UI-ban.
- [ ] Az eredeti dugvány kiválasztható és linkként megnyitható; hiányzó cél esetén
      „A hivatkozott dugvány nem elérhető” állapot látszik.
- [ ] Nem admin felhasználó nem lát módosító vezérlőket.
- [ ] Mentési pending és hibaállapot nem veszít el bevitt adatot és nem enged
      duplikált beküldést.
- [ ] Desktopon és mobilon a lista–adatlap átmenet, az adatlap és az űrlap a
      prototípus megjelenését követi; ezt DOM-ellenőrzés és screenshot igazolja.

## Érintett terület

- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineForm.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`

## Comments

