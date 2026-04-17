# Dashboard refaktor

A dashboard kódbázis rendezése: duplikációk megszüntetése, nagy fájlok szétbontása, form kezelés egységesítése, hookök kiemelése.

**Instrukció:** ami elkészült, azt azonnal jelöld `- [x]` állapotra.

## QA — regresszió ellenőrzés minden feladat után

Minden fejezet elvégzése után az alábbi ellenőrzéseket kell lefuttatni. Ha bármelyik elbukik, a feladat nem tekinthető késznek.

### Alap ellenőrzések (minden feladat után kötelező)

```bash
# 1. TypeScript fordítás — 0 hiba
cd dashboard && npx tsc --noEmit

# 2. ESLint — nem nőhet a hibák száma (baseline: 7 error, 1 warning)
npx eslint . 2>&1 | tail -3

# 3. Build — sikeresen lefut
npm run build

# 4. Playwright e2e tesztek (emulátorral) — mind zöld
npm run test:e2e
```

### Feladat-specifikus ellenőrzések

Az egyes fejezetek QA blokkjában felsorolt extra ellenőrzések.

---

## 0. Playwright e2e tesztek — baseline rögzítés a refaktor előtt

A refaktor előtt fel kell írni a teszteket, hogy a meglévő működés rögzítve legyen.  
Alapelv: CI-ban **ne** a Firebase prod backend ellen teszteljünk, hanem Firebase emulátorral (Auth + Firestore + szükség esetén Functions). A prod adatbázis legfeljebb külön, manuális smoke ellenőrzésre maradjon.

- [x] Playwright telepítése és konfigurálása:
  - `npm install -D @playwright/test`
  - `npx playwright install chromium`
  - `playwright.config.ts` létrehozása: baseURL, webServer (dev szerver indítás)
- [x] Tesztek könyvtárstruktúra: `e2e/` mappa a dashboard gyökerében
- [x] `package.json` e2e scriptek: `test:e2e:seed`, `test:e2e:run`, `test:e2e`
- [x] Emulátoros e2e script-struktúra kialakítása (`../tasteroom` mintára):
  - `test:e2e:seed` — determinisztikus teszt adatok seedelése emulátorba
  - `test:e2e:run` — Playwright futtatás
  - `test:e2e` — `firebase emulators:exec` alatt seed + e2e futtatás
- [x] Külön CI env változók definiálása (pl. `VITE_USE_EMULATORS=true`, emulátor portok, test project id)

### 0/A. GitHub CI bekötés (dashboard e2e)

- [x] `.github/workflows/ci.yml` létrehozása/frissítése:
  - checkout + Node.js 22 setup
  - Java setup (Firestore emulator miatt)
  - `npm ci` a dashboardban (és ahol kell, functions-ben is)
  - `npx playwright install --with-deps chromium`
  - `npm run test:e2e` (emulátoros módban)
  - `npm run build`
- [x] CI trigger: `pull_request` + `push` a fő branch(ek)re
- [x] Playwright report/artifact mentés hiba esetén
- [x] README-ben rövid CI + helyi e2e futtatási leírás

### Monitor oldal tesztek (`e2e/monitor.spec.ts`)

- [x] Oldal betölt, "Hőmérséklet" és "Páratartalom" chart cím megjelenik
- [x] Grafikonok renderelődnek (SVG `<path>` elemek jelen vannak a chart konténerekben)
- [x] Időszak választó gombok (`24h`, `7d`, `30d`) kattinthatók, grafikon frissül
- [x] Tooltip megjelenik hoverre (tooltip elem `visibility: visible` lesz)
- [x] Tooltip rögzül kattintásra (X gomb megjelenik)
- [x] Tooltip bezárul félrekattintásra (tooltip elem `visibility: hidden` lesz)
- [x] Esemény timeline sor megjelenik a chartokon

### Navigáció tesztek (`e2e/navigation.spec.ts`)

- [x] Monitor → Dugvány oldal navigáció működik
- [x] Dugvány → Monitor navigáció működik
- [x] URL direkt megnyitás működik mindkét oldalra (`/`, `/dugvanyok`)
- [x] Dugvány részletes nézet URL működik (`/dugvanyok/:id`)
- [x] Böngésző vissza gomb helyes navigáció

### Dugvány oldal tesztek (`e2e/cuttings.spec.ts`)

- [x] Dugvány lista betölt, legalább 1 kártya megjelenik
- [x] Kártya tartalmazza: sorszám, fajta, típus, státusz
- [x] Részletes nézet megnyílik kártyára kattintva
- [x] Részletes nézetben fotók megjelennek (ha vannak)
- [x] Részletes nézetben öntözési napló megjelenik (ha van)
- [x] Nem-admin: "Új dugvány" gomb nem látható
- [x] Nem-admin: szerkesztés/törlés gombok nem láthatók

### Admin CRUD tesztek (`e2e/admin.spec.ts`)

Ezek a tesztek Firebase auth-ot igényelnek — elsődlegesen emulatorral (test account csak külön, manuális smoke célra).

- [x] Auth setup: test admin user bejelentkeztetése a tesztek előtt
- [x] Új dugvány létrehozás: űrlap kitöltés → mentés → megjelenik a listában
- [x] Dugvány szerkesztés: mező módosítás → mentés → frissült érték látszik
- [x] Öntözési log hozzáadás → megjelenik az időrendben
- [x] Öntözési log szerkesztés → frissült érték látszik
- [x] Öntözési log törlés → eltűnik a listából
- [x] Fotó feltöltés → megjelenik a galériában
- [x] Fotó törlés → eltűnik a galériából
- [x] Session esemény létrehozás → megjelenik az eseménylistában
- [ ] Session esemény szerkesztés → frissült érték
- [x] Session esemény törlés → eltűnik
- [x] Létrehozott teszt adatok takarítása a teszt végén (afterAll)

### Reszponzív tesztek (`e2e/responsive.spec.ts`)

- [x] Mobil viewport (375x667): monitor oldal layout nem törik el
- [x] Mobil viewport: dugvány lista olvasható
- [x] Mobil viewport: dugvány részletes nézet görgethető
- [x] Tablet viewport (768x1024): layout helyes

---

## 1. Duplikált utility függvények kiemelése

Gyors nyerések, minimális kockázat.

- [x] `toDateTimeLocalValue()` kiemelése `lib/dateFormat.ts`-be
  - Jelenleg 3 helyen definiálva: `App.tsx:42`, `CuttingsPage.tsx:56`, `SessionEventsDialog.tsx:48`
  - Mindhárom helyen törölni a lokális definíciót és importálni
- [x] `getFileExtension()` kiemelése `lib/fileUtils.ts`-be
  - Jelenleg 2 helyen: `CuttingsPage.tsx:66`, `SessionEventsDialog.tsx:54`
- [x] `scaleX()` kiemelése `lib/chartTransform.ts`-be
  - Jelenleg 3 helyen: `SensorChart.tsx:54`, `AnimatedTimeAxis.tsx:27`, `EventTimelineRow.tsx:57`
  - Mindhárom komponensben importra cserélni

**QA:**
- [x] `grep -r "function toDateTimeLocalValue" src/` — pontosan 1 találat (a lib-ben)
- [x] `grep -r "function getFileExtension" src/` — pontosan 1 találat
- [x] `grep -r "function scaleX" src/` — pontosan 1 találat
- [x] A három utility importálva van minden korábbi használati helyen

## 2. Form kezelés egységesítése — react-hook-form + zod bevezetése

A jelenlegi állapot: 35+ szétszórt `useState` hívás formokhoz, kézi validáció, inkonzisztens hibakezelés. A `react-hook-form` + `zod` kombináció ezt rendezi.

- [x] Dependenciák telepítése: `react-hook-form`, `zod`, `@hookform/resolvers`
- [x] Zod sémák létrehozása `lib/schemas.ts`-ben:
  - `cuttingFormSchema` (variety, plantType, plantedAt, status, notes)
  - `wateringLogSchema` (wateredAt, notes)
  - `sessionEventSchema` (title, notes, occurredAt)
- [x] CuttingsPage — új dugvány űrlap átírása react-hook-form-ra
  - A ~8 useState (variety, plantType, plantedAt, status, notes, stb.) helyett `useForm()`
  - Zod validáció a kézi `if (!variety)` ellenőrzések helyett
- [x] CuttingsPage — szerkesztő űrlap átírása react-hook-form-ra
- [x] CuttingsPage — öntözési log űrlap átírása react-hook-form-ra
- [x] SessionEventsDialog — esemény létrehozás/szerkesztés űrlap átírása react-hook-form-ra
- [x] SessionManager — session létrehozás űrlap átírása react-hook-form-ra
- [x] Form típusok (`CreateFormState`, `EventFormState`) törlése — a zod sémák generálják a típusokat (`z.infer<>`)

**QA:**
- [ ] Minden űrlap validáció működik: üres mező nem menthető, hibaüzenet megjelenik
- [ ] Szerkesztésnél az űrlap a meglévő értékekkel töltődik fel
- [x] `grep -r "CreateFormState\|EventFormState" src/` — 0 találat (típusok törölve)
- [x] Form reset működik: mentés után az űrlap kiürül, bezárás után nem marad régi adat

## 3. Képfeltöltés logika közösítése — `usePhotoUpload` hook

Jelenleg a CuttingsPage és SessionEventsDialog külön-külön implementálja ugyanazt a Firebase Storage feltöltési logikát (resize + upload + URL lekérés + metaadat mentés).

- [ ] `hooks/usePhotoUpload.ts` hook létrehozása:
  - Input: fájl(ok), storage path prefix, max méret
  - Output: `upload()`, `uploading`, `error`, `progress`
  - Belső logika: kliens oldali resize, Storage feltöltés, downloadUrl lekérés
- [ ] CuttingsPage képfeltöltés átírása `usePhotoUpload` használatára
- [ ] SessionEventsDialog képfeltöltés átírása `usePhotoUpload` használatára
- [ ] Mobilos kamera/galéria picker logika közösítése (jelenleg mindkét helyen inline)

**QA:**
- [ ] Dugvány fotó feltöltés: kép megjelenik a galériában feltöltés után
- [ ] Esemény fotó feltöltés: kép megjelenik az eseménynél
- [ ] Mobilon: kamera és galéria picker külön-külön működik
- [ ] Nagy kép (~5MB+) feltöltés: átméretezés megtörténik, nem lassul be
- [ ] Feltöltés közbeni loading indikátor látható
- [ ] Hiba esetén (pl. hálózat) hibaüzenet jelenik meg

## 4. CuttingsPage szétbontása (~1793 sor → ~4-5 fájl)

Ez a legnagyobb és legkockázatosabb feladat, a form refaktor után érdemes csinálni.

- [ ] `CuttingsList.tsx` kiemelése — lista nézet (szűrés, rendezés, kártya megjelenítés)
- [ ] `CuttingDetail.tsx` kiemelése — részletes nézet (adatok, fotók, öntözési napló)
- [ ] `CuttingForm.tsx` kiemelése — létrehozás és szerkesztés űrlap (react-hook-form)
- [ ] `CuttingPhotoGallery.tsx` kiemelése — fotó galéria + feltöltés + törlés + nézegető
- [ ] `CuttingsPage.tsx` maradjon vékony orchestrátor: routing, állapot összekötés, hook-ok

**QA:**
- [ ] CuttingsPage.tsx 300 sor alatt van
- [ ] Minden kiemelt komponens önálló fájlban, importálva a CuttingsPage-ből
- [ ] URL navigáció működik: `/cuttings` → lista, `/cuttings/:id` → részletes nézet
- [ ] Böngésző vissza gomb helyesen navigál lista ↔ részletes nézet között
- [ ] Fotó nézegető (lightbox) nyitás/zárás/navigáció működik

## 5. SessionEventsDialog szétbontása (~604 sor → ~3 fájl)

- [ ] `SessionEventForm.tsx` kiemelése — esemény létrehozás/szerkesztés űrlap
- [ ] `SessionEventList.tsx` kiemelése — események listája szerkesztés/törlés gombokkal
- [ ] `SessionEventsDialog.tsx` maradjon a dialog keret + állapot orchestráció

**QA:**
- [ ] SessionEventsDialog.tsx 150 sor alatt van
- [ ] Dialog nyitás/zárás animáció működik
- [ ] Esemény lista renderelődik, szerkesztés/törlés gombok működnek
- [ ] Új esemény létrehozás a dialog-on belül működik

## 6. App.tsx rendezése (~550 sor)

- [ ] Monitor oldal logikájának kiemelése `MonitorPage.tsx`-be
  - A `readings`, `sessions`, `events`, `timeRange` állapot és a hozzá tartozó fetchek
  - A `TemperatureChart`, `HumidityChart`, `ReadingsTable` renderelés
- [ ] App.tsx maradjon: routing, auth, theme, layout

**QA:**
- [ ] App.tsx 150 sor alatt van
- [ ] Monitor oldal és Dugvány oldal közti navigáció működik
- [ ] Theme (dark/light) váltás működik mindkét oldalon
- [ ] Auth állapot (login/logout) helyes mindkét oldalon

## 7. Chart tooltip hook kiemelése

A SensorChart tooltip + spring-damper animáció logikája önálló hookként tisztább.

- [ ] `hooks/useChartTooltip.ts` létrehozása:
  - Kezeli: `pinnedPoint`, `hoveredPoint`, `activeTooltip`, `isPinned`
  - Tartalmazza: `extractPoint`, `handleMouseMove`, `handleMouseLeave`, `handleChartClick`
  - Tartalmazza: spring-damper animáció (targetX/Y, currentX/Y, velocity, rAF loop)
  - Tartalmazza: globális mousedown dismiss listener
- [ ] SensorChart egyszerűsítése a hook használatával

**QA:**
- [ ] SensorChart.tsx renderelési logika + hook import, 150 sor alatt
- [ ] Tooltip hover: sima követés, spring-damper fizikával
- [ ] Tooltip kattintás: rögzül, X gombbal és félrekattintással bezárható
- [ ] Tooltip "Új esemény" gomb működik pinned módban
- [ ] Hőmérséklet és páratartalom chart tooltip egyformán viselkedik

## 8. TanStack Query (react-query) bevezetése

A jelenlegi adatlekérés useEffect + useState kombókkal megy, kézi loading/error kezeléssel. A react-query egységes cache-t, deduplikációt és mutáció-kezelést ad.

- [x] Dependencia telepítése: `@tanstack/react-query`
- [x] `QueryClientProvider` beállítása az App gyökerében
- [x] Firestore query hookök létrehozása `hooks/queries/` mappában:
  - `useReadings(deviceId, timeRange)` — szenzor adatok lekérése
  - `useSessions()` — session-ök listázása
  - `useSessionEvents(sessionId)` — session események
  - `useCuttings()` — dugványok listázása (Firestore realtime listener queryFn-ként)
- [x] App.tsx adatlekérés átírása react-query hookökre
  - A kézi `useEffect` + `useState` (readings, sessions, events) kiváltása
  - Loading és error állapot a query-ből jön, nem kézi state
- [x] CuttingsPage adatlekérés átírása react-query hookökre
- [x] Mutációk (`useMutation`) bevezetése CRUD műveletekhez:
  - Dugvány létrehozás/szerkesztés/törlés
  - Öntözési log hozzáadás/szerkesztés/törlés
  - Esemény létrehozás/szerkesztés/törlés
  - Képfeltöltés/törlés
  - Beépített loading/error/success állapotok — a kézi `saving`, `eventSaving`, stb. useState-ek kiváltása
- [ ] Kézi `useAsyncAction` hook szükségességének felülvizsgálata — a `useMutation` nagyrészt kiváltja

**QA:**
- [ ] `grep -r "useState.*loading\|useState.*saving\|useState.*error" src/components/` — jelentősen kevesebb találat mint előtte
- [ ] Oldal újratöltés: adat gyorsan megjelenik (cache)
- [ ] Mutation után az érintett lista automatikusan frissül (invalidation)
- [ ] Loading állapot megjelenik adatlekérés közben
- [ ] Hálózati hiba: hibaüzenet jelenik meg, retry lehetséges
- [ ] React Query DevTools-ban láthatók a query-k (dev módban)

## 9. Hibakezelés egységesítése

- [ ] Egységes hibaállapot minta kialakítása:
  - Jelenleg: `formError`, `eventError`, `photoActionError`, `saveError` — mind különböző
  - Cél: a react-hook-form saját hibakezelése + react-query mutációk `error` mezője
  - A legtöbb kézi hibakezelés megszűnik a §2 + §8 bevezetésével

**QA:**
- [ ] `grep -r "setFormError\|setEventError\|setPhotoActionError\|setSaveError" src/` — 0 vagy minimális találat
- [ ] Minden CRUD művelet hibája látható a felhasználónak
- [ ] Hibák eltűnnek amikor a felhasználó újrapróbálja a műveletet

## 10. Típusok rendezése

- [ ] Form-specifikus típusok áthelyezése `types/forms.ts`-be (vagy zod sémákból generálás)
- [ ] Esemény típusok egységesítése: `CuttingEvent` vs `SessionEvent` — közös `BaseEvent` interface ha van átfedés
- [ ] Dátumkezelés típusainak dokumentálása (mikor ISO string, mikor Timestamp, mikor ms)

**QA:**
- [ ] `grep -r "interface.*Form" src/components/` — 0 találat (típusok kiemelve)
- [ ] Minden típus importálva van a `types/` mappából, nincs lokális duplikáció

---

## Javasolt sorrend

0. **Playwright tesztek** (§0) — ELSŐ LÉPÉS, baseline rögzítés a refaktor előtt
1. **Utility kiemelés** (§1) — gyors, kockázatmentes, bármikor
2. **react-hook-form + zod** (§2) — ez a legnagyobb hatású változás
3. **TanStack Query** (§8) — az adatlekérés és mutációk egységesítése, a hibakezelés (§9) nagy részét is megoldja
4. **usePhotoUpload** (§3) — a form + query refaktor után természetesen jön
5. **CuttingsPage szétbontás** (§4) — a form + upload hook után sokkal egyszerűbb
6. **SessionEventsDialog szétbontás** (§5) — hasonló minta mint §4
7. **App.tsx / MonitorPage** (§6) — független a többitől
8. **Chart tooltip hook** (§7) — független, alacsony prioritás
9. **Hibakezelés** (§9) — a §2 + §8 bevezetésével nagyrészt megoldódik
10. **Típusok** (§10) — a végén takarítás
