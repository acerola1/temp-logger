# Tőke végleges törlése minden hozzá tartozó adattal

Feature: vine-permanent-deletion
Type: feature
Status: done
Blocked by: 21, 22

## Probléma

A felület jelenleg szándékosan nem kínál végleges tőketörlést. Ez gondot okoz,
amikor az alkalmazást ideiglenes terepi jegyzetelésre használjuk: egy
szőlőskertben a tőke elnevezése, szöveges jegyzetei és fotói egy helyen jól
kezelhetők, de a munka lezárása után ezeket az adatokat végleg el kell tudni
távolítani.

A megszűnt állapot nem megoldás erre, mert csak elrejti vagy archiválja a
tőkét; a Firestore-dokumentum, az események, a jegyzetek és a Storage-ban levő
képek továbbra is megmaradnak.

## Cél

Az admin egy tőke adatlapjáról megerősített, vissza nem vonható törlést tudjon
indítani. A művelet távolítsa el a tőke teljes alkalmazásbeli tartalmát, így a
tőke alapadatait, szöveges jegyzeteit és eseményeit, valamint az összes hozzá
tartozó eredeti fotót és bélyegképet is.

## Törlési modell

- A törlés csak admin módban érhető el.
- A végleges törlés különüljön el vizuálisan a megszűnt állapottól és a normál
  szerkesztési műveletektől.
- A megerősítő párbeszédablak nevezze meg a törlendő tőkét, sorolja fel, hogy
  az adatok és képek is törlődnek, és egyértelműen jelezze, hogy a művelet nem
  vonható vissza.
- A megerősítés után új feltöltés vagy más módosítás már ne indulhasson az adott
  tőkéhez. A hozzá tartozó várakozó vagy aktív fotófeltöltési jobokat meg kell
  szakítani és ki kell takarítani.
- A tőke Firestore-dokumentuma legyen a felületi láthatóság forrása: sikeres
  dokumentumtörlés után a tőke tűnjön el a realtime katalógusból, a nyitott
  adatlap záródjon be, és a felület navigáljon vissza a tőkelistára.
- A dokumentumban hivatkozott összes fotó eredeti és bélyeg Storage-objektuma
  törlendő, beleértve a migrációból megmaradt régi eseményes útvonalakat is.
- A Storage-takarítás legyen újrapróbálható és idempotens. Részleges hiba ne
  jelenítse meg újra a már törölt tőkét, de maradjon látható, érthető hiba, ha
  valamelyik kép eltávolítása nem sikerült.
- A véglegesen törölt tőke sorszáma felszabadul és később újra kiosztható. Az
  automatikus kiosztás a meglévő tőkék által nem használt legkisebb pozitív
  egész sorszámot válassza; a törlés miatt nem kell sorszám-foglaló vagy
  sírkőrekordot megőrizni.

## Scope

- `deleteVine(vineId)` szándékalapú catalog művelet;
- a tőke adatainak és teljes fotólistájának konzisztens beolvasása a törlés
  előtt;
- a Firestore-dokumentum admin-only végleges törlése;
- minden hivatkozott eredeti kép és bélyegkép Storage-takarítása, a jelenlegi és
  a migrált útvonalakon is;
- az adott tőkéhez tartozó háttérfeltöltési jobok leállítása és erőforrásaik
  takarítása;
- veszélyes műveletként megjelenő admin UI és megerősítő párbeszédablak;
- sikeres törlés utáni adatlapzárás, listára navigálás és realtime
  állapotfrissítés;
- a sorszámkiosztás módosítása úgy, hogy a végleges törléssel keletkező
  legkisebb szabad sorszámot újra felhasználja, párhuzamos létrehozáskor se
  ossza ki kétszer;
- művelet közbeni tiltott állapot, progressz és részleges takarítási hiba
  felhasználói visszajelzése;
- unit-, emulatoros integrációs és mobil/desktop E2E tesztek.

## Elfogadási kritériumok

- [x] Nem admin felhasználó nem lát végleges törlési műveletet, és közvetlenül
      sem törölhet tőkét vagy annak Storage-objektumait.
- [x] Admin a tőke adatlapján elér egy egyértelműen veszélyesként jelölt
      `Tőke végleges törlése` műveletet.
- [x] A megerősítés megnevezi a tőkét, felsorolja az adatok, jegyzetek,
      események és fotók törlését, valamint jelzi, hogy nincs visszaállítás.
- [x] Megszakított megerősítés sem Firestore-, sem Storage-adatot nem módosít.
- [x] Megerősített törlés után a `vines/{vineId}` dokumentum az alapadatokkal,
      szövegekkel és eseményekkel együtt megszűnik.
- [x] A tőke minden hivatkozott eredeti fotója és bélyegképe törlődik a
      Storage-ból, a régi migrált útvonalakon tároltak is.
- [x] Folyamatban levő fotófeltöltés mellett indított törlés leállítja az adott
      tőke jobjait, és később sem hozza létre újra a dokumentumot vagy hagy
      hivatkozatlan új Storage-objektumot.
- [x] Egy másik tőke adata, képe vagy háttérfeltöltése nem változik.
- [x] Siker után a részletes nézet bezáródik, a tőke eltűnik a listából, és a
      felhasználó a tőkelistán marad.
- [x] A törölt tőke közvetlen URL-je többé nem nyit adatlapot.
- [x] A véglegesen törölt tőke sorszáma felszabadul; a következő tőke
      létrehozásakor ez lesz kiosztva, ha ez a legkisebb használaton kívüli
      pozitív sorszám.
- [x] Több felszabadult sorszám esetén mindig a legkisebb kerül kiosztásra, és
      párhuzamos létrehozások nem kaphatnak azonos sorszámot.
- [x] Ismételt vagy részben újrapróbált takarítás biztonságos; a már hiányzó
      dokumentum vagy Storage-objektum nem okoz hibás végeredményt.
- [x] Firestore-hiba esetén a tőke és a hozzá tartozó képek megmaradnak, a
      felület pedig érthető hibát jelez.
- [x] Firestore-törlés utáni Storage-részhiba esetén a tőke nem jelenik meg
      újra, az admin értesítést kap a befejezetlen képtakarításról, és a
      takarítás újrapróbálható.
- [x] Emulatoros integrációs teszt fedi a jogosultságot, a teljes törlést, a
      régi és új Storage-útvonalakat, az izolációt és a részleges hibákat.
- [x] Mobil és desktop E2E teszt fedi a megszakított és a megerősített
      folyamatot, valamint a törlés utáni navigációt.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a releváns Playwright E2E tesztek zöldek.

## Nem része

- több tőke egyidejű tömeges törlése;
- kuka, visszaállítás vagy időzített megőrzési idő;
- a törölt tőkéhez kapcsolt eredeti dugvány törlése;
- automatikus törlés pusztán attól, hogy egy tőke megszűnt állapotú lesz.

## Érintett terület

- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/VinePhotoUploadQueueProvider.tsx`
- `dashboard/src/features/vines/vinePhotoUploadQueue.ts`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/firestoreVines.integration.test.ts`
- releváns unit- és Playwright E2E tesztek

## Comments

- 2026-08-30: Felhasználói igény alapján létrehozva. Az elsődleges használati
  eset ideiglenes szőlőskerti jegyzetelés volt, ahol az elnevezést, a szöveges
  feljegyzéseket és a képeket együtt kellett tartani, majd később mindet végleg
  törölni.
- 2026-08-30: A sorszám-megőrzési korlátozás felhasználói pontosítás alapján
  kikerült. A végleges törlés felszabadítja a sorszámot; az automatikus kiosztó
  a meglévő tőkék közül hiányzó legkisebb pozitív számot használja újra.
- 2026-08-30: Elkészült az admin-only, megerősített végleges törlés, a
  háttérfeltöltések leállítása, az idempotens Storage-takarítás és a
  konkurenciabiztos legkisebb szabad sorszám kiosztása. Ellenőrzés: 198 unit,
  51 emulatoros integrációs és 23 Playwright E2E teszt, továbbá lint és build.
