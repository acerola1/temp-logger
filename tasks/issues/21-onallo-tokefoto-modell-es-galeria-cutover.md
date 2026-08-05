# Önálló tőkefotó-modell és galéria cutover

Feature: vine-photo-model
Type: feature
Status: ready-for-agent
Blocked by: 19, 20

Forrás: [A tőkefotók önálló modellje](../vine-photo-model/spec.md).

## Cél

A tőkeoldal egyetlen, atomi változtatásban álljon át az eseményekbe ágyazott
fotókról a gyökérszintű `Vine.photos[]` modellre. A fotófeltöltés legyen külön
tőkeművelet, minden tőkefotó egy közös galériában és lightboxban jelenjen meg,
az eseményűrlapból és eseménykártyákból pedig tűnjön el minden fotókezelés.

Ez az issue a `19` közös galériájára és a `20` elkészült migrációs eszközére
épül. Nem hagy maga után tartós régi/új modell-kompatibilitást.

## Célmodell

```ts
interface Vine {
  // a tőke többi mezője
  photos: Photo[];
  events: VineEvent[];
  coverPhotoId: string | null;
}

interface VineEvent {
  // nincs photos mező
}
```

A fotó nem tartalmaz `eventId`-t. Az esemény és a fotó műveletei és
életciklusai egymástól függetlenek.

## Scope: domain és catalog

- `Vine.photos: Photo[]` és `Vine.coverPhotoId: string | null` bevezetése;
- `VineEvent.photos` és a `VineEventPhoto` eseményspecifikus elnevezés
  eltávolítása;
- a Firestore-leképezés a tőke gyökérszintű fotólistáját olvassa és írja;
- szándékalapú catalog parancsok:
  - több tőkefotó hozzáadása;
  - egy tőkefotó törlése;
  - képaláírás szerkesztése;
  - borítókép kijelölése és automatikusra állítása;
- minden fotóművelet tranzakciósan frissíti a tőke `updatedAt` értékét;
- fotóművelet Firestore-írása nem tartalmazza az `events` mezőt, így nem írhat
  felül párhuzamos eseménymódosítást;
- fotótörlés a metaadatot írja ki először, majd best-effort törli a nagy és
  bélyeg Storage-objektumot a rekord saját útvonalai alapján;
- kijelölt fotó törlése ugyanabban a tranzakcióban nullázza a
  `coverPhotoId` mezőt;
- borítókép-kijelölés csak a tőke létező fotójára mutathat;
- hibás tárolt `coverPhotoId` olvasáskor csendben automatikus borítóra esik
  vissza, javító írás nélkül;
- az esemény hozzáadási inputjából és parancsából eltűnnek a fotófájlok;
- esemény hozzáadása, szerkesztése és törlése nem olvassa vagy írja a
  `photos[]` tömböt;
- a borítófeloldás, a galéria, a lightbox, a listakártya és az adatlap ugyanazt
  a `19`-ben létrehozott közös rendezőfüggvényt használja; a jelenlegi
  eseményidős/tömbindexes borítórendezés megszűnik.

## Scope: feltöltés és Storage

- az új tőkefotók útvonala
  `vines/{vineId}/photos/{photoId}.{extension}`;
- a tőkefotó hosszabbik oldala legfeljebb 1280 px;
- a jelenlegi bélyegképgenerálás megmarad;
- egy választási/feltöltési művelet legfeljebb hat képet fogad;
- `MAX_VINE_PHOTOS = 100` tőkénkénti biztonsági korlát;
- a szabad kapacitást a feltöltés előtt, majd a Firestore-tranzakcióban is
  ellenőrizni kell; nulla helynél nem indul kép-előkészítés vagy feltöltés;
- az új Storage-útvonal publikus olvasást és admin írást kap;
- a régi `vines/{vineId}/events/{eventId}/photos/{fileName}` szabály megmarad,
  hogy a migrált rekordok régi objektumai olvashatók és admin által törölhetők
  legyenek;
- új feltöltés soha nem használja a régi eseményes útvonalat.

## Scope: felület

- a tőke adatlapján önálló `Fotók` szakasz használja a `19` közös
  galériamodulját;
- a galéria nagy aktív kép + bélyegrács layoutot használ, az adminműveletek az
  aktív kép műveleti sávjában jelennek meg;
- minden tőkefotó ugyanabban a legújabb → legrégebbi galéria- és
  lightbox-sorrendben szerepel;
- admin külön műveletként adhat hozzá fotót egy már létrejött tőkéhez;
- feltöltéskor a képaláírás üres; utána fotónként szerkeszthető;
- admin fotónként törölhet és borítóképet jelölhet ki vagy vonhat vissza;
- az automatikus borító a `capturedAt ?? uploadedAt` szerinti legújabb fotó;
- a tőke létrehozási és szerkesztési űrlapja nem kap fotóválasztást;
- a tőkeesemény létrehozási és szerkesztési űrlapjából eltűnik a
  fotóválasztás és előnézet;
- az eseménykártyákból eltűnik a `VineEventPhotos` sor és minden fotóművelet;
- egyetlen tőkére mentett esemény sikerjelzése `Fotó hozzáadása ehhez a
  tőkéhez` gyorsműveletet kínál, amely a külön tőkefotó-választót nyitja meg,
  eseményhivatkozás átadása nélkül; többtőkés mentésnél nincs ilyen gomb;
- a lista és az adatlap fejléce ugyanabból a gyökérszintű fotólistából oldja
  fel a borítót;
- admin üres állapotban `Még nincs fotó ehhez a tőkéhez` üzenetet és jól
  látható kamera-/galériagombot kap;
- publikus üres állapotban a teljes `Fotók` szakasz rejtve marad;
- nem admin felhasználó meglévő képeknél látja a galériát és a borítót, de nem
  lát írási műveleteket;
- a fotószakasz címe limit nélküli tört helyett `Fotók (N)` alakú; a 100-as
  biztonsági korlát csak a kapacitás közelében és hibaüzenetben válik láthatóvá.

## Scope: eltávolítás és dokumentáció

- a régi eseményfotó-parancsok, helpernevek és már nem használt
  `VineEventPhotos` implementáció eltávolítása;
- a seedek és fixture-ök átállítása a gyökérszintű fotóalakra;
- a README Firestore- és Storage-sémájának frissítése;
- a cutover futtatási sorrendjének dokumentálása a `20` scriptjével;
- a dashboard deploy csak sikeres mentés és nulla hibás `--verify` után
  történhet; rövid karbantartási ablak vállalt, legacy olvasási fallback nem
  készül;
- a megvalósítás után a
  [koncepció státuszának](../vine-photo-model/spec.md#státusz) frissítése.

## Elfogadási kritériumok

- [ ] A `Vine` gyökérszintű `photos[]` és `coverPhotoId` mezőt használ; a
      `VineEvent` nem tartalmaz fotókat.
- [ ] A tőke összes fotója egy galériában és egyetlen lightbox-sorrendben
      bejárható, legújabb fotóval elöl.
- [ ] A galéria első képe, az automatikus borító, a listakártya és az adatlap
      fejléce ugyanabból a közös rendezőfüggvényből származik.
- [ ] Azonos dátumú régi fotóknál az új tie-break miatt változó automatikus
      borító vállalt, fixture-rel dokumentált cutover-hatás.
- [ ] EXIF nélküli fotó a feltöltési idejével kerül a sorrendbe, megfelelő
      `Feltöltve` címkével.
- [ ] Egy műveletben legfeljebb hat új fotó tölthető fel, az új Storage-útvonalra
      és 1280 px-es maximális hosszabbik oldallal.
- [ ] Egy tőkéhez legfeljebb 100 fotó tartozhat; a felület a maradék helyre
      vág, nulla kapacitásnál feltöltés előtt megáll, a tranzakció pedig
      párhuzamos írás esetén is betartja a korlátot.
- [ ] Új tőke, tőkeszerkesztés és eseményűrlap nem fogad fotófájlt.
- [ ] Az eseménykártyákon nincs fotósor vagy fotóművelet.
- [ ] Fotó hozzáadása, törlése, feliratmódosítása és borítókép-váltása frissíti
      a tőke `updatedAt` értékét és a lista rendezését.
- [ ] Fotóművelet egyetlen eseményt sem módosít; eseményművelet egyetlen fotót
      sem módosít vagy töröl.
- [ ] Fotóművelet Firestore update payloadja nem tartalmaz `events` mezőt;
      eseményműveleté pedig nem tartalmaz `photos` mezőt.
- [ ] A kézi borító megmarad új fotó feltöltése után; visszavonáskor ismét a
      legújabb fotó az automatikus borító.
- [ ] Kijelölt borító törlésekor a mutató tranzakciósan nullázódik.
- [ ] Nem létező borítóazonosító olvasáskor hiba nélkül automatikus borítóra
      esik vissza.
- [ ] A galéria vizuálisan megkülönbözteti az automatikus és a kézzel kijelölt
      borítót; a közös interface ehhez `pinnedPhotoId` értéket használ.
- [ ] Régi Storage-útvonalon maradt migrált fotó és bélyeg ugyanúgy megnyílik
      és törölhető, mint az új útvonalon lévő.
- [ ] A régi eseményfotó-feltöltés és `VineEventPhotos` kódút eltűnik; nincs
      tartós kettős modell.
- [ ] Emulatoros integrációs teszt fedi a fotó CRUD-ot, a borító invariánsait,
      az `updatedAt` frissítését és az esemény–fotó függetlenséget.
- [ ] A `20` migrációs scriptjének eredményével futó alkalmazást külön
      integrációs vagy E2E fixture ellenőrzi.
- [ ] A cutover runbook mentés és nulla hibás `--verify` nélkül nem engedi a
      dashboard deployját.
- [ ] Az új és a régi Storage-útvonal publikus olvasása, admin írása/törlése és
      nem admin írási tiltása külön, dokumentált ellenőrzést kap.
- [ ] Egytőkés eseménymentés után a gyors fotógomb a tőke külön választóját
      nyitja meg, és a létrejövő fotó nem tartalmaz eseményhivatkozást;
      többtőkés eseménynél a gomb nem jelenik meg.
- [ ] Fotó nélküli tőkén az admin jól látható hozzáadási állapotot kap, publikus
      nézetben pedig nem jelenik meg üres fotószakasz.
- [ ] Admin és publikus tőkeadatlap pontos állapota mobilon és desktopon
      reprodukálva, DOM-mal és képernyőképpel ellenőrizve.
- [ ] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a teljes releváns Playwright E2E zöld.

## Nem része

- Fotó és esemény összekapcsolása.
- Közös, több tőke által birtokolt fotó.
- Több céltőkét birtokló közös eseményentitás.
- Fotó készítési időpontjának kézi szerkesztése.
- Kézi dugvány-borítókép.
- Közös esemény–fotó idővonal.
- Éles adatmigráció automatikus elindítása.

## Érintett terület

- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/vineCoverPhoto.ts`
- `dashboard/src/features/vines/vineEventPhotos.ts`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/vines/ui/VineEventPhotos.tsx`
- `dashboard/src/features/vines/ui/VinesList.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/photos/`
- `storage.rules`
- `README.md`
- kapcsolódó unit-, integration- és E2E-tesztek, seedek és screenshotok

## Comments

- A cutover szándékosan egy issue: a modellel együtt kell eltűnnie az eseményes
  UI-nak és megjelennie a tőkegalériának, különben valamelyik köztes commit nem
  fordulna vagy a felhasználó fotói átmenetileg elérhetetlenné válnának.
