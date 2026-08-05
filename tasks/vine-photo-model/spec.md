# Koncepció: a tőkefotók önálló modellje

## Státusz

Implementálva. A migrációs eszköz a
[`functions/scripts/migrate-vine-photos.js`](../../functions/scripts/migrate-vine-photos.js)
(20-as issue), a dashboard cutover a 21-es issue. A tőke a gyökérszintű
`photos[]` és `coverPhotoId` mezőt használja, a `VineEvent` nem tartalmaz fotót,
és a tőke a dugvánnyal közös galéria- és lightbox-modult használja. Az éles
adatmigráció futtatási sorrendje a
[cutover runbookban](../../docs/runbooks/migrate-vine-photos.md) van.

Ez a dokumentum a tőkefotók tulajdonlásában, életciklusában és
megjelenítésében felülírja a korábbi
[tőkekövetési specifikációt](../vine-tracking/spec.md), annak
[codebase designját](../vine-tracking/codebase-design.md), valamint az
[egységes fotókezelés specifikációját](../photo-handling/spec.md).

## Probléma

A jelenlegi modellben a fotók a `VineEvent.photos[]` tömbben élnek. Ez azt
fejezi ki, hogy egy fotó az esemény melléklete, ezért:

- a tőke képei eseménykártyák között szétszórva jelennek meg;
- a teljes tőkegalériához minden esemény fotóit össze kell gyűjteni;
- a borítóképhez esemény- és fotóazonosító páros kell;
- eseménytörlés a fotó életciklusát is magával viszi;
- a több tőkés eseményrögzítés ugyanazokat a kiválasztott fájlokat tőkénként
  lemásolja, noha nincs több tőke között valóban közös fotó.

A használati modell ezzel szemben az, hogy a permetezés és a metszés lehet
több tőkét érintő adatbevitel, a fotó viszont egy konkrét tőke önálló
dokumentuma. Egy tőke összes képét egy galériában és egy lightbox-sorrendben
kell tudni végignézni.

## Döntés

A tőke két egymástól független tartalomlistát birtokol:

```ts
type VinePhoto = Photo;

interface Vine {
  // a tőke többi mezője
  photos: VinePhoto[];
  events: VineEvent[];
  /** `null` esetén automatikusan a legújabb fotó a borító. */
  coverPhotoId: string | null;
}

interface VineEvent {
  id: string;
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
```

A `VineEvent` nem tartalmaz `photos` mezőt. A `VinePhoto` nem tartalmaz
`eventId`-t vagy más eseményhivatkozást. Az időbeli közelségből a domainmodell
nem következtet kapcsolatra.

## Domaininvariánsok

1. Egy tőkefotó pontosan egy szőlőtőkéhez tartozik.
2. Tőkefotó és tőkeesemény között nincs tárolt domainkapcsolat.
3. Fotóművelet nem hoz létre, nem szerkeszt és nem töröl eseményt.
4. Eseményművelet nem hoz létre, nem szerkeszt és nem töröl fotót.
5. Tömeges eseményrögzítés tőkénként önálló, később külön szerkeszthető
   eseménypéldányt hoz létre; nem készül közös eseményentitás.
6. A fotó `capturedAt` értéke kizárólag a fájl EXIF-adataiból származhat és
   lehet `null`; a felületen nem szerkeszthető.
7. A fotó `uploadedAt` értékét a rendszer adja, és nem szerkeszthető.
8. A fotó `caption` értéke opcionális szöveg, feltöltés után szerkeszthető.
9. A kézzel kijelölt borító egy létező tőkefotóra mutat. A kijelölt fotó
   törlése ugyanabban a tőkefrissítésben automatikusra állítja a borítót.
10. Minden tartós fotóművelet frissíti a tőke `updatedAt` értékét.
11. Egy tőkéhez legfeljebb 100 fotó tartozhat. A korlátot feltöltés előtt és a
    Firestore-tranzakcióban is ellenőrizni kell.

## Fotóműveletek

A catalog szándékalapú fotóműveleteket ad. A pontos függvénynevek az
implementáció során változhatnak, az interface jelentése azonban ez:

```ts
interface VinePhotoCommands {
  addVinePhotos(input: {
    vineId: string;
    photos: File[];
  }): Promise<void>;

  deleteVinePhoto(input: {
    vineId: string;
    photoId: string;
  }): Promise<void>;

  editVinePhotoCaption(input: {
    vineId: string;
    photoId: string;
    caption: string;
  }): Promise<void>;

  setVineCoverPhoto(input: {
    vineId: string;
    photoId: string | null;
  }): Promise<void>;
}
```

Az eseményműveletek inputja nem fogad fotófájlokat. A tőke létrehozási és
szerkesztési inputja szintén nem fogad fotókat: előbb létrejön a tőke, majd az
adatlapján külön művelettel lehet fényképet hozzáadni.

## Feltöltés és tárolás

Az új tőkefotók Storage-útvonala:

```text
vines/{vineId}/photos/{photoId}.{extension}
```

A fotómetaadatok a tőkedokumentum gyökérszintű `photos[]` tömbjében élnek. A
fotó továbbra is a közös `Photo` metaadatalakot használja:

- `id`;
- `storagePath` és `downloadUrl`;
- `width` és `height`;
- opcionális bélyegkép-metaadat;
- `capturedAt`;
- `uploadedAt`;
- `caption`.

Egy feltöltési művelet legfeljebb hat képet fogad, egy tőkéhez pedig legfeljebb
100 fotó tartozhat. A felület már a fájlok előkészítése és feltöltése előtt a
szabad kapacitásra vágja a választást, nulla szabad helynél pedig érthető
hibaüzenettel megáll. A catalog a tranzakcióban újra ellenőrzi a korlátot, hogy
párhuzamos írás se léphesse túl. A tőkefotók hosszabbik oldala legfeljebb
1280 px; a dugványfotók meglévő 1000 px-es korlátja nem változik.

## Rendezés és borítókép

A fotók megjelenítési időpontja:

```ts
const displayTime = photo.capturedAt ?? photo.uploadedAt;
```

A tőkegaléria és a lightbox legújabbtől a legrégebbi felé rendez. Azonos
megjelenítési időnél az `uploadedAt`, majd az `id` ad determinisztikus
sorrendet. A tárolt tömb sorrendje nem domainjelentésű. A galéria, a lightbox,
az automatikus borító, a listakártya és az adatlap fejléce ugyanazt az egy
közös rendezőfüggvényt használja; külön borítórendezés nem maradhat.

A tie-break megváltozása miatt néhány, azonos időpontú régi fotónál az
automatikus borító megváltozhat. Ez vállalt és tesztelt cutover-hatás.

A valódi `capturedAt` és `uploadedAt` nélküli régi dugványfotók a jelenlegi
epoch-fallback alapján ismeretlen idejűnek számítanak. Ezek a dátummal
rendelkező képek után kerülnek, egymás között a korábbi tömbsorrendjüket tartják
meg. Nem használjuk a dugvány létrehozási idejét fotóidőpontként. Ezt a
fallbacket külön teszt fedi.

A `coverPhotoId` jelentése:

- `null`: automatikus borító, a fenti rendezés első fotója;
- fotóazonosító: kézzel rögzített borító;
- hiányzó vagy hibás fotóazonosító: olvasáskor csendes visszaesés az
  automatikus borítóra.

## Közös galériamodul

A tőke és a dugvány ugyanazt a galériamodult használja. A modul interface-e
fotólistát és szándékalapú callbackeket kap; nem ismeri a Firestore-t, a
Storage-útvonalakat vagy a tőke- és dugványdokumentumok alakját.

```ts
interface PhotoGalleryProps {
  photos: readonly Photo[];
  isAdmin: boolean;
  maxSelectionCount?: number; // alapértelmezés: 6
  onAddPhotos(files: File[]): Promise<void>;
  onDeletePhoto(photoId: string): Promise<void>;
  onEditCaption(photoId: string, caption: string): Promise<void>;
  cover?: {
    pinnedPhotoId: string | null;
    onPin(photoId: string | null): Promise<void>;
  };
}
```

A `pinnedPhotoId` csak a kézi kijelölést jelenti. A modul a tényleges borítót
a saját rendezett fotólistájából vezeti le, ezért az automatikus és a kijelölt
állapotot egyaránt meg tudja jeleníteni. A hívónak nem kell második
borítófeloldást átadnia.

A közös viselkedés:

- legújabb fotó elöl;
- egyetlen, teljes fotólistát bejáró `PhotoLightbox`;
- mobil kamera- és galériaválasztás;
- feltöltésenként legfeljebb hat kép;
- fotónkénti képaláírás-szerkesztés;
- egyenkénti, megerősítést kérő végleges törlés;
- a készítési vagy feltöltési idő egyértelmű megjelenítése.

A közös layout egy nagy aktív képből és alatta bélyegrácsból áll. A lightbox az
aktív képről nyílik, az adminműveletek — képaláírás, törlés és opcionális
borítókép-kijelölés — az aktív kép műveleti sávjában jelennek meg. Nem készül
külön tőkés, soronkénti fotólista.

A borítókép-kezelés opcionális galériaképesség: a tőke bekapcsolja, a dugvány
egyelőre nem kap kézi borítókép-kijelölést. A képelőkészítési méretkorlátot a
hívó adja át, ezért a közös felület nem kényszerít azonos felbontást.

## Felhasználói folyamatok

### Fotó hozzáadása

1. Az admin megnyit egy már létező tőkét.
2. A tőke önálló `Fotók` szakaszában elindítja a kamera- vagy
   galériaválasztást.
3. Egy műveletben legfeljebb hat képet választ.
4. A rendszer a tőkénkénti 100-as korlát szabad kapacitására vágja a
   választást.
5. A rendszer feltölti a képeket, és üres képaláírással hozzáadja őket a
   tőke `photos[]` tömbjéhez.
6. A képaláírások szükség esetén külön-külön, feltöltés után szerkeszthetők.

### Fotó törlése

1. Az admin megerősíti egy tőkefotó törlését.
2. A tranzakció eltávolítja a metaadatot a `photos[]` tömbből, frissíti a
   tőke `updatedAt` értékét, és kijelölt borító esetén nullázza a
   `coverPhotoId` mezőt.
3. Ezután best-effort törlés indul a fotó és a bélyegkép saját
   `storagePath` értéke alapján.

Nincs kuka vagy visszaállítás. Esemény törlése ezt a folyamatot soha nem
indítja el.

### Esemény rögzítése

Az eseményűrlapon nincs fotóválasztás. Egy vagy több tőke kijelölhető, de a
mentés minden tőkén önálló eseménypéldányt hoz létre. Az eseménykártyák nem
mutatnak fotósort és nem tartalmaznak fotóműveleteket.

Egyetlen tőkére mentett esemény sikerjelzése `Fotó hozzáadása ehhez a tőkéhez`
műveletet kínál, amely közvetlenül a tőke külön fotóválasztóját nyitja meg.
Ez kényelmi navigáció: nem ad `eventId`-t a fotónak, és nem kapcsolja össze a
két mentést. Többtőkés eseménynél a célpont kétértelműsége miatt nincs ilyen
gyorsművelet.

## Megjelenítési vetületek

Az első megjelenítés külön `Fotók` galériát és külön eseménynaplót használ.
Nyitott későbbi UX-döntés, hogy készüljön-e közös idővonal. Egy ilyen idővonal
a `Vine.photos[]` és `Vine.events[]` elemeit dátum szerint összefésülő olvasási
vetület lesz; nem vezet be esemény–fotó hivatkozást és nem változtatja meg a
tárolási modellt.

## Migráció

Külön, idempotens migrációs script alakítja át a meglévő adatokat. A script
először kötelezően támogat `--dry-run` módot.

Tőkénként:

1. összegyűjti az `events[].photos[]` rekordokat;
2. átemeli őket a gyökérszintű `photos[]` tömbbe, minden metaadat
   megőrzésével;
3. fotóazonosító-ütközésnél új azonosítót oszt, és ugyanazzal a leképezéssel
   kezeli a borítókép-hivatkozást;
4. az érvényes `{ eventId, photoId }` borítót `coverPhotoId` értékké alakítja;
5. hibás vagy hiányzó borítóhivatkozást `null`-ra állít;
6. eltávolítja a régi gyökérszintű `coverPhoto` mezőt;
7. eltávolítja az események `photos` mezőjét;
8. a teljes tőkeátalakítást egyetlen atomi írásban végzi el.

A Storage-fájlokat nem mozgatjuk. A migrált rekordok megtartják régi
`storagePath` és letöltési URL értékeiket, az új feltöltések már az új útvonalra
kerülnek. A Storage-szabályok a régi útvonal publikus olvasását és admin
törlését továbbra is engedik, az új útvonalhoz pedig ugyanezeket a
jogosultságokat adják.

A migráció előtt kötelező Firestore-export vagy azzal egyenértékű, ellenőrzött
JSON-mentés készül. A script alapértelmezett dry-runja mellett külön `--verify`
mód ellenőrzi, hogy maradt-e legacy eseményfotó, hibás borító vagy részlegesen
migrált tőke. A dashboard cutover csak nulla hibás találatnál indulhat.

A migráció alatt admin írás nem történhet. Egy megszakadt futás után a már
migrált tőkék érvényesek maradnak, a script pedig idempotensen folytatható. A
vállalt karbantartási sorrend:

1. mentés;
2. admin write-stop;
3. dry-run;
4. migráció;
5. `--verify` nulla hibával;
6. új dashboard deploy;
7. publikus és admin gyorsellenőrzés;
8. admin írás visszaengedése.

A rövid átmeneti megjelenítési ablak ennél az egyszemélyes rendszernél tudatosan
vállalt. Nem készül tartós vagy ideiglenes kettős olvasási és kettős írási
kompatibilitási réteg.

## Nem cél

- Fotó és esemény kézi vagy automatikus összekapcsolása.
- Közös, több tőke által birtokolt fotó.
- Közös eseményentitás létrehozása több céltőkével.
- Fotó készítési idejének kézi javítása.
- Fotó feltöltése az esemény- vagy tőkelétrehozó űrlapon.
- Kuka, visszaállítás vagy fotóverziók.
- Fotók Firestore-alkollekcióba mozgatása a 100-as biztonsági korlát alatt.
- A közös esemény–fotó idővonal megvalósítása ebben a változtatásban.

## Elfogadási irányok a későbbi implementációhoz

- A tőke összes fotója egy galériában és egy lightbox-sorrendben járható be.
- Esemény hozzáadása, szerkesztése és törlése egyetlen fotót sem módosít.
- Fotó hozzáadása, szerkesztése és törlése egyetlen eseményt sem módosít.
- A kézi és automatikus borító ugyanabból a gyökérszintű fotólistából oldódik
  fel.
- A galéria és a borító ugyanazt a közös rendezőfüggvényt használja.
- A tőke és a dugvány ugyanazt a galéria- és lightbox-modult használja.
- A migráció dry-runja és tényleges futása ismételhető, adatvesztés nélkül.
- A migráció utáni `--verify` nulla legacy és inkonzisztens rekordot jelez.
- Régi és új Storage-útvonalon lévő fotó egyformán megnyitható és törölhető.
