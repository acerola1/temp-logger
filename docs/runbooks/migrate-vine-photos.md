# Runbook: tőkeeseményfotók migrálása önálló tőkefotókká

A `functions/scripts/migrate-vine-photos.js` a `vines/{vineId}.events[].photos[]`
rekordokat a tőke gyökérszintű `photos[]` tömbjébe emeli, a
`coverPhoto: { eventId, photoId }` mutatót `coverPhotoId` értékké alakítja, és a
régi mezőket eltávolítja.

Forrás: [A tőkefotók önálló modellje – Migráció](../../tasks/vine-photo-model/spec.md#migráció).

## Amit a script nem tesz

- Nem nyúl Storage-objektumhoz: nem másol, nem nevez át és nem töröl. A migrált
  fotórekordok megtartják a régi `storagePath`, `downloadUrl` és bélyeg-útvonal
  értékeiket.
- Nem módosít eseményadatot a `photos` mező eltávolításán túl.
- Nem írja át a tőke `updatedAt` értékét: az adatátalakítás nem tartalmi
  szerkesztés, és nem forgathatja fel az `updatedAt` szerinti listákat.
- Nem ír részleges dokumentumot. Egy tőke vagy teljesen migrálódik, vagy
  változatlan marad.

## Módok

| Parancs | Mit tesz | Kilépési kód |
| --- | --- | --- |
| `npm run migrate:vine-photos:dry` | Dry-run. Felsorolja a hátralévő és a hibás tőkéket, semmit nem ír. | `0`, ha nincs hibás tőke |
| `npm run migrate:vine-photos:verify` | Cutover-kapu. Semmit nem ír. | `0` csak akkor, ha minden tőke teljesen migrált |
| `npm run migrate:vine-photos -- --backup-verified=<hivatkozás>` | Tőkénként egy tranzakcióban átalakít. | `0`, ha egyetlen tőke sem hibásodott meg |

További kapcsolók: `--project=<id>`, `--page-size=<n>`, `--limit=<n>`,
`--vine=<vineId>`.

A `--verify` nem szűkíthető `--limit`-tel vagy `--vine`-nal: a cutover-kapunak a
teljes kollekciót kell látnia, különben hátralévő legacy tőkék mellett is nullát
adna. A `--vine=<vineId>` nem létező tőkére hibával, nem üres zöld futással
végződik.

Az `--apply` **csak** `--backup-verified=<hivatkozás>` mellett indul el. A
hivatkozás a Firestore-export vagy az ellenőrzött JSON-mentés azonosítója; a
script kiírja a futás fejlécébe, hogy a naplóból látszódjon, melyik mentésre lehet
visszaállni.

Elgépelt kapcsolóra a script hibával megáll, nem esik vissza csendben dry-runra:
egy elírt `--verify` különben nulla kóddal zöld cutover-kapunak látszana.

A futás fejléce mindig kiírja a célpontot:

```text
Project: esp32-...
Target: LIVE Firestore
Mode: apply
```

Emulátor ellen futtatva a `Target` sor a `FIRESTORE_EMULATOR_HOST` értékét
mutatja. **Az `apply` előtt ezt a két sort el kell olvasni.**

## Cutover-sorrend

1. **Mentés.** Készíts Firestore-exportot vagy ellenőrzött JSON-mentést a
   `vines` kollekcióról, és győződj meg róla, hogy visszaolvasható. Jegyezd fel a
   hivatkozását.
2. **Admin írás szüneteltetése.** A migráció alatt admin írás nem történhet:
   párhuzamos fotóművelet a tranzakciót elbuktatná, és a `--verify` sem adna
   megbízható képet. Egyszemélyes rendszernél ez annyi, hogy a dashboard admin
   felületét senki nem használja, amíg a 8. pont le nem futott.
3. **Dry-run.** `npm run migrate:vine-photos:dry`. Nézd át a `Findings` listát.
   Hibás (`[invalid]`) tőkét kézzel kell rendbe tenni, mert a script kihagyja.
   A dry-run csak olvas, tehát a 2. pont előtt is bátran futtatható felméréshez.
4. **Próba az éles adaton.** Állítsd vissza az 1. pont mentését egy emulátoros
   projektbe, futtasd ott az `--apply`-t és a `--verify`-t, majd a mentésből
   állítsd vissza újra. Ez az egyetlen próba, ami a tényleges éles
   dokumentumalakokon fut, és egyben bizonyítja, hogy a mentés valóban visszaút.
5. **Migráció.**
   `npm run migrate:vine-photos -- --backup-verified=<hivatkozás>`.
6. **`--verify` nulla hibával.** `npm run migrate:vine-photos:verify`. A
   dashboard **csak nulla hibás `--verify` eredmény után deployolható.** Nem nulla
   kilépési kód esetén vissza a 3. pontra.
7. **Új dashboard deploy.** A Storage-szabályokkal együtt:
   `firebase deploy --only hosting,storage`. Az új
   `vines/{vineId}/photos/{fileName}` szabály nélkül a cutover utáni első
   fotófeltöltés `storage/unauthorized` hibára fut.
8. **Publikus és admin gyorsellenőrzés.** Nyisd meg egy fotós tőke adatlapját
   publikusan és adminként: a `Fotók` szakasz galériája, a lightbox és a
   borítókép a migrált fotókat mutatja, az eseménykártyákon pedig nincs fotósor.
   Adminként nyisd meg egy migrált fotót a képnézőben — a régi Storage-útvonalon
   álló objektumnak is le kell jönnie.
9. **Admin írás visszaengedése.**

Az 5. és a 7. pont közé nem szabad időt engedni: a migráció után a régi dashboard
már nem találja a tőkefotókat, mert még az `events[].photos[]` mezőt olvassa.
Ezért az `--apply` akkor futtatható, amikor a cutover-dashboard deployra készen
áll — nem korábban.

A cutover után a dashboard az új `vines/{vineId}/photos/{photoId}.{ext}`
útvonalra tölt fel. A migrált rekordok megtartják a régi, eseményes útvonalukat,
ezért az arra vonatkozó Storage-szabály nem törölhető: nélküle a régi képek nem
olvashatók és nem is törölhetők.

Megszakadt futás után a már migrált tőkék érvényesek maradnak; a script
idempotens, ezért ugyanezzel a paranccsal folytatható, és a kész tőkéket
`already-migrated` néven kihagyja.

## Összesítő kimenet

```text
Summary
- scanned: 12                     vizsgált tőke
- already-migrated: 3             változatlanul hagyott, kész tőke
- needs-migration: 8              dry-run/verify: átalakítandó tőke
- pending-before-run: 8           apply: a futás előtt átalakítandó tőke
- migrated: 8                     apply: átalakított tőke
- skipped-invalid: 1              hibás rekord, kihagyva, nem íródott
- failed: 0                       futás közben megváltozott vagy elhasalt tőke
- photos-migrated: 11             eseményből gyökérbe emelt fotó
- photo-id-collisions: 1          új azonosítót kapott fotó
- broken-cover-references: 2      nullázott borítóhivatkozás
- partially-migrated: 1           gyökér- és eseményfotót egyszerre tartalmazó tőke
```

## Hibakezelés

A script hiba esetén nem folytat csendben: a `Findings` szakaszban tőkénként
kiírja az azonosítót és az okot, majd nem nulla kóddal lép ki.

- `[invalid]` – a dokumentum alakja miatt nem számolható biztonságos eredmény
  (például fotórekord `storagePath` nélkül). Ilyen tőkére a script sosem ír.
- `[failed]` – a tranzakciós olvasás mást talált, mint a pásztázás: a
  dokumentumba a futás közben írt valaki. Állítsd le az admin írást, és futtasd
  újra.

A `Findings` lista legfeljebb 50 tőkét sorol fel, és kiírja, hány tőke maradt le.

## Teszt

```bash
cd dashboard && npm run test:integration
```

A `src/features/vines/vinePhotoMigration.integration.test.ts` a scriptet valódi
alfolyamatként futtatja a Firestore-emulátor ellen, saját
projektazonosítón. Fedi a több eseményes, az EXIF és bélyeg nélküli, a bélyeges,
a hiányzó és hibás borítós, az azonosító-ütközéses, a fotó nélküli, a már
migrált, a részlegesen migrált és a hibás rekordos tőkét, valamint a dry-run
írásmentességét, az ismételt futás nulla módosítását és a megszakadt futás
folytatását.

A `src/features/vines/firestoreVines.integration.test.ts` a másik oldalt fedi: a
migráció eredményének alakján — gyökérszintű `photos[]`, `coverPhotoId`, régi
eseményes Storage-útvonalak — az alkalmazás olvasását, a fotó CRUD-ot, a
borítóinvariánsokat és az esemény–fotó függetlenséget.
