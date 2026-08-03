# Közös fotó-feature kiemelése és a duplikált feltöltés megszüntetése

Feature: photo-handling
Type: refactor
Status: ready-for-agent
Blocked by: –

## Cél

Egyetlen fotómodul (`dashboard/src/features/photos/`) szolgálja ki a dugvány-,
a munkamenet- és a tőkeoldalt. A `vineEventPhotos.ts`-ben újraírt feltöltési
hurok szűnjön meg, a benne lévő hibakompenzáció viszont **minden** hívóra
érvényes legyen.

## Kiindulás

A `hooks/usePhotoUpload.ts` és a `features/vines/vineEventPhotos.ts` külön
valósítja meg ugyanazt: soros `uploadBytesResumable` hurok, aggregált progress,
`getDownloadURL`, metaadat-összeállítás. Az eltérés csak az, hogy a tőkés ág
hibára takarít, a közös hook nem. Részletes összevetés:
[spec](../photo-handling/spec.md).

## Scope

- új `dashboard/src/features/photos/` modul, index-en át exportált publikus felülettel
- `lib/imageUpload.ts` → `features/photos/imagePreparation.ts`,
  `lib/fileUtils.ts` `getFileExtension`-je ugyanide
- keretrendszer-független `uploadPreparedPhotos` a Storage-hurokra
- `usePhotoUpload` erre épül, és **hibára best-effort törli** az adott
  művelet már feltöltött objektumait
- `usePhotoPicker` ide költözik, kiegészülve az érintőeszköz-felismeréssel és a
  `multiple` váltásával
- `vineEventPhotos.ts` vékony adapterré fogy: útvonalépítés,
  `VineEventPhoto`-ra képezés és a meglévő törlő függvény
- a régi `hooks/usePhotoUpload.ts`, `hooks/usePhotoPicker.ts`, `lib/imageUpload.ts`
  és `lib/fileUtils.ts` megszűnik, a hívók az új modulra állnak

## Elfogadási kritériumok

- [x] `features/photos/` egyetlen helyen tartalmazza a kép-előkészítést, a
      feltöltő hurkot, a progress-számítást és a Storage-takarítást.
- [x] A dugvány-galéria, a dugványűrlap, a dugványlista, a munkamenet-esemény és
      a tőkeesemény ugyanazt a feltöltő belépési pontot használja.
- [x] Egy több képes feltöltés közepén dobott Storage-hiba után az addig
      feltöltött objektumok best-effort módon törlődnek – **minden** hívónál,
      nem csak a tőkésnél.
- [x] A `vineEventPhotos.ts` nem tartalmaz `uploadBytesResumable` hívást és saját
      progress-számítást.
- [x] `getFileExtension` és `prepareImageUpload` egyetlen helyről érkezik; a
      `lib/imageUpload.ts` és a `lib/fileUtils.ts` törölve.
- [x] A méretkorlát hívónként állítható marad: a tőkeeseményfotó 1280 px-en,
      a dugvány- és munkamenetfotó 1000 px-en készül elő a refaktor után is.
- [x] Az érintőeszköz-felismerés a userAgent mellett a
      `maxTouchPoints > 0 && matchMedia('(pointer: coarse)')` feltételt is
      elfogadja, így iPadOS 13+ Safariban is megjelenik a kameragomb.
- [x] Kameraforrásnál a rejtett input `capture="environment"` **és** `multiple`
      nélkül nyílik; galériánál fordítva.
- [x] A `SessionEventForm` desktop ága is a megosztott rejtett inputot használja,
      nem egy másodikat a `<label>`-ben.
- [x] A dugványoldal látható viselkedése nem változik.
- [x] Egységteszt fedi a kép-előkészítést (limit alatti kép változatlanul megy
      fel, limit feletti átméreteződik) és a hibára történő takarítást.
- [x] `npm test`, `npm run lint`, `npm run build` zöld.

## Érintett terület

- `dashboard/src/features/photos/**` (új)
- `dashboard/src/hooks/usePhotoUpload.ts`, `dashboard/src/hooks/usePhotoPicker.ts` (törlés)
- `dashboard/src/lib/imageUpload.ts`, `dashboard/src/lib/fileUtils.ts` (törlés)
- `dashboard/src/features/vines/vineEventPhotos.ts`
- `dashboard/src/components/CuttingPhotoGallery.tsx`, `CuttingForm.tsx`,
  `CuttingsPage.tsx`, `SessionEventForm.tsx`

## Comments

- 2026-08-03: Elkészült a `features/photos` modul: `imagePreparation.ts`
  (`prepareImageUpload` + `getFileExtension`), a keretrendszer-független
  `photoUpload.ts` (`uploadPreparedPhotos`, `deletePhotoObjects`), a rá épülő
  `usePhotoUpload` és a `usePhotoPicker`. A takarítás így minden hívónál fut.
- 2026-08-03: A `vineEventPhotos.ts` vékony adapter lett (útvonal, 1280 px-es
  előkészítés, `VineEventPhoto`-ra képezés); a Firebase-szingleton elkerülése
  miatt a `photos` mag almoduljait importálja, nem az indexet.
- 2026-08-03: A `usePhotoPicker` az iPadOS 13+ Safarit a
  `maxTouchPoints > 0 && matchMedia('(pointer: coarse)')` feltétellel ismeri fel,
  és kamerához `multiple` nélkül, galériához `capture` nélkül nyitja az inputot.
  A `SessionEventForm` desktop ága a megosztott rejtett inputot használja.
- 2026-08-03: Ellenőrzés: unit tesztek (39/39, köztük az új kép-előkészítés-,
  takarítás- és eszközfelismerés-tesztek), lint, production build, integrációs
  tesztek (13/13) és teljes Playwright E2E (18/18).
