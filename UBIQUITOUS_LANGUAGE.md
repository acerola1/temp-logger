# Ubiquitous Language

A projekt domain szótára magyarul. Forrás: `README.md`, `AGENTS.md`, `firestore.rules`, `functions/index.js`, `src/main.cpp`, `dashboard/src/types/*`, `dashboard/src/lib/schemas.ts`. Cél, hogy az UI-szövegek, commit üzenetek, taszk leírások és kód kommentek konzisztens szókincset használjanak.

## Hardver és firmware

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Eszköz** (`device`) | Egy fizikai ESP32 board, amelyhez egy DHT22 szenzor csatlakozik és ami `deviceId`-vel azonosítja magát. | szenzor, board, modul (önállóan) |
| **Szenzor** | A DHT22 / AM2302 hőmérséklet- és páratartalom-érzékelő, amit az **eszköz** olvas ki. Nem azonos az eszközzel. | DHT, érzékelő |
| **Eszközazonosító** (`deviceId`) | Az eszközt azonosító kisbetűs-számjegyes-kötőjeles string (pl. `esp32-lab`), Preferences-ben mentve. | device name, board id |
| **Eszköz token** (`FIREBASE_DEVICE_TOKEN` / `X-Device-Token`) | Megosztott titok az eszköz és a backend között, build-time secret. **Nem** azonosító, **nem** session, **nem** felhasználói token. | device id, auth token |
| **Setup AP** | Az `ESP32-DHT22-Setup` Wi-Fi hotspot, amit az eszköz nyit, ha nincs mentett hálózat. Itt állítható a Wi-Fi és a `deviceId`. | config portal, captive portal (önállóan) |
| **Mérési intervallum** | A két mérés közti idő a firmware-ben, jelenleg 15 perc (`kReadIntervalMs`). | sampling rate |

## Mérési adatfolyam

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Mérés** (`reading`, `SensorReading`) | Egy időponthoz tartozó hőmérséklet + páratartalom rekord egy adott eszköztől. | adat, sample, log |
| **Hőmérséklet** (`temperatureC`) | Celsius fokban tárolt szám, mindig `C` utótaggal a kódban. | temp |
| **Páratartalom** (`humidity`) | Százalékos relatív páratartalom (0–100). | nedvesség |
| **Mérés időpontja** (`recordedAt`) | A mérés kliensoldali ISO időbélyege (firmware adja). | timestamp |
| **Szerveroldali időbélyeg** (`createdAt`) | Firestore által beírt időpont. A dashboardban ez az **elsődleges** időforrás. | server time |
| **Ingest endpoint** | A Cloud Function, ami a méréseket fogadja: `ingestReading` (legacy) vagy `ingestReadingV2` (új). | upload endpoint |
| **Health report** (`kind: "health"`) | Eszközdiagnosztikai payload, ami a `deviceHealthReports` kollekcióba kerül (Wi-Fi státusz, RSSI, sikertelen küldések, stb.). | telemetry, status |
| **Pending reading** | Offline állapotban a firmware Preferences-ében sorba állított mérés, amit a következő sikeres kapcsolat elküld. | queue, buffer |

## Session és session típus

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Session** | Egy eszközön futó, időhatáros megfigyelési szakasz (pl. egy kalluszosító ciklus). Pontosan egy session lehet `active` egy eszközön egyszerre. | futás, ciklus, periódus |
| **Session típus** (`SessionType`) | Receptszerű sablon célzónákkal: `temperatureMin/Max`, `humidityMin/Max`, név. Ismert példák: `callusing`, `hajtato-sator`. | preset, profil |
| **Aktív session** (`status: "active"`) | A jelenleg futó session — ide kerülnek az új mérések `sessionId` mezője alapján. | élő session, current run |
| **Archivált session** (`status: "archived"`) | Lezárt session, csak olvasható megjelenítésre. | régi session, closed |
| **Célzóna** | A session típus által megadott `min`–`max` sáv, amit a grafikon kiemel. | target band, sweet spot |

## Session események

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Esemény** (`SessionEvent`) | Egy sessionhöz időponthoz kötött bejegyzés (cím, leírás, opcionális kép). | jegyzet, marker (önállóan) |
| **Esemény időpontja** (`occurredAt`) | Az esemény tényleges bekövetkezésének ideje, nem a rögzítésé. | created at |
| **Eseménymarker** | A grafikon alatti idővonalon a sorszámozott jelölő, ami egy eseményhez kattintható. | timeline pin |
| **Idővonal** (`EventTimelineRow`) | A grafikon alatti vízszintes sáv, ami a session eseményeit időrendben mutatja. | timeline (csak idővonal) |

## Dugvány és oltvány követés

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Dugvány** (`Cutting`) | Egy cserépben követett szőlő szaporítóanyag — gyűjtőfogalom mind a dugványra, mind az oltványra. URL: `/dugvanyok`. | növény, palánta |
| **Oltvány** (`plantType: "graft"`) | Az alanyra oltott szőlő. A `Dugvány` egyik altípusa. | grafted |
| **Sima dugvány** (`plantType: "cutting"`) | Oltatlan szőlővessző-szaporítás. | sima vessző |
| **Cserép sorszám** (`serialNumber`) | A cserépre írható egész szám, amit a rendszer automatikusan ad. | id, szám |
| **Fajta** (`variety`) | A szőlőfajta neve (pl. `Furmint`). | sort, kultivár |
| **Ültetés dátuma** (`plantedAt`) | Mikor került cserépbe — naptári nap, nem időpont (`IsoDateString`). | plántálás, telepítés |
| **Dugvány státusz** (`status`) | Életciklus jelölő: `active`, `rooted`, `lost`, `archived`. | state |
| **Fotó** (`CuttingPhoto`) | Egy dugványhoz rögzített kép, max `1000x1000`-re kliens oldalon átméretezve. | kép (kétértelmű — lásd ambiguitások) |
| **Öntözési napló** (`wateringLogs`) | Egy dugványhoz rögzített öntözési bejegyzés (`wateredAt`, jegyzet). | öntözés log |

## Szerepkörök és jogosultság

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Admin** | Olyan bejelentkezett Firebase Auth felhasználó, akinek az UID-ja szerepel az `admins/{uid}` kollekcióban. Csak ő írhat. | szerkesztő, owner |
| **Megfigyelő** | Bejelentkezett vagy névtelen olvasó, aki nem admin. UI-ban szerkesztő gombok rejtve. | viewer, guest |
| **Admin-only írás** | Firestore és Storage rules által kikényszerített szabály: minden módosító művelet adminhoz kötött, nem csak UI-szinten. | read-only mode |

## Adatstruktúra (legacy vs új)

A két adatfolyam párhuzamosan él. A dashboardban az **új** az elsődleges, a **legacy** átmeneti kompatibilitás.

| Kifejezés | Definíció | Kerülendő szinonimák |
| --- | --- | --- |
| **Legacy adatfolyam** | Az `ingestReading` endpoint és a `sensorReadings` + `sessions` (gyökér) kollekciók. | régi API |
| **Új adatfolyam** (V2) | Az `ingestReadingV2` endpoint és a `devices/{deviceId}/readings` + `devices/{deviceId}/sessions` aldokumentumok. | new schema |
| **Eszköz dokumentum** (`devices/{deviceId}`) | Az új struktúra gyökere egy eszközhöz; ismeretlen `deviceId`-re a backend automatikusan létrehozza. | device record |

## Kapcsolatok

- Egy **eszköz** több **mérést** termel, és egyszerre legfeljebb egy **aktív sessiont** futtat.
- Egy **session** pontosan egy **session típushoz** tartozik (`sessionTypeId`), és onnan örökli a **célzónákat**.
- Egy **mérés** opcionálisan tartozik egy **sessionhöz** (a backend a beérkezéskor felcímkézi az aktív session ID-jával).
- Egy **session** nullától több **eseményig** tartalmazhat, mindegyik egy időponthoz kötött.
- Egy **dugvány** önálló entitás, nincs sem **eszközhöz**, sem **sessionhöz** kötve — saját **fotó-** és **öntözési napló-**listája van.
- Az **eszköz token** authentikálja az ingest hívásokat; az **admin** szerep authorizálja a Firestore írást — a kettő független rendszer.

## Példa párbeszéd

> **Fejlesztő:** "Ha most hozok létre egy új sessiont a `callusing` típussal az `esp32-lab` eszközre, a következő mérés automatikusan hozzá kerül?"
>
> **Domain szakértő:** "Igen, az `ingestReadingV2` lekérdezi az eszköz aktív sessionjét és beírja a mérés `sessionId` mezőjébe. De csak egy aktív session lehet eszközönként, szóval ha volt másik, azt előbb archiválni kell."
>
> **Fejlesztő:** "És ha a session előtt érkezett mérés? Az utólag becsatlakozik?"
>
> **Domain szakértő:** "Nem, a session ID a beérkezés pillanatában kerül a mérésre. Ami előbb jött, az `sessionId` nélkül marad — a grafikonon a session sávon kívül látszik."
>
> **Fejlesztő:** "A session típus célzónái meddig érvényesek? Ha menet közben módosítom a `temperatureMax`-ot a `callusing` típusban, az visszamenőleg is változik?"
>
> **Domain szakértő:** "Igen, a célzónák a session típusból olvasódnak ki minden megjelenítésnél, nincs lemásolva a sessionbe. Szóval új zóna = új kép a régi grafikonokon is."

## Jelölt kétértelműségek

- **"szenzor" vs "eszköz"**: a `README.md` több helyen "több szenzor kezelése" formában fogalmaz, de a kód `device` / `deviceId` mentén modellez. Egy ESP32 board (eszköz) **egy** DHT22 szenzort olvas. Javaslat: UI-ban és docban is **eszköz**, ha az ESP32-ről van szó; **szenzor** csak a DHT22 hardverre.
- **"kép" vs "fotó" vs "imageUrl"**: a `Cutting` világban `photos`/`CuttingPhoto`, az `SessionEvent` világban `imageUrl`/`imageStoragePath`. Két különböző útvonalon mennek a Storage-be (`cuttings/...` vs `sessions/...`). Javaslat: domain szókincsben **fotó** a dugványoknál, **eseménykép** a session eseményeknél — a kódban a meglévő `photo` / `image` névadás marad, mert szerkezetben is különböznek.
- **"session" mint szó**: a kódban végig `session`, a UI-ban is `session` (pl. `SessionSelector`, "session neve"). A `tasks/` és kommitok közt felbukkan "munkamenet" jellegű fordítás — ezt **kerüljük**, maradjon **session** a UI-ban is, mert már bevett.
- **`sessions` (gyökér) vs `devices/{id}/sessions`**: ugyanaz a név két különböző kollekcióra. A gyökér `sessions` **legacy**; új kódban mindig az aldokumentum-útvonalat használjuk. Ahol kétértelmű lehet, írjuk ki: "device session" vs "legacy session".
- **"recordedAt" vs "createdAt"**: mindkettő időpont egy mérésen. A `recordedAt` a kliens által megadott mérés időpontja (firmware ISO string), a `createdAt` a Firestore szerveroldali írás időpontja. A dashboard **a `createdAt`-ot tekinti elsődlegesnek** — ezt érdemes újabb komponensekben is megtartani, hogy ne csússzon a kliens órájával.
- **"event" több jelentésben**: van **session esemény** (`SessionEvent`, sessionhöz kötött), **dugvány esemény** (`CuttingEvent`, dugványhoz kötött, csak jegyzet) és **health event** (`eventType` a health reportban, eszközdiagnosztika). Ezek **különböző** dolgok — sose írjunk csak "esemény"-t kontextus nélkül.
- **"oltvány" vs "dugvány"**: a `Dugvány` modell mindkettőt fedi (`plantType: "graft" | "cutting"`). A "dugvány" a gyűjtőfogalom és az URL is `/dugvanyok`. Javaslat: a UI nézet címe maradjon "Dugványok", de listán/űrlapon legyen explicit a típus címke ("Oltvány" / "Sima dugvány").
