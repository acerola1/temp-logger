# Codebase design: Szőlőtőke-követés

> **Későbbi döntés:** a fotók seam-jére, adattárolására és eseménykapcsolatára
> vonatkozó részeket felülírja a
> [tőkefotók önálló modelljének koncepciója](../vine-photo-model/spec.md).
> A jelen dokumentumban szereplő `VineEvent.photos[]` és
> `{ eventId, photoId }` borítóhivatkozás nem a célmodell.

## Cél

Ez a dokumentum a [termékspecifikáció](./spec.md) és az elkészült UI-prototípus
alapján rögzíti a tőkekövetés production moduljait, interface-eit, tárolási
sémáját és tesztfelületét.

A prototípus vizuális és interakciós referencia. A memóriabeli adattárolása,
az általános `updateVine(Partial<Vine>)` művelete és a komponensekben lévő
üzleti szabályok nem kerülnek változtatás nélkül production kódba.

## Tervezési irány

A tőkekövetés egy feature-szintű mély modul legyen. Az alkalmazás többi
része csak egy kis interface-t lásson:

```tsx
<VinesPage isAdmin={isAdmin} />
```

A modulon belül a UI szándék-alapú műveleteket használjon. Ne kapjon
általános, tetszőleges részleges dokumentumfrissítési lehetőséget.

```ts
interface VineCatalogCommands {
  createVine(input: CreateVineInput): Promise<{ vineId: string }>;
  editVine(vineId: string, input: EditVineInput): Promise<void>;
  addEvents(input: AddVineEventsInput): Promise<void>;
  editEvent(input: EditVineEventInput): Promise<void>;
  deleteEvent(input: DeleteVineEventInput): Promise<void>;
}
```

Ez az interface rejti el:

- az automatikus, nem újrahasznált sorszám kiosztását;
- a Firestore dokumentumok alakját;
- a szerveroldali időbélyegeket;
- a több tőkéhez létrehozott külön eseménypéldányokat;
- a megszűnés esemény állapotváltását;
- a beágyazott eseménytömb biztonságos read–modify–write kezelését;
- az eseményfotók átméretezését, feltöltését és törlését;
- a részleges Storage/Firestore hibák kompenzálását.

A modul törlési tesztje teljesül: ha eltávolítanánk, a fenti szabályok és
hibakezelések visszaszivárognának a `VinesPage`, `VineDetail` és űrlapmodulokba.

## Modulstruktúra

Az új kód egy feature-mappában maradjon együtt. Nem szükséges a már működő
dugványkövetést ugyanebben a változtatásban átszervezni.

```text
dashboard/src/features/vines/
├── index.ts                         # csak a VinesPage publikus exportja
├── model.ts                         # domain típusok és invariánsok
├── forms.ts                         # Zod sémák és form ↔ domain leképezés
├── listState.ts                     # URL állapot, keresés, szűrés, rendezés
├── useVineCatalog.ts                # olvasási állapot + szándék-alapú parancsok
├── firestoreVines.ts                # Firestore leképezés és írási implementáció
├── vineEventPhotos.ts               # belső Storage implementáció
└── ui/
    ├── VinesPage.tsx                # feature-orchestrátor
    ├── VinesList.tsx
    ├── VineDetail.tsx
    ├── VineForm.tsx
    └── VineEventForm.tsx
```

### Külső seam

Az `index.ts` kizárólag a `VinesPage` modult exportálja. Az `App` nem ismeri
a tőketípusokat, Firestore útvonalakat, eseménykezelést vagy filtersémát.

### Belső seam-ek

- `useVineCatalog` köti össze a UI-t a tárolási implementációval.
- `listState` tiszta, I/O nélküli modul. A lista URL-állapotát és a látható
  eredményt egy helyen számítja.
- `forms` birtokolja a validációt és a formértékek domain inputtá alakítását.
- `firestoreVines` és `vineEventPhotos` belső implementáció; a UI nem importálja
  közvetlenül a Firebase SDK-t.

Nem készül általános `VineRepository` port. Jelenleg egy valódi adapter van,
a Firebase; az Emulator Suite ugyanezt az adaptert helyettesíti lokálisan.
Egy külön repository-interface most csak hipotetikus seam és plusz indirection
lenne.

## Domainmodell

### Tőke

```ts
type VineStatus = 'active' | 'ceased';
type VineRootType = 'grafted' | 'own_rooted' | 'unknown';

interface Vine {
  id: string;
  serialNumber: number;
  variety: string;
  hasFruited: boolean;
  rootType: VineRootType;
  rootstockVariety: string;
  plantingYear: number | null;
  areaDescription: string;
  status: VineStatus;
  tags: string[];
  notes: string;
  sourceCuttingId: string | null;
  events: VineEvent[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUid: string | null;
}
```

A production modellben a prototípus `removed` és `removal` nevei ne
maradjanak meg. A termékfogalom általános **megszűnés**, ezért a kanonikus
technikai érték `ceased`.

### Esemény

```ts
type VineEventType = 'observation' | 'pruning' | 'spraying' | 'ceased';

interface VineEventPhoto {
  id: string;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  uploadedAt: IsoDateTimeString;
}

interface VineEvent {
  id: string;
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
  photos: VineEventPhoto[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
```

Az üres eseménycímet a formleképezés az eseménytípus feliratával tölti ki.
Ezért a tárolt és a UI által olvasott `VineEvent.title` mindig nem üres.

## Invariánsok

1. A sorszámot kizárólag a catalog modul osztja ki; a create interface nem
   fogad sorszámot.
2. A sorszám pozitív egész, és normál alkalmazásműködésben nem használható
   újra.
3. A fajta és a területleírás trimelés után nem lehet üres.
4. Nem oltott tőkénél az `rootstockVariety` üres stringként normalizálódik.
5. A telepítési idő csak a három explicit pontossági alak egyikében létezhet.
6. Egy esemény pontosan egy tőkéhez tartozik. Több tőkés rögzítés minden
   céltőke beágyazott eseménytömbjébe külön eseménypéldányt ír.
7. `ceased` esemény létrehozása ugyanabban a tőkedokumentum-frissítésben
   megszűntre állítja az érintett tőkét.
8. Esemény szerkesztése vagy törlése nem változtatja meg automatikusan a tőke
   állapotát.
9. Tőkeállapot csak az `editVine` művelettel vagy új `ceased` esemény
   létrehozásával változhat.
10. A tőke `updatedAt` értéke tőke- és eseménymódosításkor is frissül.
11. A forrásdugvány hivatkozása nem garantál referenciális integritást. Törölt
    vagy nem elérhető dugványnál a UI „A hivatkozott dugvány nem elérhető”
    állapotot mutat.

## Firestore séma

### Tőkék és beágyazott események

```text
vines/{vineId}
```

A dokumentum a teljes `Vine` modellt tartalmazza, beleértve az `events`
tömböt és az események fotómetaadatait. A bináris képfájlok továbbra is a
Storage-ban élnek; csak az elérési útjuk és megjelenítési metaadataik kerülnek
a Firestore dokumentumba.

Ez a modell szándékosan követi a dugványok jelenlegi tárolását. A várható
adatmennyiségnél és az egyetlen szerkesztő mellett előnye az egyszerűbb
lekérdezés, jogosultsági szabály és kliensimplementáció.

Elfogadott trade-offok:

- a tőkelista minden tőkével együtt annak teljes eseménytömbjét is letölti;
- esemény hozzáadása, szerkesztése és törlése a teljes `events` mező
  read–modify–write frissítése;
- nincs eseményenkénti lapozás vagy önálló Firestore-lekérdezés;
- egy későbbi, minden tőkén átívelő eseménykeresés migrációt vagy külön
  lekérdezési modellt igényelne;
- a dokumentumnak a Firestore méretkorlátja alatt kell maradnia.

Ezek az első verzióban elfogadhatók, mert egyetlen admin szerkeszt, nem lesz
két párhuzamos eseményírás, és tőkénként ritkán keletkezik esemény. Az
adattárolás a catalog interface mögött marad, így későbbi alkollekciós
migráció nem igényli a UI interface-ének átírását.

### Sorszám

A catalog modul az aktuálisan betöltött tőkék legnagyobb sorszámához ad
egyet, ugyanúgy, ahogy a jelenlegi dugványkövetés. Külön számlálódokumentum
és létrehozási tranzakció nem készül.

Ez az egyszerűsítés azon az elfogadott feltételezésen alapul, hogy egyetlen
admin, egyetlen aktív felületről hoz létre tőkéket. A tőkék a felületen nem
törölhetők, ezért a normál működés nem használ újra korábbi sorszámot.

### Időbélyegek

A Firestore dokumentumokban a `createdAt` és `updatedAt` szerveroldali
timestamp legyen. A leképező modul alakítsa őket ISO stringgé a UI domainmodell
számára. A UI és az űrlapok nem állítanak audit-időbélyeget.

## Storage séma

```text
vines/{vineId}/events/{eventId}/photos/{photoId}.{extension}
```

- A képek ugyanazt a kliensoldali előkészítést használják, mint a meglévő
  képfeltöltések, de tőkeeseménynél a hosszabbik oldal korlátja 1280 px
  (a dugványoknál marad 1000 px).
- Minden eseménypéldány saját Storage objektumokat kap. Több tőkés eseménynél
  ugyanazok a kiválasztott fájlok tőkénként külön kerülnek feltöltésre, hogy
  egy esemény későbbi törlése ne törje el más tőke fotóit.
- A Storage objektum útvonala mindig szerepel az esemény fotómetaadatában.
- Sikertelen Firestore írás után a catalog modul best-effort módon eltávolítja
  az adott műveletben már feltöltött objektumokat.
- Eseménytörléskor először a catalog modul az esemény nélküli tömbbel frissíti
  a tőke dokumentumát, majd best-effort módon törli a hozzá tartozó Storage
  objektumokat. Egy sikertelen Storage-törlés árva fájlt eredményezhet, de nem
  hagy törött publikus eseményrekordot.

## Catalog interface

### Olvasási oldal

```ts
interface VineCatalogState {
  vines: readonly Vine[];
  loadingVines: boolean;
  error: string | null;
  mutation: {
    pending: boolean;
    error: string | null;
    uploadProgress: number | null;
  };
}

function useVineCatalog(): VineCatalogState & VineCatalogCommands;
```

Mivel az események a tőkébe ágyazva érkeznek, a catalog olvasási interface-e
nem függ a kiválasztott tőke azonosítójától és nem indít második lekérdezést.

Az interface nem ad vissza Firebase snapshotot, dokumentumreferenciát,
Storage referenciát vagy React Query mutation objektumot. Ezek az
implementáció részletei.

### Parancsinputok

```ts
interface CreateVineInput {
  variety: string;
  hasFruited: boolean;
  rootType: VineRootType;
  rootstockVariety: string;
  plantingYear: number | null;
  areaDescription: string;
  status: VineStatus;
  tags: string[];
  notes: string;
  sourceCuttingId: string | null;
}

type EditVineInput = CreateVineInput;

interface AddVineEventsInput {
  targetVineIds: string[];
  event: {
    type: VineEventType;
    occurredAt: IsoDateTimeString;
    title: string;
    notes: string;
  };
  photos: File[];
}
```

Egy `addEvents` hívás legfeljebb 400 céltőkét fogad. Minden céltőke egyetlen
dokumentumfrissítést igényel, így a művelet a Firestore write batch korlátján
belül marad. A UI a limit túllépésekor még feltöltés előtt érthető hibát
mutat. Ez nem korlátozza a kertben nyilvántartható tőkék számát, csak egyetlen
tömeges esemény művelet méretét.

Az `editVine` teljes szerkesztőinputot fogad, nem `Partial<Vine>` értéket.
Így a UI nem módosíthat auditmezőt, sorszámot vagy eseménykollekciót.

Az `editEvent` csak az esemény típusát, időpontját, címét és jegyzetét
módosítja. A jelenlegi scope-ban eseményszerkesztéskor nem lehet fotót
hozzáadni vagy egyesével eltávolítani; a teljes esemény a fotóival együtt
törölhető.

## Listaállapot

A `listState` modul interface-e:

```ts
interface VineListState {
  query: string;
  status: 'active' | 'ceased' | 'all';
  rootType: VineRootType | 'all';
  tag: string;
  fruited: 'yes' | 'no' | 'all';
  sort: 'updated_desc' | 'planting_desc' | 'variety_asc';
}

function parseVineListState(search: string): VineListState;
function serializeVineListState(state: VineListState): string;
function selectVisibleVines(vines: readonly Vine[], state: VineListState): Vine[];
```

Ez egy tiszta, in-process modul. A keresés kis- és nagybetűtől függetlenül a
fajtát, sorszámot és területleírást vizsgálja. A címkeszűrés pontos egyezésű.

A telepítési idő szerinti csökkenő rendezésnél:

- a pontos dátum a saját napján rendeződik;
- a csak évvel ismert dátum az adott év első napján rendeződik;
- az ismeretlen telepítési idejű tőkék a lista végére kerülnek.

## UI felelősségek

### `VinesPage`

- útvonal és URL-listaállapot összekötése;
- kiválasztott tőke kezelése;
- `useVineCatalog` használata;
- ismert fajta-, alanyfajta- és címkejavaslatok előállítása;
- lista, adatlap és létrehozó űrlap összeállítása.

### `VineDetail`

- a kiválasztott tőke és események megjelenítése;
- szerkesztő és eseményűrlapok nyitása;
- több tőke kijelölése eseményhez;
- kizárólag catalog parancsok meghívása.

Nem épít `events: [...vine.events, event]` frissítést, nem készít Storage
útvonalat, és nem módosít státuszt közvetlenül.

### Űrlapmodulok

- A Zod sémák a feature mellett maradnak, nem a globális `lib/schemas.ts`
  fájlban.
- A form → domain normalizálás a `forms` modul feladata.
- A tőkecímkék javaslatai kizárólag a tőkékből származnak.
- A dugványopciók csak `{ id, label }` értékekként jutnak el az űrlaphoz.

## Jogosultsági szabályok

Firestore:

```text
vines/{vineId}   public read, admin create/update/delete
```

A felület nem kínál tőketörlést, de az admin jogosultsági modell nem tiltja
a rendkívüli közvetlen adatbázis-karbantartást.

Storage:

```text
vines/{vineId}/events/{eventId}/photos/{fileName}
```

Olvasás publikus, írás és törlés admin-only.

## Tesztfelület

A tesztek ugyanazokat a seam-eket használják, mint a production hívók.

### Tiszta modul tesztek

A `forms` és `listState` interface-én keresztül ellenőrizendő:

- pontos dátum, csak év és ismeretlen telepítési idő leképezése;
- trimelés és nem oltott tőke alanyfajtájának normalizálása;
- URL parse/serialize round-trip;
- keresés fajta, sorszám és terület szerint;
- minden szűrő és rendezés, különösen az ismeretlen telepítési idő helye.

### Firebase Emulator Suite integráció/E2E

- publikus lista- és adatlapolvasás;
- admin létrehozás a következő szabad sorszámmal;
- alapadatok szerkesztése a sorszám változása nélkül;
- külön tőke-címkejavaslatok;
- dugványlink megnyitása;
- esemény létrehozása egy és több tőkéhez;
- több tőkés rögzítés után az egyik esemény szerkesztése nem módosítja a
  másikat;
- eseményfotó feltöltése és publikus megjelenítése;
- esemény és fotóinak törlése;
- megszűnés állapotátmenete és a kézi visszaállítás;
- közvetlen `/tokek/{vineId}` navigáció és böngésző-vissza;
- mobil lista, részletmodal és adatbevitel;
- nem admin felhasználó számára minden módosító vezérlő rejtett;
- Firestore és Storage admin-only írásának kikényszerítése.

## Elutasított alternatívák

### Események külön Firestore alkollekcióban

Jobban skálázódna hosszú eseménytörténetre, lehetővé tenné az események
lapozását és elkerülné a tömbszintű párhuzamos írásokat. A jelenlegi
követelményeknél azonban egy második realtime lekérdezést, több dokumentumot,
összetettebb több tőkés írást és több jogosultsági szabályt hozna olyan
problémákra, amelyek várhatóan nem jelentkeznek. Az első verzióban ezért a
beágyazott tömb ad jobb leverage-et kisebb interface és implementáció mellett.

### Általános `updateVine(Partial<Vine>)`

Kis interface-nek látszik, de sekély: minden hívónak ismernie kellene a
tárolási alakot és az invariánsokat. A szándék-alapú parancsok több
viselkedést rejtenek el kevesebb szükséges tudás mögé.

### Általános repository port és mock adapter

A prototípus memóriabeli hookja eldobható kód, nem production adapter. A
Firebase Emulator Suite helyben futtatja a valódi Firebase implementációt,
ezért nincs második adapter, amely indokolná az új portot.

### Meglévő dugványmodul általánosítása

A két funkció UI-ja hasonló, de eltér a telepítési idő, a gyökérzet, az
eseményfotók és az eseménytárolás modellje. A korai általánosítás nagy közös
interface-t és feltételes viselkedést hozna létre. Csak a már bizonyítottan
közös infrastruktúra használható újra, például a kép-előkészítés, dátumformázás
és realtime query helper.

## Prototípusból productionbe

1. A prototípus állapotát külön throwaway ágon kell megőrizni, a választott
   UI-döntések és a prototípus kérdésének dokumentálásával.
2. A production kód a feature-mappában épüljön fel; ne a `useMockVines`
   fokozatos toldozásával.
3. Először a domainmodell, formleképezés és listaállapot készüljön el.
4. Ezután készüljön a beágyazott eseménytömböt kezelő Firestore/Storage
   implementáció és a catalog interface.
5. A prototípus UI-jából a jóváhagyott megjelenés kerüljön át, a catalog
   parancsaira kötve.
6. Végül kerüljenek be a szabályok, seed adatok és E2E tesztek; a mock és a
   prototípusjelölések pedig kerüljenek ki a production ágból.

## ADR

Az események beágyazása nem igényel külön ADR-t: követi a projekt meglévő
dugványmodelljét, a várható méretnél egyszerű döntés, és a catalog interface
mögött később migrálható marad.
