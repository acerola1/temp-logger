# Telepítési idő egyszerűsítése opcionális évszámra

Feature: vine-planting-year
Type: enhancement
Status: ready-for-agent
Blocked by: -

## Probléma

A tőkeűrlapon jelenleg először külön ki kell választani a telepítési idő
pontosságát (`Pontos dátum`, `Csak év`, `Ismeretlen`), majd ettől függően egy
második mezőt is ki kell tölteni. Ez a használathoz képest feleslegesen
bonyolult: a szőlőtőkék nyilvántartásához elegendő a telepítés éve, a hónap és
a nap nem hordoz szükséges információt.

A jelenlegi `VinePlantingDate` háromágú típusa, a feltételes űrlap és a három
formmező ugyanezt a felesleges összetettséget viszi végig a modellen,
validáción, Firestore-leképezésen, megjelenítésen és rendezésen is.

## Domainfogalom

**Telepítési év:** a tőke kiültetésének ismert naptári éve. Nem dátum és nincs
pontossági szintje; ha nem ismert, az értéke üres.

## Cél

A tőke létrehozó és szerkesztő űrlapján egyetlen opcionális `Telepítés éve`
mező legyen. Az admin vagy megad egy évszámot, vagy üresen hagyja. Ne legyen
előtte pontosságválasztó, dátummező vagy külön `Ismeretlen` választás.

## Célmodell

- A domainmodell a `VinePlantingDate` diszkriminált unió helyett egyetlen
  `plantingYear: number | null` értéket használjon.
- A Firestore új írásai szintén `plantingYear` mezőt tároljanak; a `null`
  jelenti, hogy az év nem ismert.
- A régi `plantingDate` rekordok visszafelé kompatibilisen olvashatók:
  - `{ precision: 'date', date: '2022-04-03' }` → `2022`;
  - `{ precision: 'year', year: 2022 }` → `2022`;
  - `{ precision: 'unknown' }`, hiányzó vagy hibás érték → `null`.
- Egy régi tőke mentése az új `plantingYear` mezőt írja, és eltávolítja a régi
  `plantingDate` mezőt. Pusztán a rekord megnyitása nem írja át az adatbázist.
- A hónap és nap elvesztése szándékos: a felület a régi pontos dátumból is csak
  az évet jeleníti meg, a továbbiakban pedig csak ez az év marad domainadat.

## Űrlap és validáció

- Egyetlen, opcionális, numerikus `Telepítés éve` mező jelenik meg.
- Üres vagy csak whitespace érték `null`-ra normalizálódik.
- Nem üres érték pontosan négy számjegyű, `1000` és `9999` közötti egész év
  lehet, a jelenlegi évvalidáció határainak megtartásával.
- Hibás értéknél a hiba közvetlenül az évmező mellett jelenik meg.
- Létrehozáskor és szerkesztéskor ugyanaz az egy mező és ugyanaz a validáció
  használatos.

## Rendezés és megjelenítés

- Az adatlap `Telepítési év` címkével csak az évszámot, hiányzó értéknél
  `Ismeretlen` szöveget mutat.
- A meglévő `Telepítve` rendezés megmarad, de kizárólag az évszámot hasonlítja
  össze: újabb év előbb, azonos évnél sorszám szerinti sorrend, ismeretlen év
  a lista végén.
- Egy korábbi pontos dátum hónapja és napja többé nem befolyásolja a rendezést.
- Az URL-ben tárolt `sort=planting_desc` érték visszafelé kompatibilis marad.

## Scope

- `VinePlantingDate` eltávolítása és `plantingYear: number | null` bevezetése a
  tőke domain- és inputtípusokban;
- az űrlap három telepítési mezőjének és feltételes megjelenítésének cseréje
  egyetlen opcionális évmezőre;
- egyszerűsített Zod-validáció és form → domain normalizálás;
- régi `plantingDate` Firestore-adatok kompatibilis beolvasása és új
  `plantingYear` írása;
- a régi mező eltávolítása a következő tőkeszerkesztéskor;
- adatlap-megjelenítés és évszám alapú listarendezés;
- érintett seedek, fixture-ök és tesztek átállítása;
- unit-, emulatoros integrációs és mobil/desktop E2E regressziós tesztek.

## Elfogadási kritériumok

- [ ] Az új és szerkesztő tőkeűrlapon pontosan egy `Telepítés éve` mező van;
      pontosságválasztó, dátummező és `Ismeretlen` választó nincs.
- [ ] Az üres év érvényes, `null` értékként mentődik és az adatlapon
      `Ismeretlen` formában jelenik meg.
- [ ] Érvényes négyjegyű év elmenthető, visszanyitáskor ugyanaz az év látszik.
- [ ] Nem négyjegyű, nem egész vagy a `1000–9999` tartományon kívüli érték nem
      menthető, és érthető mezőszintű hibát kap.
- [ ] Új Firestore-dokumentum `plantingYear` mezőt tartalmaz, és nem tartalmaz
      `plantingDate` objektumot.
- [ ] Régi `date` pontosságú dokumentum az ISO dátum évével töltődik be, és a
      hónap vagy nap nem jelenik meg a felületen.
- [ ] Régi `year` pontosságú dokumentum az eredeti évével, régi `unknown` vagy
      hiányzó érték pedig ismeretlen évként töltődik be.
- [ ] Régi tőke mentése az új `plantingYear` mezőre áll át és eltávolítja a
      `plantingDate` mezőt; egyszerű megnyitás nem okoz Firestore-írást.
- [ ] Telepítési év szerinti rendezés újabb évvel kezd, azonos évnél sorszám
      szerint rendez, az ismeretlen értékeket pedig a végére teszi.
- [ ] Két azonos évű, korábban eltérő pontos dátumú tőke sorrendjét már nem a
      hónap vagy nap, hanem a sorszám dönti el.
- [ ] A meglévő `sort=planting_desc` URL-paraméter változtatás nélkül működik.
- [ ] A mező mobilon numerikus billentyűzetet kér, és mobil/desktop nézetben
      nincs a megszüntetett pontosságválasztó helyén üres vagy hibás elrendezés.
- [ ] Unit teszt fedi a validációt, normalizálást, mindhárom régi adatalakot és
      az évszám alapú rendezést.
- [ ] Emulatoros integrációs teszt fedi az új tárolási alakot és a régi rekord
      szerkesztéskori átállását.
- [ ] Mobil és desktop E2E teszt fedi az üres és kitöltött év létrehozását,
      szerkesztését és adatlap-megjelenítését.
- [ ] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      és a releváns Playwright E2E tesztek zöldek.

## Nem része

- hónap vagy nap tárolása és megjelenítése;
- hozzávetőleges év vagy évtartomány;
- külön pontosság- vagy `Ismeretlen` választó;
- automatikus évbecslés más tőkeadatokból;
- a telepítési év tömeges szerkesztése.

## Érintett terület

- `CONTEXT.md`
- `dashboard/src/features/vines/model.ts`
- `dashboard/src/features/vines/forms.ts`
- `dashboard/src/features/vines/listState.ts`
- `dashboard/src/features/vines/firestoreVines.ts`
- `dashboard/src/features/vines/ui/VineForm.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- kapcsolódó unit-, integration- és Playwright E2E tesztek és seedek

## Comments

- 2026-08-30: Felhasználói igény alapján létrehozva. A háromféle pontosság és
  az azt követő második beviteli mező helyett egyetlen opcionális évmező kell.
- 2026-08-30: A pontos régi dátumokból csak az év marad meg, az ismeretlen
  telepítési idő pedig `null` lesz. A kanonikus domainfogalom `Telepítési év`
  néven bekerült a `CONTEXT.md` szótárába. Nem készült ADR, mert ez közvetlen
  termékegyszerűsítés, nem nehezen visszafordítható architekturális döntés.
