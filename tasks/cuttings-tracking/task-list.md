# Task list

## 1. Legfontosabb cél: dugványkövető oldal a meglévő dashboardban

- [x] Legyen külön dugvány oldal vagy fül a jelenlegi dashboardban.
- [x] A hőmérsékletes főoldal maradjon működő és változatlanul elérhető.
- [x] A dugvány oldalon lehessen listázni az összes felvitt dugványt.
- [x] Legyen új dugvány felvétele gomb.
- [x] A dugvány részletein látszódjon a fajta, a típus, az ültetés dátuma, a képek és az öntözési napló.
- [x] A szerkesztési műveletek csak adminként legyenek elérhetők.

## 2. Adatmodell véglegesítése

- [x] Véglegesítsük, hogy egy dugvány egy Firestore dokumentum legyen.
- [x] A fő kollekció neve legyen:
  - `cuttings`
- [x] A `cuttings/{cuttingId}` dokumentum mezői legyenek:
  - `serialNumber`
  - `variety`
  - `plantType`
  - `plantedAt`
  - `status`
  - `notes`
  - `photos`
  - `wateringLogs`
  - `createdAt`
  - `updatedAt`
  - `createdByUid`
- [x] A `plantType` kezdeti értékei legyenek:
  - `graft`
  - `cutting`
- [x] A `status` kezdeti értékei legyenek:
  - `active`
  - `rooted`
  - `lost`
  - `archived`
- [x] A `photos` tömb elemei tartalmazzák ezeket a mezőket:
  - `id`
  - `storagePath`
  - `downloadUrl`
  - `capturedAt`
  - `uploadedAt`
  - `width`
  - `height`
  - `caption`
- [x] A `wateringLogs` tömb elemei tartalmazzák ezeket a mezőket:
  - `id`
  - `wateredAt`
  - `notes`
- [ ] Döntsük el, hogy kell-e még az MVP-ben:
  - `amountMl`
  - `primaryPhotoPath`
  - `photoCount`
  - `lastWateredAt`

## 2/B. Azonosítás a cseréphez

- [x] Minden dugvány kapjon ember által is felírható sorszámot.
- [x] A sorszám jelenjen meg a lista nézetben.
- [x] A sorszám jelenjen meg a részletes nézetben.
- [x] Új dugvány létrehozásakor kapjon alapértelmezett következő sorszámot.
- [x] A sorszám automatikusan töltődjön létrehozáskor.

## 3. Firestore és Storage szabályok

- [x] Frissítsük a Firestore rules fájlt a `cuttings` kollekcióval.
- [x] A `cuttings` olvasása legyen publikus.
- [x] A `cuttings` létrehozása csak adminnak legyen engedélyezett.
- [x] A `cuttings` módosítása csak adminnak legyen engedélyezett.
- [x] A `cuttings` törlése csak adminnak legyen engedélyezett.
- [x] Készítsük elő a Storage szabályokat a dugványfotókhoz.
- [x] A dugványfotók feltöltése csak adminnak legyen engedélyezett.
- [x] A dugványfotók törlése csak adminnak legyen engedélyezett.
- [x] A dugványfotók olvasása legyen publikus vagy a dashboard igénye szerint egyszerűen kezelhető.

## 4. Dashboard navigáció és oldalváz

- [x] Bővítsük a dashboard navigációját egy dugvány nézettel.
- [x] A monitor és a dugvány nézet külön URL-t kapjon.
- [x] Az egyes dugványok részletes nézete is kapjon saját URL-t.
- [x] Legyen lista nézet a dugványoknak.
- [x] Legyen üres állapot, ha még nincs egyetlen dugvány sem.
- [x] A lista elemein legalább ez látszódjon:
  - `serialNumber`
  - `variety`
  - `plantType`
  - `plantedAt`
  - `status`
  - első kép előnézete, ha van
- [x] Legyen kijelölhető egy dugvány a részletes nézethez.

## 5. Adatlekérés és típusok a dashboardban

- [x] Hozzunk létre TypeScript típust a dugvány dokumentumhoz.
- [x] Hozzunk létre TypeScript típust a `photos` tömb elemeihez.
- [x] Hozzunk létre TypeScript típust a `wateringLogs` tömb elemeihez.
- [x] Készítsünk Firestore hookot a `cuttings` lista olvasásához.
- [x] A lista alapértelmezett rendezése legyen `plantedAt desc` vagy `createdAt desc`.
- [ ] Készítsünk leképezést a Firestore `Timestamp` mezőkhöz a kliens típusokra.
- [x] Kezeljük a loading állapotot.
- [x] Kezeljük a Firestore hibaállapotot.

## 6. Admin jogosultság és UI korlátozás

- [x] Használjuk a meglévő Google login + admin ellenőrzés mechanizmust.
- [x] Nem admin felhasználó csak olvasni tudjon.
- [x] Nem admin felhasználónak ne jelenjen meg az új dugvány gomb.
- [x] Nem admin felhasználónak ne jelenjen meg a szerkesztés, törlés, öntözés logolás és képfeltöltés akció.
- [x] Admin belépés nélkül az oldal továbbra is legyen használható megfigyelésre.

## 7. Új dugvány létrehozása

- [x] Készítsünk admin űrlapot új dugvány felviteléhez.
- [x] Az űrlap mezői legyenek:
  - `variety`
  - `plantType`
  - `plantedAt`
  - `status`
  - `notes`
- [x] A létrehozáskor lehessen rögtön egy vagy több képet kiválasztani.
- [ ] A létrehozáskor lehessen opcionálisan első öntözési bejegyzést rögzíteni.
- [x] Mentéskor a Firestore dokumentum kapja meg a `createdAt`, `updatedAt`, `createdByUid` mezőket.
- [x] Validáljuk, hogy a kötelező mezők ne maradjanak üresen.

## 8. Kliens oldali képfeltöltés és átméretezés

- [x] Készítsünk közös kliens oldali képfeldolgozó segédet.
- [x] A kliens oldali képkezelés mintája a következő meglévő példára épüljön:
  - `../tasteroom/src/components/ImageUpload.tsx`
- [x] A kiválasztott képet kliens oldalon méretezzük át legfeljebb 1000x1000-es befoglaló méretre.
- [x] A feltöltött kép formátuma legyen egységesen JPEG vagy WebP.
- [x] Tároljuk a végső kép `width` és `height` adatait is.
- [x] Tároljuk a letöltési URL-t is a kép metaadatában:
  - `downloadUrl`
- [x] Több kép kiválasztása is működjön egy dugványhoz létrehozáskor.
- [x] A feltöltés Firebase Storage-ba menjen.
- [x] A sikeres feltöltés után a kép metaadata kerüljön be a `photos` tömbbe.
- [x] Lehessen meglévő dugványhoz is új fotókat hozzáadni.
- [x] Mobilon legyen külön kamera és galéria indítási lehetőség a példaprojekt mintájára.
- [ ] Hiba esetén ne maradjon félkész Firestore állapot.

## 9. Dugvány részletes nézet

- [x] Készítsünk részletes nézetet a kiválasztott dugványhoz.
- [x] A részletes nézet mutassa a fő adatokat jól olvasható formában.
- [x] Jelenjen meg képgaléria a `photos` tömb alapján.
- [x] Legyen látható az öntözési napló időrendben.
- [x] Ha nincs kép, jelenjen meg üres állapot.
- [x] Ha nincs öntözési log, jelenjen meg üres állapot.

## 10. Dugvány szerkesztése

- [x] Legyen admin szerkesztő mód meglévő dugványhoz.
- [x] Lehessen módosítani ezeket a mezőket:
  - `variety`
  - `plantType`
  - `plantedAt`
  - `status`
  - `notes`
- [x] Módosításkor frissüljön az `updatedAt`.
- [x] Szerkesztésnél lehessen új képeket hozzáadni a meglévő `photos` tömb bővítésével.
- [x] Az MVP-ben lehessen képet törölni.
- [x] Képtörléskor a Firestore metaadat és a Storage fájl is törlődjön.

## 11. Öntözés logolása

- [x] Legyen külön admin akció új öntözési bejegyzés felvitelére.
- [x] Az öntözési bejegyzés minimális mezői legyenek:
  - `wateredAt`
  - `notes`
- [x] Az új öntözési bejegyzés a `wateringLogs` tömb végére vagy rendezett módon kerüljön be.
- [x] A megjelenítés időrendben történjen.
- [x] Az MVP-ben legyen öntözési bejegyzés szerkesztés.
- [x] Az MVP-ben legyen öntözési bejegyzés törlés.

## 12. Állapotkezelés és írási stratégia

- [ ] Döntsük el, hogy a dokumentum-frissítések teljes dokumentum merge-ként vagy célzott mezőfrissítéssel menjenek.
- [x] Tömbmódosításnál kerüljük az instabil index-alapú műveleteket.
- [x] A `wateringLogs` elemekhez mindig generáljunk stabil `id` értéket.
- [x] A `photos` elemekhez mindig generáljunk stabil `id` értéket.
- [ ] Több kép egymás utáni feltöltésénél legyen egyértelmű hibakezelés.
- [ ] Rögzítsük, hogy ennél a kis projektnél elfogadjuk a teljes dokumentum újraírását, ha ez egyszerűbb.

## 13. UI részletek és használhatóság

- [x] A dátumok jelenjenek meg egységes, helyi formátumban.
- [x] A `plantType` kapjon emberi olvasható címkét a UI-ban.
- [x] A `status` kapjon jól elkülönülő vizuális jelölést.
- [x] Mobilon is használható maradjon a lista és a részletes nézet.
- [x] Több kép esetén az előnézet maradjon áttekinthető.
- [x] Több kép esetén az utolsó feltöltött kép legyen az aktív előnézet.

## 14. Dokumentáció

- [ ] Dokumentáljuk a végleges dugvány Firestore sémát.
- [ ] Dokumentáljuk a Storage útvonal konvenciót.
- [ ] Dokumentáljuk az admin-only műveleteket.
- [ ] Dokumentáljuk a kliens oldali képátméretezés működését.
- [ ] Dokumentáljuk az ismert egyszerűsítéseket, például hogy a képek és öntözések tömbként vannak tárolva.

## 15. Tesztelés és ellenőrzés

- [ ] Teszteljük, hogy a dugvány lista betölt Firestore-ból.
- [ ] Teszteljük, hogy nem admin felhasználó nem tud írni.
- [ ] Teszteljük, hogy admin felhasználó tud új dugványt létrehozni.
- [ ] Teszteljük, hogy egy kép feltöltése után a Storage fájl és a Firestore metaadat is létrejön.
- [ ] Teszteljük, hogy több kép feltöltése működik.
- [ ] Teszteljük, hogy a kliens oldali átméretezés valóban lefut.
- [ ] Teszteljük, hogy öntözési log hozzáadható.
- [ ] Teszteljük, hogy szerkesztés után frissül az `updatedAt`.
- [ ] Teszteljük, hogy a részletes nézet megjeleníti a képeket és az öntözési adatokat.
- [ ] Teszteljük, hogy hiba esetén a UI érthető visszajelzést ad.

## 16. Nyitott döntések review előtt

- [x] A dugvány oldal most ugyanabban a dashboard appban külön nézetként induljon.
- [x] Az MVP-ben már van képtörlés.
- [x] Az MVP-ben egyelőre nem kell öntözési log szerkesztés vagy törlés.
- [x] Az MVP-ben egyelőre nem kell külön státuszváltó gyorsgomb.
- [x] A fotóknál maradhat `caption`, de első körben opcionális mezőként.
