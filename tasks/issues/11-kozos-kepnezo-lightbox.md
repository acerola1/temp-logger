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

- [ ] Egyetlen néző komponens létezik; a `CuttingPhotoGallery` és a `VineDetail`
      is ezt használja.
- [ ] Görgős és pinch nagyításnál a fókuszpont alatti képrészlet a helyén marad.
- [ ] Nagyított kép nem húzható ki teljesen a vászonról.
- [ ] Mobilon alaphelyzetben a vízszintes húzás lapoz, nagyításban mozgat.
- [ ] Dupla koppintás nagyít, ismételve visszaáll.
- [ ] `Esc` zár, a nyilak lapoznak, `+`/`-`/`0` a nagyítást vezérli.
- [ ] A zoom-panel gombjaira koppintás nem zárja be a nézőt és nem indít húzást.
- [ ] Nyitott néző mellett a háttéroldal nem görgethető; záráskor a korábbi
      `overflow` visszaáll.
- [ ] A tőke adatlapon egy esemény több fotója között lapozni lehet, és látszik
      az `n / összes` számláló.
- [ ] A dugvány-galéria eddigi funkciói (aktív kép, bélyegsor, törlés, új lapon
      megnyitás) nem vesznek el.
- [ ] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/photos/ui/PhotoLightbox.tsx` (új)
- `dashboard/src/components/CuttingPhotoGallery.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`

## Comments
