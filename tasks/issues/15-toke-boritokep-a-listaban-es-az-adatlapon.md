# Tőke borítóképe a listában és az adatlapon

Feature: photo-handling
Type: feature
Status: ready-for-agent
Blocked by: 12, 13

## Cél

Minden tőkének legyen egy borítóképe, ami a tőkelistában és az adatlapon is
megjelenik. Alapértelmezésben a legutóljára fényképezett kép, de admin ki tudjon
jelölni egy elsődleges képet, és onnantól mindig az legyen a borító.

## Kiindulás

A tőkének ma nincs saját képe, csak az eseményeinek: a fotók a `VineEvent.photos`
tömbben, a tőkedokumentumba beágyazva élnek
([model.ts:27](../../dashboard/src/features/vines/model.ts)). A tőkelista kártyája
([VinesList.tsx:79](../../dashboard/src/features/vines/ui/VinesList.tsx)) és a
tőke adatlap fejléce
([VineDetail.tsx:234](../../dashboard/src/features/vines/ui/VineDetail.tsx))
tisztán szöveges; kép csak az eseménykártyák fotósorában van
(`VineEventPhotos`).

A dugványoldalon ennek a fele már megvan, döntés nélkül: a
[CuttingsList.tsx:27](../../dashboard/src/components/CuttingsList.tsx) a
`cutting.photos.at(-1)`-et mutatja bélyegként. Ez a tömbsorrendet nézi, nem a
készítési időt, és nincs kijelölési lehetőség — a tőkénél nem ezt akarjuk
lemásolni.

A kép „utolsó fényképezés" szerinti rendezéséhez már van adat: a `12` issue-val
minden fotó `capturedAt`-ot kapott, ami EXIF nélkül `null`, és a felület ilyenkor
a feltöltés idejét mutatja (`photoDateLabel`,
[photoMetadata.ts:58](../../dashboard/src/features/photos/photoMetadata.ts)).

A `13` issue-val a fotóműveletek (`addEventPhotos`, `deleteEventPhoto`,
`editEventPhotoCaption`) egyetlen tranzakciós `updateEventPhotos`
read–modify–write-ra épülnek a tőkedokumentumon
([firestoreVines.ts](../../dashboard/src/features/vines/firestoreVines.ts)) —
az új parancs is ebbe a mintába illik.

## Triage döntések

- **A kijelölés a tőkén él, nem a fotón.** Új mező a tőkedokumentumon:
  `coverPhoto: { eventId: string; photoId: string } | null`. Nem a beágyazott
  fotórekordba tett `isPrimary` flag, mert az áthelyezés akkor két esemény
  fotótömbjét írná (a régi flag törlése + az új beállítása), a `13` tranzakciója
  viszont szándékosan egyetlen esemény `photos` tömbjét cseréli. Egyetlen
  gyökérszintű mutatóval nem is állhat elő két elsődleges kép.
- **A `null` azt jelenti: automatikus.** Nem tesszük bele a kijelöléskor
  aktuálisan legfrissebb képet, mert akkor az „alapértelmezett" viselkedés
  megfagyna: későbbi új fotó már nem venné át a borítót.
- **A sorrend a felületen látható dátum szerint megy**, azaz
  `capturedAt ?? uploadedAt` (a `photoDateLabel` értéke). Így a lista nem
  mondhat mást, mint amit a fotó alatt kiírunk. A `capturedAt`-tal és a nélkül
  lévő rekordok tehát egy rendezésbe kerülnek.
- **Az elavult mutató nem hiba.** Ha a `coverPhoto` már nem létező eseményre
  vagy fotóra mutat (régi adat, párhuzamos írás), a felület csendben az
  automatikus képre esik vissza, hibaüzenet és javító írás nélkül.
- **Nincs visszamenőleges adatmigráció.** A meglévő tőkék `coverPhoto` nélkül
  maradnak, ami pontosan az automatikus viselkedést jelenti.
- **A dugványoldal ebben az issue-ban nem változik.** A `CuttingsList`
  `photos.at(-1)` bélyege marad; a közös borítólogika kiterjesztése külön
  feladat.

## Scope

- `coverPhoto` mező a tőke modelljében és a `mapVine` olvasásában, hiányzó vagy
  hibás alak esetén `null`-ra olvasva
- új tiszta modul (`features/vines/vineCoverPhoto.ts`) a borító feloldására:
  a tőkéből ad vissza képet, a hozzá tartozó eseményt, és hogy kijelölt-e vagy
  automatikus; ugyanezt használja a lista és az adatlap, hogy ne tudjanak
  eltérni
- determinisztikus rendezés: `capturedAt ?? uploadedAt` szerint csökkenő, azonos
  dátumnál az esemény `occurredAt`-ja, majd a fotó tömbön belüli sorrendje dönt
- új catalog parancs: `setCoverPhoto(vineId, coverPhoto)`, ahol a `null` a
  kijelölés visszavonása; tranzakciós írás a `13` mintája szerint, a tőke
  `updatedAt`-jának frissítésével
- a parancs a tranzakcióban ellenőrzi, hogy a megnevezett esemény és fotó
  valóban létezik-e; nem létezőre nem ír mutatót
- ha a törölt fotó (`deleteEventPhoto`) vagy a törölt esemény (`deleteEvent`) az
  éppen kijelölt borító, a mutató ugyanabban a tranzakcióban `null`-ra áll
- UI, tőkelista: bélyeg a kártyán, kép nélküli tőkénél a `CuttingsList`
  placeholder-nyelvét követő ikon
- UI, tőke adatlap: borítókép a fejlécben, a közös `PhotoLightbox`-szal
  nagyítható, alatta a kép dátumsora és jelzés arról, hogy kijelölt vagy
  automatikus borító
- UI, kijelölés: az eseménykártya fotósorában (`VineEventPhotos`) admin módban
  fotónkénti elsődleges-váltó, a jelenlegi borító megjelölve; a kijelölés
  visszavonható
- nem admin felhasználó látja a borítót, de nem lát kijelölő gombot
- `firestore.rules` nem változik: a `vines` írása ma is admin-only, a mező nincs
  külön validálva

## Elfogadási kritériumok

- [x] Fotóval rendelkező tőke kártyája a listában képet mutat, fotó nélküli
      tőkéé placeholdert; a kártya elrendezése mobilon és desktopon sem törik el.
- [x] Az adatlap fejlécében ugyanaz a kép jelenik meg, mint a lista kártyáján.
- [x] Kijelölés nélkül a borító a legutóljára fényképezett kép, több esemény
      fotói között is, a felületen kiírt dátum szerint.
- [x] EXIF nélküli (`capturedAt: null`) és EXIF-fel rendelkező fotók egyetlen
      rendezésbe kerülnek, a `capturedAt ?? uploadedAt` érték szerint.
- [x] Azonos dátumú fotóknál a borító választása determinisztikus, azaz ugyanaz
      az adat mindig ugyanazt a képet adja.
- [x] Admin egy fotót elsődlegesnek jelölhet, és onnantól új fotó feltöltése
      után is az marad a borító.
- [x] A kijelölés visszavonható, és utána újra a legutóljára fényképezett kép a
      borító.
- [x] Egyszerre legfeljebb egy fotó lehet elsődleges: másik kép kijelölése az
      előzőt felváltja, külön visszavonás nélkül.
- [x] Az elsődleges fotó törlése után a borító automatikusra esik vissza, és a
      tőkén nem marad árva mutató.
- [x] Az elsődleges fotót tartalmazó esemény törlése után szintén automatikusra
      esik vissza.
- [x] Nem létező eseményre vagy fotóra mutató `coverPhoto` esetén a felület az
      automatikus képet mutatja, hibaüzenet nélkül.
- [x] A borító kijelölése nem változtatja meg a fotó egyéb adatait
      (`caption`, `capturedAt`), és a többi esemény fotóit sem.
- [x] A tőke `updatedAt` értéke a kijelölésnél és a visszavonásnál is frissül.
- [x] Nem admin felhasználó nem lát kijelölő gombot, és a Firestore-szabály sem
      engedi neki az írást.
- [x] A borítókép a közös `PhotoLightbox`-ban nyílik meg, nem születik harmadik
      képnéző.
- [x] Egységteszt fedi a borítófeloldást: kijelölt kép, automatikus kép, elavult
      mutató, fotó nélküli tőke, dátumegyezés.
- [x] Emulatoros integrációs teszt fedi a kijelölést, a visszavonást, a nem
      létező fotóra adott elutasítást, és a mutató nullázását fotó- és
      eseménytörlésnél.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      zöld.
- [x] Playwright E2E zöld, új képernyőképpel a lista bélyegéről és az adatlap
      borítójáról, desktopon és mobilon is.

## Érintett terület

- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/vineCoverPhoto.ts` (új)
- `dashboard/src/features/vines/vineCoverPhoto.test.ts` (új)
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/useVineCatalog.ts`
- `dashboard/src/features/vines/ui/VinesList.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineEventPhotos.tsx`,
  `dashboard/src/features/vines/ui/VineEventPhotos.test.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/firestoreVines.integration.test.ts`
- `dashboard/src/features/vines/listState.test.ts`,
  `dashboard/src/features/vines/ui/VineEventForm.test.tsx` (csak a tőkefixture)
- `dashboard/e2e/vine-detail-form.spec.ts`,
  `dashboard/e2e/zz-vine-mutation.spec.ts`

## Comments

- 2026-08-04: A `vine-e2e-1` seed pont a vegyes esetet adja: az egyik fotónak van
  `capturedAt`-ja (a feltöltés előtti időpont), a másik szándékosan a régi,
  `capturedAt` nélküli alakban maradt. A két rekord így a felületen kiírt dátum
  szerint fordított sorrendben áll, mint a tömbben — az automatikus borító
  helyessége ezen a seeden látszik, a `photos.at(-1)` viszont nem elég hozzá.
- 2026-08-04: A lista nem igényel új Firestore-olvasást: a `subscribeToVines`
  amúgy is a teljes tőkedokumentumot hozza a beágyazott fotókkal. A bélyeg
  ugyanakkor az 1280 px-es képet töltené le; a borítóhoz külön kisebb változat
  generálása nem ennek az issue-nak a scope-ja.
- 2026-08-04: A feloldás egyetlen tiszta függvény (`resolveVineCoverPhoto`),
  amit a `VinesList` és a `VineDetail` is hív, tehát a bélyeg és a nagy kép nem
  tud eltérni. A rendezés a `photoDateLabel` értékét használja, nem a saját
  dátumlogikáját, így a borító sorrendje és a kép alatt kiírt dátum ugyanabból
  az egy helyről jön.
- 2026-08-04: A mutató nullázása nem külön parancs: a `13` óta minden fotótörlés
  a közös `updateEventPhotos` tranzakcióban fut, ezért ott elég egyszer
  megnézni, hogy a kijelölt kép eltűnt-e az új tömbből — így a szinkron akkor is
  megmarad, ha később új fotóművelet kerül a modulba. Az eseménytörlés a saját
  tranzakciójában ugyanezt teszi az `eventId` alapján.
- 2026-08-04: A `setCoverPhoto` a tranzakcióban ellenőrzi az eseményt és a fotót,
  de a *felület* elavult mutatóra nem hibázik: a `resolveVineCoverPhoto`
  csendben az automatikus képre esik vissza. A kettő nem ugyanaz a szál — írni
  csak érvényes mutatót lehet, olvasni bármit muszáj.
- 2026-08-04: Az adatlap borítója kötött magasságú, `object-contain` keret. Az
  első változat `max-h`-val és auto szélességgel készült, de az 1280 px-es fekvő
  kép így kilógott volna a kártyából; a fix keret mellett a portré kép is
  egészben látszik, és mobilon nem tolja el az adatokat.
- 2026-08-04: A fotósor gombjai (borító, aláírás, törlés) 375 px-en nem férnek
  ki egy sorba: a gombcsoport maga is tördel, különben a `Törlés` kilóg a
  fotókártyából. Ezt az E2E DOM-mérése is őrzi, nem csak a képernyőkép.
- 2026-08-04: A meglévő E2E-lokátorok `getByText('Első fürtök')` és
  `getByText('Közös metszés')` alakban kerestek, ami a borítófelirat miatt már
  két elemre illett; a címsorra szűkítettem őket a felirat elrontása helyett.
- 2026-08-04: Ellenőrzés: unit tesztek (150/150, ebből 13 új: a borítófeloldás
  kilenc esete és négy komponensteszt), emulatoros integrációs tesztek (22/22,
  ebből 4 új: kijelölés–visszavonás, elutasított mutatók, nullázás fotó- és
  eseménytörlésnél), lint, production build, teljes Playwright E2E (18/18) új
  képernyőképekkel a borítóról desktopon és mobilon.
