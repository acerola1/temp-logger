# Tőkeeseményfotók migrálása önálló tőkefotókká

Feature: vine-photo-model
Type: migration
Status: done
Blocked by: –

Forrás: [A tőkefotók önálló modellje – Migráció](../vine-photo-model/spec.md#migráció).

## Cél

Készüljön biztonságos, idempotens és alapértelmezésben csak olvasó migrációs
script, amely a jelenlegi `events[].photos[]` rekordokat a tőke gyökérszintű
`photos[]` tömbjébe emeli, a borítókép-hivatkozást átalakítja, és az eseményekből
eltávolítja a fotómezőt.

Az issue nem futtat migrációt éles adaton. Az eszközt, az automatikus teszteket
és a végrehajtási leírást készíti el.

## Kiindulás

A jelenlegi tőkedokumentum eseményenként tárol fotómetaadatokat, a kézzel
kijelölt borító pedig `{ eventId, photoId }` párral mutat egy ilyen rekordra. Az
új modellben ugyanazok a fotók a tőke `photos[]` tömbjében élnek, a borító pedig
egyetlen `coverPhotoId` érték.

A bináris Storage-objektumokat nem kell és nem szabad áthelyezni. A fotórekord
saját `storagePath`, `downloadUrl` és `thumbnail` mezője továbbra is a régi
objektumokra mutathat.

## Scope

- külön migrációs script a meglévő `functions/scripts/` mintájára;
- alapértelmezett dry-run; írás csak explicit `--apply` kapcsolóval;
- külön `--verify` mód, amely írás nélkül hibának jelzi a legacy eseményfotót,
  a régi `coverPhoto` mezőt és a részlegesen migrált dokumentumot;
- projekt/emulátor célpontjának egyértelmű kiírása a futás elején;
- tőkénkénti transzformáció:
  - `events[].photos[]` összegyűjtése;
  - minden fotómetaadat változatlan megőrzése;
  - átemelés a gyökérszintű `photos[]` tömbbe;
  - az események `photos` mezőjének eltávolítása;
  - érvényes `{ eventId, photoId }` borító átalakítása `coverPhotoId` értékké;
  - hiányzó vagy hibás borító nullázása;
  - a régi gyökérszintű `coverPhoto` mező törlése `FieldValue.delete()` vagy
    azzal egyenértékű mezőtörléssel;
  - fotóazonosító-ütközés determinisztikus feloldása és a borító ugyanazon
    leképezés szerinti javítása;
- a teljes tőkeátalakítás egyetlen tranzakcióban vagy más atomi Firestore
  írásban;
- újrafuttatáskor a már migrált tőke változatlan marad;
- összesítő kimenet: vizsgált, módosítandó/módosított és kihagyott tőkék,
  migrált fotók, azonosító-ütközések, hibás borítók;
- dokumentált cutover-sorrend és az admin írás szüneteltetésének követelménye;
- kötelező Firestore-export vagy ellenőrzött JSON-mentés az `--apply` előtt;
- emulátoros automatizált teszt többféle régi dokumentumalakra, lehetőleg a
  dashboard meglévő `npm run test:integration` harnessében, új functions
  tesztfutó bevezetése nélkül.

## Migrációs esetek

A tesztfixture legalább ezeket fedje:

1. több esemény több fotóval és érvényes kézi borítóval;
2. EXIF nélküli, bélyeg nélküli régi fotó;
3. bélyegképpel rendelkező fotó;
4. hiányzó és hibás `coverPhoto`;
5. két eseményben ütköző fotóazonosító;
6. fotó nélküli tőke;
7. már migrált tőke;
8. részben hibás rekord, amelynél az eszköz nem ír csonka eredményt.

## Elfogadási kritériumok

- [x] Kapcsoló nélkül a script dry-runban fut és egyetlen dokumentumot sem ír.
- [x] A `--verify` mód egyetlen dokumentumot sem ír, összesítve felsorolja a
      legacy vagy inkonzisztens tőkéket, és nem nulla kóddal lép ki, ha a
      dashboard cutover még nem biztonságos.
- [x] Az `--apply` mód csak a dry-runban is jelzett tőkéket alakítja át.
- [x] A migrált `photos[]` minden érvényes régi fotó metaadatát megőrzi,
      beleértve a régi Storage- és bélyegkép-útvonalakat.
- [x] A script egyetlen Storage-objektumot sem másol, nevez át vagy töröl.
- [x] Az eseményekből eltűnik a `photos` mező, más eseményadat nem változik.
- [x] Az érvényes kézi borító ugyanarra a fotóra mutató `coverPhotoId` lesz.
- [x] Hibás vagy hiányzó borítóhivatkozásból `coverPhotoId: null` lesz.
- [x] A migrált dokumentumból a régi `coverPhoto` mező teljesen eltűnik.
- [x] Azonosító-ütközésnél minden fotó megmarad, az új azonosítók és a borító
      konzisztensek.
- [x] Egy tőke vagy teljesen migrálódik, vagy változatlan marad; részleges
      dokumentum nem jöhet létre.
- [x] Ugyanazon adaton másodszor futtatva nulla további módosítást jelez.
- [x] Megszakított futás után a már migrált tőkék érvényesek maradnak, és a
      következő futás a hátralévő tőkéktől biztonságosan folytatódik.
- [x] Hiba esetén a script nem folytat csendben: nem nulla kilépési kódot és
      azonosítható tőkét ír ki.
- [x] Emulatoros teszt fedi a felsorolt migrációs eseteket és a dry-run
      írásmentességét.
- [x] A futtatási dokumentáció külön megadja a mentés, admin write-stop,
      dry-run, `--apply`, `--verify`, dashboard deploy, publikus/admin
      gyorsellenőrzés és write-stop feloldás sorrendjét.
- [x] A dokumentáció kimondja, hogy a dashboard csak nulla hibás `--verify`
      eredmény után deployolható.
- [x] `node --check` a migrációs scripten, valamint a választott meglévő
      emulátoros tesztparancs zöld.

## Érintett terület

- `functions/scripts/`
- a migrációs script automatizált tesztje vagy emulatoros tesztharnesse
- futtatási dokumentáció

## Nem része

- A migráció futtatása éles Firebase-projekten.
- Storage-fájlok vagy letöltési URL-ek áthelyezése.
- Tartós kettős olvasási vagy kettős írási kompatibilitási réteg.
- A dashboard modelljének és felületének átállítása.

## Comments

- Az adatbiztonság miatt a dry-run az alapértelmezett, nem opcionális kényelmi
  mód. Az `--apply` szándékos, látható eltérés legyen.
- 2026-08-05: Implementálva. A script a `functions/scripts/migrate-vine-photos.js`,
  a futtatási leírás a `docs/runbooks/migrate-vine-photos.md`. A tőkénkénti terv
  tiszta függvény, amelyet az `--apply` a tranzakciós olvasásból újraszámol: a
  dry-run és a tényleges írás nem tud eltérni. Az `--apply` csak
  `--backup-verified=<hivatkozás>` mellett indul, ismeretlen kapcsolóra a script
  hibázik (elgépelt `--verify` különben zöld cutover-kapunak látszana), és a
  `--verify` nem szűkíthető `--limit`-tel vagy `--vine`-nal. Ellenőrizve:
  `node --check`, `npm run test:integration` (47 teszt, ebből 17 migrációs),
  `npm test` (191 teszt), `npm run lint`, `npm run build`. Az éles futtatás nem
  része az issue-nak.
- 2026-08-05: Éles előkészítés megtörtént, írás nélkül. A `g-temp-log` projekt
  dry-runja 6 tőkét és 15 eseményfotót jelez, ütközés, hibás rekord és törött
  borító nélkül. Készült ellenőrzött JSON-mentés
  (`~/firestore-backups/g-temp-log-vines-2026-08-05.json`, 6 tőke, 15 fotó,
  12 megőrzött Timestamp) és hozzá visszaállító script
  (`~/firestore-backups/restore-vines.js`). Emulátoron végigment a teljes kör: a
  mentés bitre azonosan visszaáll, a migráció az éles dokumentumalakokon zöld,
  és utána a mentés még mindig visszaállítja az eredeti állapotot.
  Az éles `--apply` ekkor szándékosan **nem** futott le: a 21-es cutover előtt a
  régi dashboard nem találná a tőkefotókat. A migráció a 21-es deployjával együtt
  futott le, lásd a következő bejegyzést.
- 2026-08-05: Éles futás megtörtént a `g-temp-log` projekten, a 21-es cutover
  deployjával egy ablakban. `--apply --backup-verified=~/firestore-backups/g-temp-log-vines-2026-08-05.json`:
  6 vizsgált tőke, 6 migrált, 15 fotó, 0 ütközés, 0 hibás rekord, 0 törött borító,
  0 hiba. Az utána futó `--verify` nulla hibával, `already-migrated: 6` eredménnyel
  zárt. Storage-objektum nem mozdult.
  A futás közben derült ki, hogy az npm scriptek nem adták meg a `--project`-et, a
  gép gcloud-alapértelmezése pedig egy másik projekt: a scriptek most a célpontot
  magukban hordozzák, és a script megáll, ha a projektazonosító ismeretlen.
