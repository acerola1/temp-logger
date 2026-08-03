# Egységes fotókezelés: megvalósítási térkép

Források:

- [Termékspecifikáció](./spec.md)
- Összehasonlítási referencia: `../szoloink/frontend/src/components/Forum/`
  (`ImageAttachInput.tsx`, `ImageLightbox.tsx`, `CommentImages.tsx`) és
  `../szoloink/frontend/src/utils/resizeImage.ts`

## Issue-k

| ID | Feladat | Függőség | Status |
| --- | --- | --- | --- |
| [09](../issues/09-kozos-foto-feature-kiemelese.md) | Közös fotó-feature kiemelése, duplikált feltöltés megszüntetése | – | done |
| [10](../issues/10-tokeesemeny-mobil-kamera-es-fotoelonezet.md) | Tőkeesemény: mobil kamera és fotó-előnézet | 09 | ready-for-agent |
| [11](../issues/11-kozos-kepnezo-lightbox.md) | Közös képnéző gesztusokkal, tőke adatlap bekötése | 09 | ready-for-agent |
| [12](../issues/12-egyseges-foto-metaadat.md) | Egységes fotó-metaadat és valódi készítési idő | 09 | ready-for-agent |
| [13](../issues/13-tokeesemeny-fotoinak-utolagos-kezelese.md) | Tőkeesemény fotóinak utólagos kezelése | 10, 11 | ready-for-agent |

## Végrehajtási sorrend

```text
09 ┬→ 10 ┬→ 13
   ├→ 11 ┘
   └→ 12
```

A `10`, `11` és `12` a `09` lezárása után párhuzamosan végezhető: külön
fájlokat érintenek, közös metszetük csak a `features/photos` publikus felülete.
A `13` a választó- és néző-komponenseket használja, ezért a `10` és `11` után jön.
A `12` és a `13` egymás mellett is futhat, csak a `caption` mezőn találkoznak:
a mezőt a `12` vezeti be, a szerkesztő felületét a `13` adja.

## Miért most

A `04` és `07` issue-val a tőkés fotókezelés úgy készült el, hogy újraírta a
meglévő feltöltő hurkot, közben a mobil kameraindítás kimaradt belőle. A `09`
ezt a széttartást vezeti vissza egy modulba, a `10`–`12` pedig a hiányzó
képességeket pótolja mindkét oldalon.
