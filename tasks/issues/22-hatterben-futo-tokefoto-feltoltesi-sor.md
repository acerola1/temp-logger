# Háttérben futó tőkefotó-feltöltési sor

Feature: vine-photo-upload-queue
Type: enhancement
Status: done
Blocked by: 21

## Probléma

A tőke adatlapján két fotó elkészítése között meg kell várni az előző kép teljes
feltöltését. A galéria a közös `busy` állapot alapján letiltja a fotóválasztót
([PhotoGallery.tsx:228-233](../../dashboard/src/features/photos/ui/PhotoGallery.tsx#L228-L233)),
miközben a `useVineCatalog` minden tőkeműveletet ugyanazon az egyetlen globális
`mutation.pending` állapoton vezet át
([useVineCatalog.ts:116-138](../../dashboard/src/features/vines/useVineCatalog.ts#L116-L138)).

Ez a `pending` állapot a teljes feltöltési lánc végéig él:

1. Firestore-kapacitásellenőrzés;
2. eredeti kép dekódolása, EXIF-olvasás, átméretezés és bélyegkép készítése;
3. nagy kép feltöltése és letöltési URL-jének lekérése;
4. bélyegkép feltöltése és letöltési URL-jének lekérése;
5. fotómetaadat tranzakciós hozzáadása a tőkéhez.

A Storage-feltöltő ezen belül a képeket sorosan, képenként pedig a nagy képet és
a bélyeget is egymás után tölti fel
([photoUpload.ts:74-159](../../dashboard/src/features/photos/photoUpload.ts#L74-L159)).
A hálózat sebességétől függetlenül hibás felhasználói élmény, hogy ezalatt új
fotó sem készíthető, és más, a feltöltéstől független tőkeművelet is letiltódik.

## Cél

A fotó kiválasztása után a kamera azonnal legyen újra használható. A kép
előkészítése, feltöltése és Firestore-mentése egy alkalmazásszintű háttérsorban
fusson, miközben a felhasználó újabb fotót készíthet, másik tőkére navigálhat és
minden, a folyamatban levő fotóval nem ütköző műveletet használhat.

A felhasználó sorba állításkor azonnal lássa a kép helyét és valós állapotát,
az előkészítés után pedig a helyi bélyegképét. Egy kép hibája ne állítsa meg és
ne tüntesse el a többi képet.

## Célmodell

A feltöltési sor egy mély modul legyen: a hívóknak ne kelljen ismerniük a
kép-előkészítés, Storage, Firestore, progress-összesítés, takarítás vagy
újrapróbálás sorrendjét. A külső interface szándékalapú maradjon, például:

```ts
interface VinePhotoUploadQueue {
  enqueue(vineId: string, files: readonly File[]): readonly string[];
  retry(jobId: string): void;
  cancel(jobId: string): void;
  jobs: readonly VinePhotoUploadJob[];
}
```

A pontos React-alak (`Provider`, hook vagy external store) megvalósítási
részlet. A seam az alkalmazásszintű sor interface-e legyen, ne a Firebase
lépéseinek kiszivárogtatása a galériába.

Egy job egyetlen fotót képvisel, stabil, már sorba állításkor létrejövő
`jobId` és `photoId` azonosítóval. A `photoId` változatlanul megy végig a
Storage-útvonalon, a Firestore-rekordon, az újrapróbáláson és a realtime
egyeztetésen. Minimális állapotai:

- `queued` — sorban vár;
- `preparing` — EXIF-olvasás, dekódolás és átméretezés;
- `uploading` — Storage-feltöltés, monoton progress értékkel;
- `committing` — Firestore-metaadat mentése;
- `awaiting-sync` — a commit kész, a realtime catalog visszaigazolására vár;
- `failed` — megtartott helyi előnézet és újrapróbálható hiba.

A sor jobjai nem `Photo` rekordok. A felület külön, opcionális
`PendingVinePhoto` view-típust kap; így a függő kép nem kerülhet bele a
fotórendezésbe, a borítófeloldásba, a lightboxba vagy a `Kép n/N` számlálóba.
A sikeresen mentett job akkor tűnik el a sorból, amikor a realtime
tőkefeliratkozásban megjelent ugyanaz a stabil `photoId`.

## Triage döntések

- **A kiválasztás és a feltöltés külön művelet.** A fájlok ellenőrzése és sorba
  állítása után a `Fotózás` gomb rögtön újra aktív; a UI nem `await`-eli a
  teljes Storage- és Firestore-láncot.
- **Külön `Feltöltés alatt` sáv jelenik meg a galéria fölött.** A függő jobok
  nem olvadnak a rendezett fotórácsba. Sorba állításkor azonnal placeholder és
  állapot látszik; a `preparing` után a már elkészült 120 px-es bélyeg blobja
  lesz a helyi előnézet. A teljes felbontású telefonfotót nem adjuk közvetlenül
  rács-`img` forrásnak. A kép commit után a sávból a normál galériába kerül;
  nem követelmény, hogy vizuálisan ugyanabban a rácscellában maradjon.
- **A helyi előnézet erőforrása a jobhoz tartozik.** A bélyeg object URL-jét
  sikeres realtime-egyeztetés, megszakítás és eltávolítás után vissza kell
  vonni. Ha a forrás már eleve legfeljebb 120 px, a prepared fő blob használható.
- **A sor az oldal- és tőkeadatlap-komponensek fölött él.** Tőkeváltás vagy az
  adatlap bezárása nem szakítja meg és nem felejti el a feltöltést. A job mindig
  hordozza a cél `vineId`-t, ezért másik adatlap megnyitása nem irányíthatja át
  a fotót.
- **A fotófeltöltés állapota leválik a globális mutation állapotról.** Egy
  háttérfeltöltés nem tilthatja le a tőkeszerkesztést, eseménykezelést,
  képaláírás-módosítást, borítóváltást vagy újabb fotózást. Egy adott függőben
  levő fotó saját műveletei ettől még állapotfüggően korlátozhatók. Csak az
  `addVinePhotos` kerül ki a globális `runMutation` útból; a törlés,
  képaláírás-szerkesztés és borítóváltás megtartja a jelenlegi saját pending- és
  hibaútját, de azokat egy háttérfeltöltés nem teszi busy állapotúvá.
- **A konkurencia lépésenként korlátozott.** A főszálas kép-előkészítésből
  egyszerre legfeljebb egy, Storage-feltöltésből globálisan legfeljebb kettő,
  Firestore-commitból pedig cél-tőkénként legfeljebb egy futhat. Így két nagy
  dekódolás nem versenyez a mobil főszálán, de a hálózat kihasználható, és
  ugyanazon tőkedokumentum tranzakciói nem kapnak szükségtelen kontenciót.
- **A 100-as kapacitás a függőben levő jobokra is, azonosító-alapon
  vonatkozik.** Az elfogadható új fájlok számát a már mentett fotók és az adott
  tőkéhez tartozó nem megszakított jobok `photoId` szerinti uniója határozza
  meg. Így a commit és realtime-visszaigazolás közötti résben ugyanaz a fotó nem
  számít kétszer. A tranzakciós korlát megmarad az egyidejű kliensek miatt.
- **A Firestore-commit idempotens.** Ha a stabil `photoId` már szerepel a tőke
  `photos[]` tömbjében, ugyanannak a jobnak az újrapróbált commitja no-op siker,
  nem újabb rekord. A queue egyetlen fotót commitoló műveletet használ; a
  jobonkénti előzetes `getDoc` kapacitásellenőrzés elhagyható, mert a lokális
  foglalás és a végső tranzakció együtt fedi a korlátot.
- **Hibák fotónként kezelendők.** Egy job hibája nem állítja le a többi jobot.
  A hibás kép előnézete és hibaüzenete megmarad, és külön `Újrapróbálás` vagy
  `Eltávolítás` műveletet kap.
- **A megszakítás valódi megszakítás.** `queued` és `preparing` job leállítható,
  aktív Storage-feltöltésnél pedig a Firebase `UploadTask.cancel()` hívódik.
  `committing` állapotban a megszakítás nem ajánlható fel, mert a tranzakció már
  nem vonható biztonságosan vissza.
- **A Storage-kompenzáció megmarad, de bizonytalan commitot nem ronthat el.** A
  részlegesen feltöltött objektumok hibánál vagy megszakításnál best-effort
  törlődnek. Commit-hibánál előbb a stabil `photoId` alapján egyeztetni kell:
  ha a rekord mégis megjelent, a job sikeres; ha igazolhatóan nincs jelen, az
  objektumok takaríthatók. Így elveszett commit-válasz nem hagy törött
  Firestore-rekordot, és retry sem hoz létre duplikátumot.
- **A realtime catalog igazolja vissza a jobot.** A React-adapter a betöltött
  tőkesnapshotok `photoId` értékeivel egyezteti az `awaiting-sync` jobokat. Nem
  kell emiatt áthelyezni a meglévő Firestore-feliratkozást; a queue magja csak a
  neki átadott visszaigazolást ismeri.
- **Az alkalmazás mutat összesített háttérállapotot.** A tőkeadatlap bezárása
  vagy másik tőke megnyitása után is látható legyen például a fejlécben, hogy
  hány fotó vár vagy töltődik. Kötelező `beforeunload` figyelmeztetés nincs.
- **A natív kamera megnyitása alatt a hálózati haladás nem garantált.** A mobil
  operációs rendszer felfüggesztheti a böngészőlapot. A vállalt eredmény az,
  hogy a kamera újranyitható, és visszatéréskor a sor automatikusan folytatódik.
- **A sor ebben az issue-ban memóriabeli.** Oldalfrissítés, böngészőbezárás,
  offline IndexedDB-tárolás, service worker és operációs rendszer szintű
  háttérfeltöltés nem része ennek a változatnak. Ezek külön, tartós offline sor
  issue-ban követhetik.

## Feladatbontási döntés

Ez egyetlen issue marad. A queue interface, a stabil azonosító és idempotens
commit, a külön pending UI, valamint az alkalmazásszintű bekötés együtt ad
használható vertikális eredményt; külön ticketekben valamelyik köztes állapot
vagy tovább blokkolná a kamerát, vagy láthatatlan háttérmunkát hagyna maga után.

A megvalósítás belső lépésekre bontható (queue-mag és adapterek; pending UI;
alkalmazásszintű bekötés és E2E), de ezek ugyanannak az issue-nak a részei. A
tartós/offline sor és a Worker/`OffscreenCanvas` alapú kép-előkészítés valódi,
önálló későbbi issue-k lehetnek, mert a mostani eredmény nélkülük is teljes.

## Scope

- alkalmazásszintű tőkefotó-feltöltési sor és a hozzá tartozó React interface;
- stabil job- és fotóazonosító létrehozása már sorba állításkor;
- a közös feltöltő olyan egyfotós belépési pontja, amely a queue által generált
  `photoId`-t kapja; a meglévő dugvány- és munkamenetút visszafelé kompatibilis;
- egy fájlra bontott feldolgozás és lépésenkénti konkurenciakorlát: prepare 1,
  upload 2, commit cél-tőkénként 1;
- jobonkénti állapot, progress, hiba, retry és valódi cancel;
- azonnali pending placeholder, majd a prepared bélyeg blob helyi előnézete;
- a meglévő tőkefotó-előkészítés, Storage-útvonal, bélyegkép és Firestore-rekord
  újrafelhasználása a sor implementációjában;
- egyfotós, stabil azonosítójú és idempotens `commitVinePhoto` művelet a
  tranzakciós kapacitáskorláttal;
- a catalog fotófeltöltésének leválasztása az egyetlen globális
  `VineCatalogMutationState` állapotról;
- a `PhotoGallery` opcionális `pendingPhotos` interface-e és külön
  `Feltöltés alatt` sávja, a normál `Photo[]` logikától elkülönítve;
- a galéria kamera- és galériagombja csak valódi lokális okból legyen tiltott,
  ne egy háttérben futó feltöltés miatt;
- a tőkénkénti kapacitásszámítás `photoId` szerint foglalja le a sorban levő
  jobok helyét és szűrje ki a már visszaigazolt rekordokat;
- navigáció közbeni működés és több különböző cél-tőkéhez tartozó job kezelése;
- catalog-snapshot alapú realtime-egyeztetés és alkalmazásszintű összesített
  feltöltésjelzés;
- Firebase UploadTask-megszakítás, object URL és részlegesen feltöltött
  Storage-objektumok takarítása;
- egység-, integrációs és mobil E2E regressziós tesztek.

## Elfogadási kritériumok

- [x] Egy fotó elkészítése/kiválasztása után azonnal megjelenik a placeholder és
      az állapot a külön `Feltöltés alatt` sávban, majd előkészítés után a helyi
      bélyegkép; a `Fotózás` gomb közben újra használható.
- [x] Lassított hálózaton legalább három fotó egymás után elkészíthető úgy,
      hogy egyiknél sem kell megvárni az előző Storage- vagy Firestore-lépését.
- [x] A várakozó és aktív képek külön-külön mutatják a `queued`, `preparing`,
      `uploading`, `committing` vagy `awaiting-sync` állapotot; feltöltésnél a
      progress monoton nő.
- [x] A pending elemek külön view-típust használnak: nem jelennek meg a
      lightboxban, nem módosítják a `Kép n/N` értéket, a rendezést vagy az
      automatikus/kijelölt borítót.
- [x] A teljes felbontású forrásfájl nem kerül közvetlenül rács-előnézeti
      `img`-be; a helyi kép a prepared 120 px-es bélyeg blobja vagy eleve kicsi
      forrásnál a prepared fő blob.
- [x] Commit után a pending elem eltűnik, amikor ugyanaz a stabil `photoId`
      megjelent a realtime catalogban; a normál galériában a kép pontosan
      egyszer látszik, átmeneti duplikáció nélkül.
- [x] Egyszerre legfeljebb egy kép készül elő, legfeljebb két Storage-feltöltés
      fut, és egy cél-tőkéhez legfeljebb egy commit aktív; további munkák
      megfelelő lépésük előtt várnak.
- [x] Folyamatban levő feltöltés alatt másik tőke megnyitható és szerkeszthető,
      esemény hozzáadható, valamint újabb fotó készíthető.
- [x] Másik tőkére navigálás nem szakítja meg a háttérfeltöltést, és a fotó
      minden esetben az eredetileg kiválasztott tőkéhez kerül.
- [x] Több tőkéhez párhuzamosan sorba állított fotók állapotai és céljai nem
      keverednek.
- [x] Egy job hálózati vagy Firestore-hibája nem állítja meg a többi jobot; a
      hibás kép külön újrapróbálható vagy eltávolítható.
- [x] Újrapróbálás nem hoz létre duplikált Firestore-rekordot vagy árva
      Storage-objektumot, és megtartja a job stabil fotóazonosítóját.
- [x] Ugyanazzal a `photoId`-val megismételt commit no-op siker, ha a rekord már
      létezik; elveszett commit-válasz után az egyeztetés nem törli a már
      hivatkozott Storage-objektumokat.
- [x] Aktív feltöltés megszakítása meghívja a Firebase UploadTask cancel
      műveletét; a helyi object URL felszabadul és a már létrejött, de nem
      hivatkozott Storage-objektumok best-effort törlődnek. Commit közben nincs
      megszakítási művelet.
- [x] A már mentett és függőben levő fotók `photoId` szerinti uniója nem lépheti
      túl a tőkénkénti 100-as korlátot; a commit–realtime résben ugyanaz a fotó
      nem számít kétszer, több kliens versenyét pedig a tranzakció fogja meg.
- [x] A fotófeltöltés progress- és hibaállapota nem írja felül egy másik
      tőkeművelet progress-, pending- vagy hibaállapotát.
- [x] Háttérfeltöltés közben a meglévő fotó törlése, képaláírása és borítója a
      saját mutation állapotával használható; ezek egyike sem írja felül a
      queue jobjainak állapotát.
- [x] Másik tőke vagy másik fő nézet megnyitása után az alkalmazás összesített
      jelzésben továbbra is mutatja a várakozó és aktív fotók számát.
- [x] Mobilon a kamera újbóli megnyitása nem vár a futó jobra; ha az operációs
      rendszer közben felfüggeszti a lapot, visszatéréskor a sor folytatódik.
- [x] A meglévő fotósorrend, borítófeloldás, képaláírás, törlés, lightbox,
      bélyegkép és publikus nézet viselkedése változatlan marad.
- [x] Egységteszt fedi a sor FIFO/konkurencia viselkedését, az állapotátmeneteket,
      a tőkénkénti kapacitásfoglalást, a retry/cancel utat és az erőforrás-
      takarítást.
- [x] Emulatoros integrációs teszt fedi a stabil azonosítójú, egyenként commitolt
      fotókat, a párhuzamos tőkeműveletet és a hibaági Storage-kompenzációt.
- [x] Mobil Playwright E2E lassított feltöltéssel bizonyítja, hogy az első kép
      még folyamatban van, amikor a második és harmadik kiválasztása már
      megtörténik; a végén mindhárom pontosan egyszer jelenik meg a galériában.
- [x] Az admin mobil és desktop állapotot a tényleges függőben levő jobokkal
      reprodukálva, DOM-mal és képernyőképpel ellenőriztük.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a releváns Playwright E2E zöld.

## Nem része

- Oldalfrissítés vagy böngészőbezárás után folytatható, IndexedDB-alapú sor.
- Offline fotózás és későbbi automatikus szinkronizáció.
- Service worker vagy operációs rendszer szintű garantált háttérfeltöltés.
- Kötelező `beforeunload` figyelmeztetés aktív joboknál.
- `useSyncExternalStore` vagy más konkrét React-store technológia előírása;
  a választott megoldásnak csak a szükséges fogyasztókat szabad frissítenie.
- Globális Firebase retry-idő megváltoztatása; elakadt hálózatnál a job maradjon
  érthetően aktív és megszakítható.
- Worker/`OffscreenCanvas` alapú kép-előkészítés.
- A dugvány- és munkamenetfotók átállítása az új sorra.
- Képformátum, JPEG-minőség, 1280 px-es méretkorlát vagy 120 px-es bélyegméret
  módosítása.
- Firestore- vagy Storage-adatmigráció.

## Érintett terület

- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/vinePhotos.ts`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VinePhotoSection.tsx`
- `dashboard/src/features/photos/photoUpload.ts`
- `dashboard/src/features/photos/ui/PhotoGallery.tsx`
- `dashboard/src/App.tsx`
- az új upload queue modul, Provider/hook és tesztjei
- kapcsolódó unit-, integration- és mobil E2E-tesztek

## Comments

- 2026-08-08: A terepi használat során a két tőkefotó közötti kötelező várakozás
  lett a fő probléma. A kiválasztott irány az alkalmazásszintű, képenkénti
  háttérsor azonnali helyi előnézettel; a tartós/offline sor tudatosan külön
  későbbi fejlesztés marad.
- 2026-08-08: Tervreview után a pending fotók külön `Feltöltés alatt` sávot és
  külön view-típust kaptak; nem kerülnek a `Photo[]` rendezési, borító- és
  lightbox-logikájába. Pontosítva lett a kívülről adott stabil `photoId`, az
  idempotens commit, a valódi UploadTask-megszakítás, az azonosító-alapú
  kapacitás, a realtime-egyeztetés és a lépésenkénti konkurencia. A feladat egy
  vertikális issue marad; a tartós offline sor és a Worker-alapú előkészítés
  külön későbbi fejlesztés.
- 2026-08-08: Implementálva az alkalmazásszintű, memóriabeli háttérsor stabil
  `jobId`/`photoId` azonosítóval, lépésenkénti konkurenciakorláttal, monoton
  feltöltési progresszel, megszakítható kép-előkészítéssel és Storage-uploadtal,
  idempotens Firestore-committal, realtime-egyeztetéssel és külön pending UI-val.
  A review után külön teszt fedi a teljes állapotsorrendet, a több-tőkés
  commit-konkurenciát és az új queue-út emulatoros Storage-kompenzációját.
  Ellenőrizve: `npm test` (196 teszt), `npm run test:integration` (48 teszt),
  `npm run lint`, `npm run build` és a mobil queue Playwright E2E.
