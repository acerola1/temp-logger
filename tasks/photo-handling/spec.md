# PRD: Egységes fotókezelés

> **Későbbi döntés:** a tőkefotók eseményhez kötött kezelését felülírja a
> [tőkefotók önálló modelljének koncepciója](../vine-photo-model/spec.md).
> A közös fotó-metaadat és képkezelő modul megmarad, de a tőkefotók a tőke
> gyökérszintű fotólistájába kerülnek.

## Összefoglaló

A dashboardban ma **három** helyen készül fotófeltöltés (dugvány-galéria,
munkamenet-esemény, tőkeesemény), és a három nem ugyanazt tudja. A tőkekövetés
(`features/vines`) saját feltöltő-hurkot írt a meglévő `usePhotoUpload` mellé,
közben a mobil kameraindítás – ami a dugványoknál évek óta megvan – kimaradt
belőle.

A cél egy közös **fotó-feature** (`dashboard/src/features/photos/`), amit
mindhárom hívó használ: közös kép-előkészítés, közös feltöltés
(progress + hibakompenzáció), közös választó (kamera/galéria) és közös képnéző.

## Probléma

### 1. Duplikált feltöltési logika

A `features/vines/vineEventPhotos.ts` és a `hooks/usePhotoUpload.ts` ugyanazt a
három lépést valósítja meg egymástól függetlenül:

| Lépés | `usePhotoUpload` | `vineEventPhotos` |
| --- | --- | --- |
| `prepareImageUpload` hívás | igen | igen (`prepareVineEventPhotos` burkolóval) |
| soros `uploadBytesResumable` hurok | igen | igen |
| aggregált progress számítás | igen (`%`) | igen (`bytes/total`) |
| `getDownloadURL` + metaadat | igen | igen |
| hiba esetén Storage-takarítás | **nincs** | igen |
| `storagePath` felépítése | callbackkel | fix függvénnyel |

A review azért nem szúrta ki, mert a `vineEventPhotos` a
`prepareImageUpload`-ot **használja**, tehát elsőre úgy néz ki, mint ami
újrahasznosít. A tényleges duplikáció a hurok, a progress és a
`getDownloadURL` körüli rész.

A kompenzáció viszont csak a tőkés ágban készült el – a dugvány- és
munkamenet-feltöltés hibára ma árva Storage-objektumokat hagyhat maga után.
A közös verzióba a jobbik viselkedés kell.

### 2. A tőkénél hiányzik a mobil kamera

A `VineEventForm` nyers `<input type="file" multiple>`-t használ. Nincs
kameragomb, nincs előnézet, nincs egyenkénti eltávolítás. A `usePhotoPicker` és
a `Fotózás / Galéria` gombpár már létezik (`SessionEventForm`,
`CuttingPhotoGallery`, `CuttingForm`), csak nem ide is bekötve.

### 3. Három különböző képnéző

| Hely | Nézet |
| --- | --- |
| `CuttingPhotoGallery` | teljes galéria: aktív kép, bélyegsor, lapozás, teljes képernyős néző zoommal, pinch-csel, billentyűkkel |
| `VineDetail` | 80×80-as bélyegek, kattintásra egy `<img>` fekete overlayen – nincs zoom, lapozás, billentyű, Esc |
| `SessionEventList` | egy kép, néző nélkül |

### 4. Széttartó fotó-metaadat

`CuttingPhoto`-ban van `capturedAt` és `caption`, a `VineEventPhoto`-ban nincs.
A `capturedAt` ráadásul a dugványnál sem valódi: a `toCuttingPhotos` a
feltöltés idejét írja bele, EXIF-ből nem olvasunk.

### 5. A tőkeeseményfotók befagynak

Egy tőkeesemény fotói csak a létrehozás pillanatában adhatók meg. Az `editEvent`
a típust, időpontot, címet és jegyzetet írja, a `photos` tömböt nem. Ha a
fotózás kimaradt vagy egy kép rossz lett, csak az egész esemény törlésével és
újrarögzítésével javítható.

## Összehasonlítás: `../szoloink`

A szoloink fórum-képkezelése a **választó** és a **néző** rétegben lényegesen
előrébb tart, a **feltöltés** rétegben viszont mögöttünk van.

### Amiben a szoloink jobb

**Érintőeszköz-felismerés** (`components/Forum/ImageAttachInput.tsx`)

```ts
const uaMobile = /Android|...|Mobile/i.test(navigator.userAgent);
const touchPrimary =
  (navigator.maxTouchPoints ?? 0) > 0 &&
  window.matchMedia("(pointer: coarse)").matches;
return uaMobile || touchPrimary;
```

A mi `usePhotoPicker`-ünk csak a userAgent-regexet nézi. Az iPadOS 13+ Safari
desktop userAgentet küld (nincs benne `iPad`), így **tableten ma nem jelenik meg
a kameragomb**. A `pointer: coarse` feltétel egyben kizárja a touch-laptopokat.

**`capture` és `multiple` együtt vált**

A szoloink kameránál leveszi a `multiple`-t (a kamera úgyis egy képet ad),
galériánál visszateszi. Nálunk csak a `capture` vált, a `multiple` marad.

**Előnézet és eltávolítás feltöltés előtt**

90×90-es bélyegek ✕ gombbal, `maxImages` limit (alap: 6) és a maradék helyre
vágás. Nálunk a `SessionEventForm` csak a fájlnevet írja ki, a `VineEventForm`
csak a darabszámot.

**Ugyanaz a fájl újraválasztható**

`event.target.value = ""` a `change` kezelőben is, nem csak a `click` előtt.

**Képnéző** (`components/Forum/ImageLightbox.tsx`)

A miénkhez képest többlet:

- pinch és görgő **fókuszpontra** nagyít (a kurzor alatti részlet a helyén marad),
  a mi `CuttingPhotoGallery`-nk mindig a kép közepére
- **eltolás-korlátozás**: a nagyított kép nem húzható ki a képernyőről
  (nálunk kihúzható)
- **swipe-lapozás** rubber-band fékezéssel a sáv két végén
- **dupla koppintás / dupla klikk** 2,5×-re
- a filmszalag `translate3d`-vel úszik, a szomszédos kép `loading="eager"`
- a görgő nem passzív listenerrel van kötve, így a `preventDefault` tényleg hat
- `data-lightbox-ui` őrszem: a vezérlőkre koppintás nem indít gesztust
- egy komponens, három hívóval (`CommentImages`), nem oldalanként újraírva

### Amiben mi vagyunk jobbak

- **Resumable feltöltés valós progresszel.** A szoloink `uploadString`-gel tol
  fel data-URL-t, progress nélkül.
- **`storagePath` tárolása.** Nálunk a rekordban ott a Storage-útvonal, így a
  törlés determinisztikus.
- **Kompenzáció.** A `vineEventPhotos` hibára takarít; a szoloinkban nincs ilyen.
- **Formátum-megőrzés.** A `prepareImageUpload` png/webp esetén nem kényszerít
  jpeg-et, és a limit alatti képet át sem kódolja. A szoloink mindent jpeg
  data-URL-lé alakít (a data-URL ~33% méret-többlet is).

### Méretkorlát

A szoloink 1280 px-es korlátját a **tőkeeseményfotókra átvettük**
(`VINE_EVENT_PHOTO_MAX_SIDE`): a tőke a szabad ég alatt áll, és a fontos
részletek – rügy, metszés, betegségtünet – 1000 px-en már elmosódtak. A
dugványoldal marad 1000 px-en, ott közeli, sátorban készült képekről van szó.

A jpeg-minőség nálunk 0,9 marad a szoloink 0,85-jével szemben.

Ebből következik, hogy a közös modul **nem** rögzíthet egyetlen globális
méretkorlátot: a hívó adja meg, alapértelmezés hiányában 1000 px.

### Amit tudatosan **nem** veszünk át

- data-URL-es köztes formátum (memóriafaló, és elrontja a progresszt)
- MUI-komponensek – nálunk Tailwind van
- fix `Date.now()`-os fájlnév; marad a `crypto.randomUUID()`

## Célállapot

```text
dashboard/src/features/photos/
  imagePreparation.ts   # prepareImageUpload + getFileExtension ide költözik
  photoUpload.ts        # keretrendszer-független feltöltés + kompenzáció
  usePhotoUpload.ts     # React-burkoló progresszel és hibaüzenettel
  usePhotoPicker.ts     # érintő-felismerés + capture/multiple váltás
  ui/PhotoPickerButtons.tsx  # Fotózás / Galéria / Kép kiválasztása gombpár
  ui/PhotoPreviewList.tsx    # kiválasztott képek bélyegei ✕ gombbal
  ui/PhotoLightbox.tsx       # közös teljes képernyős néző
```

Hívók: `CuttingPhotoGallery`, `CuttingForm`, `CuttingsPage`,
`SessionEventForm`, `VineEventForm`, `VineDetail`.

## Termék alapelvek

- A fotózás minden eszközön egy koppintás legyen, ne fájlböngésző-túra.
- Ami feltöltődött, annak legyen gazdája: hibára ne maradjon árva objektum.
- Egy képnéző legyen, ne oldalanként másik.
- A refaktor ne változtasson a dugványoldal látható viselkedésén, csak bővítsen.

## Nem cél ebben a verzióban

- szerveroldali átméretezés vagy thumbnail-generálás
- offline / háttérben folytatódó feltöltés
- meglévő fotórekordok visszamenőleges EXIF-újrafeldolgozása
- EXIF-olvasó npm-függőség: saját, két mezőre szűkített parser készül
- dugványfotók áthelyezése esemény alá – a dugványoldal fotói továbbra is
  dugvány szintűek, csak a tőkeoldalon tartoznak fotók eseményhez
