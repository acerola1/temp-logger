# Firestore realtime listener újrafeliratkozási ciklusának megszüntetése

Feature: dashboard-refactor
Type: bug
Status: ready-for-agent
Blocked by: -

## Probléma

A dashboard nyitva tartása kontrollálatlan Firestore dokumentumolvasást indíthat.
2026. augusztus 3-án a production projektben 13 329 882 dokumentumolvasás történt
egyetlen nap alatt, miközben augusztus 1–3. között összesen csak 25 dokumentumírás
volt. Az olvasások gyakorlatilag mind `QUERY` típusúak (13 690 978 `QUERY` és
14 `LOOKUP` a három napon).

Óránkénti csúcs: 2 373 235 olvasás (aug. 3., 11:00 UTC). Az `eur3` multi-region
díjszabással (~0,06 USD / 100 000 olvasás, napi 50 000 ingyenes) ez a nap
körülbelül **8 USD**. Az 5 USD-s budget alert csak a küszöb volt, amit menet
közben átlépett, nem a napi végösszeg.

A Cloud Billing a Firestore/Datastore használatot az `App Engine` szolgáltatás
alatt könyveli, ezért a költség App Engine-ként jelenik meg akkor is, ha a
projektben nincs klasszikus App Engine alkalmazás.

## Gyökérok

A ciklus **két független defektus együttállásából** áll elő. Fontos: önmagában
egyik sem elég, mindkettőnek teljesülnie kell. Ezt a repró megírásánál figyelembe
kell venni, különben a „javítás előtti" teszt hamisan zöld lesz.

### 1. defektus — a feliratkozás a `queryKey` tömb objektumazonosságától függ

A
[useFirestoreRealtimeQuery](../../dashboard/src/hooks/queries/firestoreRealtime.ts)
effectjének dependency listája tartalmazza a `queryKey`-t
(`firestoreRealtime.ts:68`), és minden hívó renderenként új tömböt ad át:

```ts
queryKey: ['readings', deviceId ?? 'none', sessionId ?? 'all']   // useReadingsQuery.ts:65
queryKey: ['sessions', deviceId ?? 'none']                       // useSessionsQuery.ts:56
const queryKey = ['cuttings'] as const                           // useCuttingsQuery.ts:151
const queryKey = ['session-events', …] as const                  // useSessionEventsQuery.ts:69
```

Az `as const` csak a típust szűkíti, referenciát nem stabilizál. A `queryRef` és a
`mapSnapshot` ezzel szemben minden hívóhelyen helyesen memoizált
(`useMemo` / `useCallback`), tehát kizárólag a `queryKey` a hibás dependency.

Az újrafeliratkozási ciklus:

1. az effect létrehoz egy `onSnapshot` listenert;
2. az első snapshot új tömbbé képezi az eredményt és `setQueryData`-val frissíti
   a React Query cache-t (`firestoreRealtime.ts:58`);
3. a cache-frissítés új renderhez vezet;
4. az új render új `queryKey` tömbreferenciát hoz létre;
5. az effect cleanup után ismét feliratkozik;
6. az új listener ismét teljes kezdeti snapshotot kér és minden dokumentumot
   újra kiszámláztat.

A hook ezen felül egy egyszeri `onSnapshot`-ot indít a `queryFn`-ben
(`firestoreRealtime.ts:29-47`) és egy állandó listenert az effectben, így az első
betöltés normál működés mellett is duplán kérdezhet.

### 2. defektus — a `mapReadings` kimenete nem determinisztikus

A 3. lépés (cache-frissítés → új render) **nem magától értetődő**, mert a React
Query structural sharingje kiszűri az azonos adatot:

- `query-core/query.js:60` — `setData()` a `replaceData(this.state.data, newData, this.options)`-on megy át;
- `query-core/utils.js:181` — `replaceData` `structuralSharing !== false` esetén `replaceEqualDeep`-et alkalmaz;
- a [queryClient.ts](../../dashboard/src/lib/queryClient.ts) nem kapcsolja ki a `structuralSharing`-et, tehát az alapértelmezett `true` él;
- `query-core/queryObserver.js:388-398` — a v5 a `#trackedProps` alapján értesít, a hook pedig csak a `data`, `isLoading`, `isFetching` és `error` propokat olvassa, a `dataUpdatedAt`-ot nem.

Vagyis ha a `mapSnapshot` deep-equal adatot ad vissza, a `replaceEqualDeep`
megtartja az előző referenciát, egyetlen trackelt prop sem változik, és **nincs
újrarender** — a ciklus nem indul be.

Ami ténylegesen beindította, az a
[useReadingsQuery.ts:56](../../dashboard/src/hooks/queries/useReadingsQuery.ts):

```ts
recordedAt: serverRecordedAt ?? data.recordedAt ?? new Date().toISOString(),
```

Ez minden lefutáskor **más** értéket ad annak a dokumentumnak, amelyből hiányzik
a `createdAt` és a `recordedAt` is. Ezzel a leképezés kimenete soha nem deep-equal,
a structural sharing hatástalan, és garantált az újrarender minden snapshotnál.

Ez az egyetlen nem determinisztikus mapper a négy közül: a `mapSessions` tiszta
mezőátvétel, a `mapEvents` és a `mapCuttings` pedig determinisztikus `new Date(0)`
fallbacket használ. A többi `new Date()` előfordulás mutációban van
(`useSessionsQuery.ts:72,87`, `useSessionEventsQuery.ts:86,118`,
`useCuttingsQuery.ts:163,188`), az ott helyes — azok írási időbélyegek.

## Reprodukció

Hooktesztben, mockolt Firestore `onSnapshot` mellett:

1. rendereljünk egy olyan hívót, amely **inline `queryKey` tömböt** ad át
   (1. defektus);
2. a `mapSnapshot` **minden hívásnál nem deep-equal** eredményt adjon vissza
   (2. defektus) — például úgy, hogy a mapper egy `new Date().toISOString()`
   fallbacket tartalmaz, vagy egy számlálót ír a kimenetbe;
3. az `onSnapshot` callback kapjon nem üres snapshotot;
4. várjuk meg a React Query cache-frissítés utáni új renderelést;
5. a jelenlegi implementáció újabb listenert hoz létre anélkül, hogy a logikai
   Firestore query megváltozott volna — az `onSnapshot` mock hívásszáma
   korlátlanul nő.

A 2. lépés elhagyása a leggyakoribb hibalehetőség: stabil adattal a
javítás **előtti** kód is zöld lesz, mert a structural sharing elnyeli a
frissítést, és a teszt semmit nem bizonyít.

Productionban a hiba a `firestore.googleapis.com/document/read_ops_count`
metrikán látszott (`type` label szerinti bontásban `QUERY`). Perc-felbontásban
éles be/ki mintát adott: ~17 500 olvasás/perc egyenletes plató, amíg a kliens
látható volt, és pontosan 0, amikor nem.

## Megoldási irány

Nem előírás, csak támpont:

- **A kulcs stabilizálása referencia helyett érték szerint.** A
  `@tanstack/react-query` publikusan exportálja a `hashKey`-t
  (`hashKey(queryKey)` → determinisztikus, kulcsrendezett JSON string), így az
  effect a hashtől függhet a tömb helyett. A snapshot handlerben maradhat a
  `setQueryData(queryKey, …)`: a closure által fogott tömb strukturálisan azonos
  kulcs, tehát ugyanarra a cache-bejegyzésre mutat.
- **A `mapSnapshot` kivétele a dependency listából.** Jelenleg minden hívó
  memoizálja, de erre a hooknak nem szabad támaszkodnia — érdemes ref-ben
  tartani a legfrissebb callbacket, és a dependency listából elhagyni. Ugyanez
  áll az `onErrorMessage`-re.
- **A `queryFn`-es egyszeri `onSnapshot` megszüntetése.** A loading állapot
  levezethető abból, hogy megjött-e az effect első snapshotja, így nem kell
  párhuzamos, egyszeri feliratkozás.
- Ha az `eslint react-hooks/exhaustive-deps` bepanaszolja a hashelt dependencyt,
  indoklással ellátott, egy sorra szűkített kivétel elfogadható.
- A `mapReadings` fallbackje legyen determinisztikus (a többi mapperrel
  konzisztens `new Date(0)`, vagy inkább `null` és a hívó döntsön), hogy a
  structural sharing valóban tudjon dolgozni.

## Scope

- a közös realtime query hook egy logikai Firestore queryhez pontosan egy aktív
  listenert tartson fenn;
- a feliratkozás ne függjön a `queryKey` tömb objektumazonosságától;
- a hook ne támaszkodjon arra, hogy a hívók memoizálják a `mapSnapshot`-ot;
- szűnjön meg az első betöltéshez használt párhuzamos, egyszeri
  `onSnapshot`-feliratkozás;
- a `mapReadings` nem determinisztikus időbélyeg-fallbackje szűnjön meg, és
  minden mapper legyen determinisztikus (a mutációk `new Date()` hívásai
  maradnak);
- a React Query cache, loading- és hibaállapot megmaradjon;
- az összes `useFirestoreRealtimeQuery` hívóhelyet ellenőrizni kell;
- készüljön regressziós hookteszt az azonos logikai kulccsal történő
  újrarenderelésre és a cleanupra.

## Elfogadási kritériumok

- [ ] Az első render egyetlen Firestore listenert hoz létre.
- [ ] Az első és a későbbi snapshotok által okozott renderelések nem indítanak
      új feliratkozást, ha a logikai query nem változott.
- [ ] Az újrafeliratkozás akkor sem indul be, ha a `mapSnapshot` minden hívásnál
      nem deep-equal eredményt ad vissza.
- [ ] A hook akkor is egy listenert tart fenn, ha a hívó nem memoizálja a
      `mapSnapshot`-ot.
- [ ] Valódi queryváltáskor a régi listener pontosan egyszer leiratkozik, és az
      új queryhez pontosan egy listener indul.
- [ ] Unmountkor az aktív listener pontosan egyszer leiratkozik.
- [ ] Nincs külön egyszeri és állandó `onSnapshot` ugyanahhoz az első
      betöltéshez.
- [ ] Egyetlen `mapSnapshot` implementáció sem ad vissza hívásfüggő értéket:
      `grep -n "new Date()" dashboard/src/hooks/queries/` csak mutációkban ad
      találatot.
- [ ] A readings, sessions, session events és cuttings nézetek továbbra is
      realtime frissülnek.
- [ ] A regressziós teszt a javítás előtti implementációval reprodukálja a
      többszörös feliratkozást, a javítás után pedig zöld.
- [ ] `npm test`, `npm run lint` és `npm run build` zöld.
- [ ] Nyitott dashboard mellett a Firestore `document/read_ops_count` nem mutat
      folyamatos, adatváltozás nélküli olvasási hullámot. Ellenőrzés: a
      dashboardot legalább 10 percre hagyjuk láthatóan nyitva írási forgalom
      nélkül, és a metrika perc-felbontásban maradjon a dokumentumszám
      nagyságrendjében, ne ezres/perc platón.

## Érintett terület

- `dashboard/src/hooks/queries/firestoreRealtime.ts`
- `dashboard/src/hooks/queries/useReadingsQuery.ts`
- `dashboard/src/hooks/queries/useSessionsQuery.ts`
- `dashboard/src/hooks/queries/useSessionEventsQuery.ts`
- `dashboard/src/hooks/queries/useCuttingsQuery.ts`
- `dashboard/src/lib/queryClient.ts` (csak kontextus: itt látszik, hogy a
  `structuralSharing` alapértelmezetten aktív)
- a közös hook új regressziós tesztje

## Comments

- 2026-08-03: A production Monitoring adatai alapján augusztus 1–3. között
  13 690 978 dokumentumolvasás történt: 13 690 964 `QUERY` és 14 `LOOKUP`.
  Ugyanezen időszakban 25 írás és 0 törlés volt. Az olvasási hullám a dashboard
  bezárása után megszűnt.
- 2026-08-03: A defektus eredete a `34baf8a` commit (2026-04-17,
  `refactor: migrate forms to react-hook-form and zod for validation`), amely a
  `tasks/dashboard-refactor/task-list.md` „Firestore query hookök létrehozása
  `hooks/queries/` mappában" pontját zárta le. A hibás dependency lista és a
  snapshot handlerben lévő `setQueryData` már ebben a commitban a mai formájában
  bekerült. A `queries/` könyvtár utolsó módosítása `dc1d001` (2026-05-11), tehát
  a kód 3,5 hónapig lappangott, és nem a tőkekövetés (issue 01–13) hozta be.
- 2026-08-03: Napi olvasásszámok a lappangás alatt: jún. 24. – aug. 1. között
  50 és 24 853 között, aug. 1-jén 13 124. Aug. 2-án 347 689, aug. 3-án
  13 329 882. A kód nem változott, a használat változott: a fejlesztés alatt
  folyamatosan nyitva volt egy Vite dev szerver (29 óra uptime) a **production**
  Firestore ellen.
- 2026-08-03: A hot module reload **nem** felelős, kizárva. Perc-felbontásban a
  ráta ~17 500/perc egyenletes plató 20–50 perces szakaszokon, ±10% szórással;
  közben egy 28 perces teljes nulla ablak pontosan arra az időszakra esett,
  amikor a fájlmentések és a commit történtek; a záró plató alatt pedig egyetlen
  fájl sem módosult. A HMR ehelyett mentésekhez kötött tüskéket adna.
- 2026-08-03: A kliens nem látható böngészőfül volt, hanem egy VS Code webview
  (a `127.0.0.1:5173` kapcsolatot a VS Code NetworkService processze tartotta).
  Ez magyarázza a be/ki mintát: a VS Code felfüggeszti a nem aktív tab
  webview-ját, ezért esett nullára kódra váltáskor és indult újra visszaváltáskor.
  Az ellenőrzésnél erre figyelni kell — a „bezárás" helyett a láthatóság a
  meghatározó.
