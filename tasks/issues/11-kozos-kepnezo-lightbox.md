# Közös képnéző: gesztusok, lapozás és a tőke adatlap bekötése

Feature: photo-handling
Type: feature
Status: ready-for-agent
Blocked by: 09

## Cél

Egy képnéző legyen a dashboardban, a szoloink fórum-lightboxának gesztusaival,
és a tőke adatlap is ezt kapja a mostani zoom nélküli overlay helyett.

## Kiindulás

- `CuttingPhotoGallery`: teljes néző zoommal, pinch-csel, billentyűkkel – de a
  nagyítás mindig a kép közepére megy, a nagyított kép kihúzható a képernyőről,
  és nincs swipe-lapozás.
- `VineDetail`: 80×80-as bélyegek, kattintásra egy `<img>` fekete overlayen.
  Nincs zoom, lapozás, billentyűkezelés, Esc, görgetészár.
- `../szoloink/frontend/src/components/Forum/ImageLightbox.tsx`: fókuszpontra
  nagyítás, eltolás-korlátozás, swipe rubber-banddel, dupla koppintás,
  nem passzív wheel listener, `data-lightbox-ui` őrszem. Ezt vesszük mintának,
  Tailwindre átültetve.

## Megjelenési referencia

A néző vizuális nyelve a mostani `CuttingPhotoGallery` teljes képernyős nézője
maradjon (fekete háttér, kerek overlay gombok, zoom-panel, alsó számláló). A
változás az interakcióban van, nem a látványban. Mobilon és desktopon is
reprodukálni kell a látható állapotot módosítás előtt.

## Scope

- `features/photos/ui/PhotoLightbox.tsx`: képlista + kezdőindex + `onClose`
- fókuszpontra nagyítás görgővel és pinch-csel
- eltolás korlátozása a nagyított kép és a vászon méretkülönbségére
- swipe-lapozás, a két végén fékezett húzással; nem körkörös
- dupla koppintás / dupla klikk nagyít és visszaállít
- billentyűk: `Esc`, `←`, `→`, `+`, `-`, `0`
- a vezérlőgombokra érkező pointer ne indítson gesztust
- `body` görgetészár, amíg a néző nyitva van
- `CuttingPhotoGallery` a saját nézőjét erre cseréli
- `VineDetail` eseményfotói bélyegsorra + közös nézőre állnak, eseményen belüli
  lapozással

## Elfogadási kritériumok

- [x] Egyetlen néző komponens létezik; a `CuttingPhotoGallery` és a `VineDetail`
      is ezt használja.
- [x] Görgős és pinch nagyításnál a fókuszpont alatti képrészlet a helyén marad.
- [x] Nagyított kép nem húzható ki teljesen a vászonról.
- [x] Mobilon alaphelyzetben a vízszintes húzás lapoz, nagyításban mozgat.
- [x] Dupla koppintás nagyít, ismételve visszaáll.
- [x] `Esc` zár, a nyilak lapoznak, `+`/`-`/`0` a nagyítást vezérli.
- [x] A zoom-panel gombjaira koppintás nem zárja be a nézőt és nem indít húzást.
- [x] Nyitott néző mellett a háttéroldal nem görgethető; záráskor a korábbi
      `overflow` visszaáll.
- [x] A tőke adatlapon egy esemény több fotója között lapozni lehet, és látszik
      az `n / összes` számláló.
- [x] A dugvány-galéria eddigi funkciói (aktív kép, bélyegsor, törlés, új lapon
      megnyitás) nem vesznek el.
- [x] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/photos/ui/PhotoLightbox.tsx` (új)
- `dashboard/src/features/photos/photoLightboxView.ts` (új)
- `dashboard/src/components/CuttingPhotoGallery.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`

## Comments

- 2026-08-03: A `PhotoLightbox` a szoloink fórum-lightboxának gesztusait kapta
  Tailwindre átültetve (fókuszpontra nagyítás, eltolás-korlátozás, filmszalag
  rubber-banddel, dupla koppintás, nem passzív wheel listener,
  `data-lightbox-ui` őrszem), a látványa viszont a mostani dugvány-néző maradt:
  fekete háttér, kerek overlay gombok, bal felső zoom-panel, alsó számláló.
- 2026-08-03: A néző csak nyitott állapotban van mountolva (`images` +
  `initialIndex` + `onClose`), így nincs szinkronizálási hurok a hívó
  állapotával. A `CuttingPhotoGallery` az `onIndexChange`-en keresztül követi a
  lapozást, ezért záráskor ott marad az aktív kép, ahol a nézőben abbahagytuk.
- 2026-08-03: A nagyítás matematikája külön, DOM nélküli modulba került
  (`photoLightboxView.ts`): a fókuszpontra nagyítás és az eltolás-korlátozás így
  unit teszttel bizonyítható, a komponens csak megméri a képet és a vásznat.
- 2026-08-03: A `VineDetail` nézője kikerült a mobil részletmodal wrapperéből:
  korábban a benne lévő koppintás felbukott a wrapper `onClick`-jére, és a
  képnéző zárása az egész adatlapot bezárta.
- 2026-08-03: A lapozás szándékosan nem körkörös, ezért a dugvány-galéria e2e
  lépése az utolsó képen már a letiltott `Következő kép` gombot ellenőrzi, és
  visszafelé lapoz. Az eseményfotók bélyeggombjai több kép esetén sorszámot
  kapnak az akadálymentes nevükben.
- 2026-08-03: Ellenőrzés: unit + komponenstesztek (84/84), lint, production
  build, teljes Playwright E2E (18/18) két fotóra bővített seed eseménnyel.
  Igazi böngészőben visszanéztem a néző desktop és mobil állapotát, a húzásos
  lapozást, a dupla klikkes nagyítást és azt, hogy a nagyított kép eltolása
  pontosan a vászon határán áll meg.
