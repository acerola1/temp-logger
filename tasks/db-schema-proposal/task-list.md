# Task list

## 1. Legfontosabb cél: új ESP32 gyors beállítása a régi mellé

- [ ] Az új ESP32 kapjon működő `deviceId`-t a setup folyamatban.
- [ ] Az új ESP32 tudjon a `v2` endpointnak küldeni.
- [ ] A `v2` endpoint mentse az új ESP32 méréseit az új adatstruktúrába.
- [ ] Az új ESP32-hez automatikusan jöjjön létre device dokumentum, ha még nincs.
- [ ] Legyen dashboard nézet, ahol az új ESP32 adatai már látszanak.
- [ ] Legyen lehetőség a régi és új eszköz adatainak összehasonlítására.
- [ ] Ellenőrizzük, hogy az új eszköz adatfolyama folyamatosabb-e, mint a régié.

## 2. Firestore előkészítés

- [ ] Hozzuk létre a `sessionTypes` kollekció kezdeti dokumentumait.
- [ ] Hozzuk létre a `sessionTypes/callusing` dokumentumot.
- [ ] Hozzuk létre a `sessionTypes/rooted-grapes` dokumentumot.
- [ ] Ellenőrizzük, hogy a `sessionTypes` dokumentumok mezői ezek:
  - `name`
  - `temperatureMin`
  - `temperatureMax`
  - `humidityMin`
  - `humidityMax`
- [x] Frissítsük a Firestore rules fájlt az új struktúrához.
- [x] Engedélyezzük az olvasást a `sessionTypes` kollekcióra.
- [x] Engedélyezzük az olvasást a `devices` kollekcióra.
- [x] Engedélyezzük az olvasást a `devices/{deviceId}/sessions` alkollekcióra.
- [x] Engedélyezzük az olvasást a `devices/{deviceId}/readings` alkollekcióra.
- [x] Hozzuk létre a szükséges indexeket a `readings` alkollekcióra.
- [x] Hozzuk létre a szükséges indexeket a `sessions` alkollekcióra.
- [x] Készítsük elő a collection group indexet az összesített `readings` nézethez.

## 3. Backend: v2 endpoint

- [x] Hozzunk létre új Cloud Function végpontot `ingestReadingV2` néven.
- [x] A meglévő `ingestReading` endpoint maradjon változatlan.
- [x] A v2 endpoint továbbra is tokennel hitelesítsen.
- [x] A v2 endpoint fogadja a `deviceId`, `temperatureC`, `humidity`, `recordedAt` mezőket.
- [x] A v2 endpoint az új Firestore struktúrába írjon.
- [x] A v2 endpoint ne tartalmazzon `deviceId` validációt.

## 4. Backend: device auto-create és device alapadatok

- [x] A v2 endpoint kezeljen ismeretlen `deviceId`-t is.
- [x] Ha a `devices/{deviceId}` dokumentum nem létezik, hozza létre automatikusan.
- [x] Az automatikusan létrejövő device dokumentum mezője legyen:
  - `name`
- [x] Az automatikus `name` alapból legyen maga a `deviceId`.
- [x] Logoljuk, ha új device dokumentum jön létre.
- [ ] Készüljön elő arra is, hogy a device `name` később szerkeszthető legyen a dashboardból.

## 5. Backend: session feloldás és reading mentés

- [x] A v2 endpoint az adott device alatt keresse meg az aktív sessiont.
- [x] Az aktív session keresése itt történjen:
  - `devices/{deviceId}/sessions`
- [x] Ha van aktív session, a reading kapjon `sessionId` mezőt.
- [x] Ha nincs aktív session, a reading `sessionId: null` formában menjen el.
- [x] A reading ide kerüljön:
  - `devices/{deviceId}/readings/{readingId}`
- [x] A reading mezői legyenek:
  - `sessionId`
  - `temperatureC`
  - `humidity`
  - `recordedAt`
- [x] A v2 endpoint adjon vissza sikeres választ és hibaüzenetet.

## 6. Firmware: setup átírása

- [x] A setup folyamatot módosítsuk úgy, hogy a `deviceId` is beállítható legyen.
- [x] A setup portálban jelenjen meg külön mező a `deviceId`-nek.
- [x] A setup portál töltse be az aktuálisan mentett `deviceId`-t, ha már van.
- [x] A setup portál validálja a `deviceId`-t mentés előtt.
- [ ] Hibás `deviceId` esetén jelenjen meg azonnali hibaüzenet.
- [x] A setup csak érvényes `deviceId` mellett engedje a mentést.
- [x] A setupban a `deviceId` formátuma legyen: kisbetűk, számok, kötőjel.
- [x] Ha nincs mentett `deviceId`, generáljunk default értéket.
- [x] Az alapértelmezett `deviceId` chip-azonosító alapú generált érték legyen.

## 7. Firmware: `deviceId` tárolás

- [x] A `deviceId` ne build flagként éljen tovább.
- [x] A `deviceId` Preferences-ben legyen tárolva.
- [x] Induláskor a firmware a mentett `deviceId`-t töltse be.
- [x] Ha nincs mentett `deviceId`, a firmware mentse el a generált default értéket.
- [ ] Ellenőrizzük, hogy a `deviceId` túléli-e a restartot és az alvásból visszatérést.

## 8. Firmware: v2 endpoint használata

- [x] A firmware tudjon a v2 endpointnak küldeni.
- [x] Az új endpoint URL egyelőre build configból jöjjön.
- [ ] Az új szenzor rögtön a v2 endpointot használja.
- [ ] A mostani szenzor átmenetileg maradjon v1-en.
- [ ] A régi működést egyelőre ne törjük el.
- [x] A soros logban látszódjon, hogy a v1 vagy v2 endpointot használja az eszköz.
- [x] `401 unauthorized` esetén a soros log külön auth hibát írjon ki.

## 9. Dashboard: alap adatlekérés

- [ ] Töltsük be a `devices` listát az új struktúrából.
- [ ] Készítsünk device választót a dashboardhoz.
- [ ] A kiválasztott device méréseit olvassuk innen:
  - `devices/{deviceId}/readings`
- [ ] A kiválasztott device sessionjeit olvassuk innen:
  - `devices/{deviceId}/sessions`
- [ ] Töltsük be a `sessionTypes` adatokat is a dashboardban.
- [ ] Az aktív sessionhez tartozó `sessionTypeId` alapján oldjuk fel a célértékeket.

## 10. Dashboard: összehasonlító nézet

- [ ] Legyen összesített device dashboard nézet.
- [ ] Az összesített nézet collection group queryvel dolgozzon a `readings` adatokon.
- [ ] Az összesített nézetben lehessen egyszerre több device adatait látni.
- [ ] Legyen lehetőség a régi és új ESP32 adatainak egymás melletti összehasonlítására.
- [ ] A grafikonokon lehessen megkülönböztetni a device-okat.
- [ ] A kimaradt adatok és az adatfolyam sűrűsége is legyen könnyen észrevehető.

## 11. Dashboard: session kezelés

- [ ] A session létrehozás device-onként történjen.
- [ ] Session létrehozáskor lehessen `sessionTypeId`-t választani.
- [ ] A session lezárás device-onként működjön.
- [ ] Az aktív session mindig a kiválasztott device kontextusában jelenjen meg.
- [ ] Kezeljük azt az állapotot is, amikor nincs aktív session az adott device alatt.
- [ ] Lehessen sessiont szerkeszteni.
- [ ] Session szerkesztéskor lehessen módosítani a `name` mezőt.
- [ ] Session szerkesztéskor lehessen módosítani a `sessionTypeId` mezőt.
- [ ] Session szerkesztéskor tisztázzuk, hogy módosítható-e a `status`.

## 12. Dashboard: device kezelés

- [ ] Lehessen device-ot átnevezni a dashboardból.
- [ ] A device átnevezés a `devices/{deviceId}` dokumentum `name` mezőjét módosítsa.
- [ ] Az automatikusan létrejött device-ok kapjanak később emberi nevet a UI-ból.

## 13. Dashboard: grafikonok és táblázatok

- [ ] A grafikonok a kiválasztott device méréseit mutassák.
- [ ] A grafikonok célzónái a `sessionTypes` alapján jelenjenek meg.
- [ ] Session nélküli méréseknél ne jelenjen meg célzóna.
- [ ] A táblázat jelezze, ha egy reading session nélküli.
- [ ] A summary kártyák a kiválasztott device adataiból számoljanak.

## 13/B. Dashboard: session események a grafikonokon

- [x] Legyen lehetőség sessionhöz eseményeket rögzíteni.
- [x] Az események itt legyenek tárolva:
  - `devices/{deviceId}/sessions/{sessionId}/events/{eventId}`
- [x] Egy esemény minimális mezői legyenek:
  - `occurredAt`
  - `title`
  - `description`
  - `imageUrl` opcionális
  - `imageStoragePath` opcionális
  - `imageWidth` opcionális
  - `imageHeight` opcionális
  - `createdAt`
  - `updatedAt`
- [x] Az esemény cím és leírás külön mező legyen.
- [x] A dashboard a kiválasztott session eseményeit is töltse be.
- [x] A grafikonokon az események jelenjenek meg külön jelöléssel az idővonalon.
- [x] Az eseményjelölő fölé húzva az egeret jelenjen meg tooltipben a rövid leírás.
- [x] Az eseményjelölőre kattintva nyíljon meg részletes popup vagy modal.
- [x] A popupban jelenjen meg az esemény teljes szövege, időpontja és opcionális képe.
- [ ] Több esemény közeli időpont esetén se essen szét a grafikon használhatósága.
- [x] Mobilon is használható legyen az esemény megnyitás.
- [x] Admin módban lehessen új session eseményt létrehozni.
- [x] Admin módban lehessen meglévő session eseményt szerkeszteni.
- [x] Admin módban lehessen session eseményt törölni.
- [x] Ha az eseményhez kép tartozik, az Firebase Storage-ba kerüljön.
- [x] Az eseményképeknél ugyanaz a kliens oldali átméretezés menjen, mint a dugványképeknél.

## 14. Backward kompatibilis átállás

- [ ] A régi adatbázis-struktúrát ne töröljük.
- [ ] A régi endpoint maradjon működőképes.
- [ ] A jelenlegi szenzor logolhasson tovább a régi útvonalon.
- [ ] Az új szenzor mehet az új v2 útvonalra.
- [ ] Dokumentáljuk, hogy melyik eszköz melyik endpointot használja.
- [ ] A régi adatok migrációját most ne csináljuk meg.

## 15. Dokumentáció

- [ ] Frissítsük a projekt dokumentációját az új v2 architektúrával.
- [ ] Dokumentáljuk az új Firestore struktúrát.
- [ ] Dokumentáljuk a setup közbeni `deviceId` beállítást.
- [ ] Dokumentáljuk az új endpoint használatát.
- [ ] Dokumentáljuk a `sessionTypes` kezdeti tartalmát.

## 16. Tesztelés

- [ ] Teszteljük, hogy új, ismeretlen `deviceId` esetén automatikusan létrejön a device.
- [ ] Teszteljük, hogy aktív session mellett a reading megkapja a `sessionId`-t.
- [ ] Teszteljük, hogy aktív session nélkül a reading `sessionId: null` mezővel mentődik.
- [ ] Teszteljük a setupban a `deviceId` validációt.
- [ ] Teszteljük, hogy a mentett `deviceId` restart után is megmarad.
- [ ] Teszteljük, hogy a dashboard az új struktúrából helyesen olvas.
- [ ] Teszteljük az összehasonlító dashboard nézetet.
- [ ] Teszteljük a device átnevezést.
- [ ] Teszteljük a session szerkesztést.
- [ ] Teszteljük, hogy a régi endpoint továbbra is működik.
- [ ] Teszteljük, hogy rossz token esetén az ESP32 külön auth hibát jelez.
- [ ] Teszteljük, hogy rossz token esetén a Cloud Function warningot logol.
