# PRD: Szőlőtőke-követés

> **Későbbi döntés:** a fotók tulajdonlására, életciklusára és
> megjelenítésére vonatkozó részeket felülírja a
> [tőkefotók önálló modelljének koncepciója](../vine-photo-model/spec.md).
> A tőkefotó a tőkéhez tartozik, nem a tőkeeseményhez.

## Összefoglaló

A dashboard kapjon egy új **Tőkék** funkciót a nyaralóban kiültetett
szőlőtőkék leltározására és élettörténetük követésére. A funkció elsődleges
célja, hogy minden meglévő tőke gyorsan felvihető legyen akkor is, ha egyes
történeti vagy eredetadatok nem ismertek.

A kiültetett **Szőlőtőke** önálló entitás. Nem a jelenlegi **Dugvány** új
állapota. Egy tőke opcionálisan hivatkozhat arra a dugványra, amelyből
származik, de a kapcsolat csak navigációs link: nincs automatikus
létrehozás, archiválás, adatöröklés, szinkronizáció vagy összefűzött
idővonal.

## Probléma

A kert szőlőtőkéit a tulajdonos telepítette, de több tőke fajtája,
szaporítási eredete vagy telepítési ideje ma már nem ismert pontosan. A
filoxéra jelenléte miatt különösen fontos nyilvántartani, hogy egy tőke
oltott, saját gyökerű vagy ismeretlen gyökérzetű.

A rendszernek nem szabad kitalált pontosságot kikényszerítenie. Az
ismeretlen gyökérzet, az `Ismeretlen` fajtanév és az ismeretlen telepítési
idő érvényes adat.

## Elsődleges cél

Az első verzió akkor sikeres, ha a kert összes szőlőtőkéje egyenként,
minimális adatbevitellel leltárba vehető, majd később szerkeszthető és
eseményekkel dokumentálható.

## Termék alapelvek

- KISS: csak a jelenlegi használathoz szükséges fogalmak és műveletek
  kerüljenek az első verzióba.
- A bizonytalanság ne akadályozza a felvitelt.
- A történeti adatokat ne töröljük csak azért, mert egy tőke megszűnt.
- A tőkekövetés működése, ahol értelmes, kövesse a már bevált
  dugványkövetési mintákat.
- A felület legyen mobilbarát, de az első verzió online-only.

## Domainfogalmak

### Szőlőtőke

Az egy helyre kiültetett és önállóan nyilvántartott szőlőtőke. Automatikus,
egész szám alapú sorszám azonosítja.

### Gyökérzet típusa

A filoxérakockázat szempontjából fontos besorolás:

- `oltott`
- `saját gyökerű`
- `ismeretlen`

### Termett már

Kézzel szerkeszthető igen/nem jelölő arról a megfigyelhető tényről, hogy a
tőke hozott-e már termést. Ez nem fajtaazonossági garancia, de segít
elkülöníteni a még nem termett tőkéket.

### Tőkeesemény

Egy tőkéhez, dátumhoz és időponthoz kötött naplóbejegyzés. Kezdeti típusai:

- `megfigyelés`
- `metszés`
- `permetezés`
- `megszűnés`

## Tőkeadatok

| Adat | Követelmény |
| --- | --- |
| Sorszám | Automatikusan kiosztott egész szám. A felületen nem szerkeszthető és korábbi szám nem használható újra. |
| Fajta | Kötelező, szabad szöveges mező. Ismeretlen fajtánál az `Ismeretlen` érték kézzel beírható. |
| Termett már | Kézzel szerkeszthető igen/nem jelölő. |
| Gyökérzet típusa | Kötelező választás: oltott, saját gyökerű vagy ismeretlen. |
| Alanyfajta | Opcionális szöveg, oltott tőkénél használható. |
| Telepítési év | Opcionális, 1000 és 9999 közötti négyjegyű évszám. Ismeretlenül hagyható. |
| Területleírás | Kötelező, szabad szöveges helyleírás. Nincs külön helyszín-, sor-, koordináta- vagy térképmodell. |
| Állapot | Aktív vagy megszűnt. Új tőke alapértelmezésben aktív. |
| Címkék | Opcionális, szabad szöveges címkék a dugványokéval azonos működéssel, de külön tőke-címkeajánlási készlettel. |
| Általános jegyzet | Opcionális tartós háttérinformáció, amely nem egy adott eseményhez tartozik. |
| Eredeti dugvány | Opcionális hivatkozás egy meglévő dugványra. |
| Létrehozás és módosítás ideje | A rendezéshez és az adatlap történeti kontextusához tárolandó. |

## Felhasználói folyamatok

### Új tőke felvétele

1. Az admin az **Új tőke** gombbal megnyitja az űrlapot.
2. A rendszer automatikusan kiosztja a következő, korábban nem használt
   sorszámot.
3. Az admin megadja legalább a fajtát, a gyökérzet típusát és a
   területleírást. Az ismeretlen gyökérzet érvényes választás.
4. A további adatok opcionálisan megadhatók.
5. Mentés után a felhasználó visszatér a normál felületre. Nincs külön
   „Mentés és következő” folyamat.

### Dugvány hivatkozása

- A tőke létrehozásakor vagy szerkesztésekor opcionálisan kiválasztható egy
  eredeti dugvány.
- A tőke adatlapján a hivatkozás kattintható és megnyitja a dugvány
  adatlapját.
- A hivatkozás mentésén kívül a kapcsolat nem módosítja a dugvány vagy a
  tőke más adatait, és nem másol át adatokat.
- A dugvány kiültetési eseménye nem hoz létre automatikusan tőkét.

### Tőke szerkesztése

- Az admin a sorszám kivételével szerkesztheti a tőke adatait.
- A megszűnt tőke állapota kézzel visszaállítható aktívra.
- A felületen nincs végleges tőketörlés.

### Esemény rögzítése

Egy esemény adatai:

- eseménytípus;
- dátum és időpont;
- opcionális egyedi cím;
- jegyzet;
- nulla vagy több fotó.

Ha a cím üres, a felület az eseménytípus nevét használja címként. Az
eseményfotóknak nincs külön képaláírásuk; a kontextust az esemény címe és
jegyzete adja.

Ugyanaz az esemény egyszerre több kiválasztott tőkéhez is hozzáadható. Ilyen
esetben minden tőke saját, később külön szerkeszthető eseménypéldányt kap.

### Esemény szerkesztése és törlése

- Az admin a dugványeseményekhez hasonlóan szerkesztheti és törölheti a
  tőkeeseményeket.
- Egy esemény törlésekor a hozzá tartozó fotók is törlődnek.
- `megszűnés` esemény létrehozása a tőke állapotát megszűntre állítja.
- A megszűnés esemény szerkesztése vagy törlése nem állítja automatikusan
  aktívra a tőkét. Az állapot külön, kézzel szerkeszthető.

## Lista és részletes nézet

### Navigáció

- Menüpont: **Tőkék**
- Lista: `/tokek`
- Részletes oldal: `/tokek/{vineId}`
- Az adatlapokon használt teljes elnevezés: **Szőlőtőke**

### Listakártya

A listakártyán csak az alábbi adatok jelenjenek meg:

- sorszám;
- fajta;
- gyökérzet típusa;
- állapot;
- címkék.

A területleírás kereshető, de nem jelenik meg a listakártyán. A `Termett
már` jelölő szűrhető, de nem jelenik meg a kártyán.

### Alapértelmezett listaállapot

- Alapértelmezésben csak az aktív tőkék látszanak.
- Az alapértelmezett rendezés az utolsó módosítás ideje, legfrissebb elöl.
- Nincs fajta szerinti csoportosítás vagy darabszám-összesítés.

### Keresés

A keresés vizsgálja:

- a fajtát;
- a sorszámot;
- a területleírást.

### Rendezés

Választható rendezési szempontok:

- fajtanév;
- telepítési idő;
- utolsó módosítás.

A sorszám kereshető, de nem rendezési szempont.

### Szűrés

A lista szűrhető:

- állapot szerint;
- gyökérzet típusa szerint;
- címkék szerint;
- a `Termett már` értéke szerint.

## Jogosultság

- A tőkeadatok és eseményfotók olvasása publikus.
- Tőkét, eseményt és fotót csak admin hozhat létre vagy módosíthat.
- A jogosultsági szabályokat nemcsak a felület, hanem az adattárolási
  szabályok is kényszerítsék ki.

## Nem cél az első verzióban

- Automatikus tőkelétrehozás dugvány kiültetésekor.
- Dugvány és tőke adatainak öröklése vagy szinkronizálása.
- Összefűzött dugvány–tőke idővonal.
- Fajtaazonossági vagy bizonyossági szintek.
- Strukturált permetezési vagy metszési részletek, például szer, dózis vagy
  metszési mód.
- Virágzás, zsendülés és szüret külön eseménytípusként.
- Eseményenkénti emlékeztetők vagy értesítések.
- Offline adatbevitel és későbbi szinkronizáció.
- Tömeges tőkeimport vagy „Mentés és következő” folyamat.
- Fajta szerinti csoportosítás és darabszámok.
- Több kert vagy helyszín kezelése.
- Strukturált sor- és pozícióadat, GPS vagy kerttérkép.
- Fizikai címkék vagy QR-kódok kezelése.
- Átoltások és egy tőkén élő több nemes fajta modellezése.
- Végleges tőketörlés a felületen.

## Jövőbeli lehetőségek

- Strukturált terület-, sor- és tőkehelymodell vagy sematikus kerttérkép.
- Több kert/helyszín kezelése.
- Átoltások és egy gyökérzeten élő több nemesrész önálló modellezése.
- Offline terepi adatbevitel.
- Fizikai azonosítók vagy QR-kódok.
- Strukturált növényvédelmi és metszési adatok, ha később keresési vagy
  összesítési igény jelenik meg.

## Elfogadási feltételek

1. Admin létre tud hozni egy aktív tőkét automatikus sorszámmal, kötelező
   fajtanévvel, gyökérzettípussal és területleírással.
2. Ismeretlen fajta az `Ismeretlen` szabad szöveges értékkel, ismeretlen
   gyökérzet pedig önálló választási lehetőségként rögzíthető.
3. A telepítési idő pontos dátummal, csak évvel vagy ismeretlenül is
   tárolható.
4. A tőke adatai a sorszám kivételével szerkeszthetők, de tőke nem törölhető
   véglegesen a felületről.
5. Az eredeti dugvány opcionálisan linkelhető, és a link nem okoz más
   adatváltozást.
6. Megfigyelés, metszés, permetezés és megszűnés esemény rögzíthető címmel,
   jegyzettel és több opcionális fotóval.
7. Egy esemény több tőkéhez egyszerre hozzáadható, majd tőkénként külön
   szerkeszthető és törölhető.
8. Megszűnés esemény rögzítése megszűnt állapotba teszi a tőkét; az esemény
   törlése nem aktiválja automatikusan.
9. Alapértelmezésben csak az aktív tőkék látszanak, utolsó módosítás szerint
   csökkenő sorrendben.
10. A lista fajta, sorszám és területleírás alapján kereshető; fajta,
    telepítési idő és utolsó módosítás alapján rendezhető; állapot,
    gyökérzet, címke és termésjelölő alapján szűrhető.
11. A listakártya csak a sorszámot, fajtát, gyökérzettípust, állapotot és
    címkéket mutatja.
12. A tőke címkézése a dugványokéval azonos módon működik, de külön
    ajánlási készletet használ.
13. A tőkeadatok publikusak, minden módosítás admin jogosultsághoz kötött.
14. A lista, adatlap és adatbevitel mobilon használható, de hálózati
    kapcsolatot igényel.
