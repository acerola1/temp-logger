# Szabadon bővíthető tőkehelyszín és listaszűrés

Feature: vine-location
Type: feature
Status: done
Blocked by: -

## Probléma

A nyilvántartott szőlőtőkék több, egymástól elkülönülő helyen lehetnek. A
felhasználó esetében néhány tőke az erkélyen, a többség pedig a telken van, de
a jelenlegi modell csak egy kötelező, szabad szöveges `areaDescription`
területleírást tárol. Ez alkalmas egy tőke pontos helyének leírására, de nem ad
egységes, megbízható csoportosítást és szűrést az `Erkély`, `Telek` jellegű
helyszínekre.

A helyszín egyszerű szabad szöveges mezőként könnyen elgépelhető lenne. Sok
tőke egymás utáni terepi rögzítésekor felesleges minden alkalommal újra beírni
ugyanazt az értéket.

## Domainfogalmak

- **Helyszín:** több tőkét összefogó, szabadon bővíthető helynév, például
  `Erkély` vagy `Telek`.
- **Területleírás:** a helyszínen belüli pontosabb, tőkénként eltérő leírás,
  például `déli sor, a kaputól az első tőke` vagy `korlát melletti cserép`.
- A helyszín nem címke: önálló mező, saját bevitellel és pontos egyezésű
  listaszűrővel.

## Cél

Minden tőkéhez tartozhasson egy helyszín. Az admin új helyszínnevet szabadon
beírhat, de a mező felkínálja a már használt helyszíneket, hogy a választás
gyors legyen és csökkenjen az elgépelésekből származó duplikáció. Új tőke
felvitelekor alapértelmezésben a legutóbb létrehozott, helyszínnel rendelkező
tőke helyszíne legyen kiválasztva. A tőkelista helyszín szerint szűrhető legyen.

## Érték- és alapértelmezési szabályok

- A `location` trimelt, nem üres szöveg az újonnan létrehozott tőkéknél.
- A helyszínválasztó szabad bevitelt és a katalógusban már használt értékekből
  választást is enged.
- A javaslatok trimelve, magyar locale szerinti kis- és nagybetűtől függetlenül
  egyediek és betűrendben jelennek meg.
- Ha a beírt érték csak kis- és nagybetűben tér el egy meglévőtől, mentéskor a
  meglévő írásmódot kell megtartani. Például `telek` nem hoz létre a már létező
  `Telek` mellé külön szűrőértéket.
- Új tőke űrlapja a `createdAt` szerint legutóbb létrehozott, nem üres
  helyszínű tőke értékével indul. Egy tőke későbbi szerkesztése nem változtatja
  meg ezt az alapértelmezést.
- Ha még nincs helyszínnel rendelkező tőke, a mező üresen indul és az adminnak
  kell megadnia az első értéket.
- Szerkesztéskor mindig az adott tőke saját helyszíne jelenik meg; az utolsó
  helyszín alapértéke csak új tőke létrehozására vonatkozik.
- A régi, `location` mező nélküli dokumentumok hiba nélkül, `Nincs megadva`
  helyszínnel olvashatók. Ezek külön szűrőértékkel megtalálhatók, és
  szerkesztéskor helyszínt kell kapniuk.

## Szűrés és URL-állapot

- A tőkelista egyválasztós `Helyszín` szűrőt kap: `Mind`, a meglévő helyszínek,
  valamint szükség esetén `Nincs megadva`.
- A helyszínszűrés kis- és nagybetűtől független pontos egyezésű; az `Erkély`
  kiválasztása nem találja meg az `Erkély alsó polc` értéket.
- A helyszín kombinálható a meglévő állapot-, gyökérzet-, címke- és
  termett-szűrőkkel, valamint a kereséssel és rendezéssel.
- A kiválasztott helyszín az URL `location` query paraméterében megmarad
  frissítéskor, közvetlen link megnyitásakor és visszanavigáláskor.
- Ismeretlen vagy már nem használt URL-érték nem okoz hibát; a lista üres
  találati állapotot mutathat, a szűrő pedig továbbra is visszaállítható.

## Scope

- `location` hozzáadása a `Vine`, `CreateVineInput` és `EditVineInput`
  modellekhez;
- visszafelé kompatibilis Firestore-beolvasás a mező nélküli dokumentumokhoz;
- trimelés, validáció és kis-/nagybetűtől független meglévőérték-feloldás;
- egyedi helyszínjavaslatok származtatása a betöltött tőkekatalógusból;
- szabad bevitelt és meglévő érték választását támogató, billentyűzettel és
  mobilon is használható űrlapvezérlő;
- utoljára létrehozott tőke helyszínének alapértéke az új tőke űrlapján;
- a helyszín megjelenítése a tőke adatlapján;
- helyszínszűrő, URL parse/serialize és tiszta lista-szelekció;
- régi, helyszín nélküli tőkék megjelenítése és szűrése;
- unit-, emulatoros integrációs és mobil/desktop E2E tesztek.

## Elfogadási kritériumok

- [x] Admin új tőkéhez meglévő helyszínt választhat vagy új helyszínnevet írhat
      be ugyanabban a mezőben.
- [x] A javaslatok a már használt helyszínekből származnak, trimelve,
      kis-/nagybetűtől függetlenül duplikáció nélkül és magyar betűrendben.
- [x] Meglévő helyszín eltérő kis-/nagybetűs beírása a kanonikus meglévő
      írásmóddal mentődik, és nem jelenik meg külön szűrőopcióként.
- [x] Új tőke űrlapján a legutóbb létrehozott, helyszínnel rendelkező tőke
      helyszíne alapból ki van választva, de mentés előtt szabadon módosítható.
- [x] Az alapértéket a `createdAt`, nem az utolsó szerkesztés ideje határozza
      meg; meglévő tőke szerkesztése nem írja át a következő új tőke helyszínét.
- [x] Ha nincs korábbi helyszín, az első új tőke csak nem üres, trimelt helyszín
      megadása után menthető.
- [x] Meglévő tőke szerkesztése a saját helyszínét mutatja és azt módosítja,
      nem az új tőkéhez számított alapértéket.
- [x] A tőke adatlapja a helyszínt a területleírástól külön mezőként mutatja.
- [x] A `Helyszín` szűrő pontosan a kiválasztott helyhez tartozó tőkéket mutatja
      és együtt működik minden meglévő szűrővel, kereséssel és rendezéssel.
- [x] A helyszínszűrő `location` URL-paramétere parse/serialize round-trip után,
      frissítéskor és visszanavigáláskor megmarad.
- [x] Régi, `location` mező nélküli tőkék továbbra is betöltődnek, az adatlapon
      `Nincs megadva` értéket mutatnak és erre az értékre szűrhetők.
- [x] Régi tőke szerkesztésekor a helyszín kötelezővé válik, de pusztán a
      kompatibilis beolvasás nem írja automatikusan vissza a dokumentumot.
- [x] Nem admin felhasználó is használhatja a helyszínszűrőt és láthatja a
      helyszínt, de nem módosíthatja.
- [x] Helyszín megadása vagy szűrése nem módosítja a területleírás és a címkék
      jelenlegi jelentését vagy értékét.
- [x] A vezérlő mobilon és desktopon, billentyűzettel is használható; az
      alapérték, a javaslatlista, az új érték és a validáció látható állapotai
      DOM-mal és képernyőképpel ellenőrzöttek.
- [x] Unit teszt fedi a normalizálást, javaslatokat, alapértéket, régi rekordot,
      URL-kezelést és a kombinált listaszűrést.
- [x] Emulatoros integrációs teszt fedi az új helyszín mentését, a meglévő
      helyszín kanonikus feloldását és a mező nélküli dokumentum olvasását.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a releváns Playwright E2E tesztek zöldek.

## Nem része

- előre konfigurált vagy admin által külön kezelt helyszíntörzs;
- GPS-koordináta, postai cím, térkép, sor- vagy pozíciómodell;
- több helyszín hozzárendelése egyetlen tőkéhez;
- a meglévő területleírás automatikus felbontása vagy helyszínné migrálása;
- helyszínenként külön sorszámozás;
- dugványok helyszínkezelése.

## Érintett terület

- `CONTEXT.md`
- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/forms.ts`
- `dashboard/src/features/vines/listState.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/ui/VineForm.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- kapcsolódó unit-, integration- és Playwright E2E tesztek

## Comments

- 2026-08-30: Felhasználói igény alapján létrehozva. A helyszínek szabadon
  bővíthetők, de a már használt értékek választhatók. Új tőkénél az utoljára
  létrehozott tőke helyszíne az alapérték, hogy gyorsabb legyen a terepi
  adatrögzítés és kisebb legyen az elgépelés esélye.
- 2026-08-30: A helyszín és a területleírás külön domainfogalomként került a
  `CONTEXT.md` szótárába. Nem készült ADR, mert a döntés lokális és könnyen
  módosítható; nincs nehezen visszafordítható architekturális trade-off.
- 2026-08-30: Implementálva. A `location` a `Vine`, `CreateVineInput` és
  `EditVineInput` modellek része; a mező nélküli régi dokumentumok olvasáskor
  `null` értéket kapnak, automatikus visszaírás nélkül. A meglévő írásmódra
  való feloldás az űrlaprétegben (`toVineInput`) történik a betöltött
  katalógusból, a `createVine` pedig a sorszámhoz úgyis lekért snapshotból oldja
  fel — az `editVine` így nem olvas külön kollekciót.
- 2026-08-30: Ismert korlát, szándékosan nyitva hagyva: ha a `location`
  URL-paraméter csak kis-/nagybetűben tér el egy meglévő helyszíntől (pl.
  `?location=erkély` az `Erkély` mellett), a lista helyesen szűr, de a
  `Helyszín` legördülő `Mind`-et mutat, mert a select értéke betűhű, a tartalék
  opció őre viszont kis-/nagybetűtől független. Az alkalmazás maga sosem gyárt
  ilyen URL-t; kézzel írt vagy megosztott linkkel érhető el. A javítás a select
  értékének `resolveVineLocation`-nel való kanonizálása lenne.
- 2026-08-30: Fedezeti hézagok: nincs automatikus teszt arra, hogy a szerkesztő
  a tőke saját helyszínét mutatja (kézzel, böngészőben ellenőrizve: a #1 tőke
  szerkesztője `Telek`, míg az új tőke alapértéke `Erkély`), és arra sem, hogy a
  régi, helyszín nélküli tőke szerkesztésekor válik kötelezővé a mező. A
  `getLatestVineLocation` unit tesztjében a fixture `updatedAt` értéke egyenlő a
  `createdAt`-tal, így nem különbözteti meg a kettőt. A `README.md`
  tőkedokumentum-mezőlistája sem kapta meg a `location` mezőt.
- 2026-08-30: A teljes Playwright futás egy, ettől a munkától független
  képernyőképen bukik (`toke-esemeny-urlap-szerkesztes-mobile`), ami a `main`-en
  is elhasal. Emiatt a `chromium-mutation` projekt függőségként kimarad; külön,
  `--no-deps` móddal futtatva zöld.
