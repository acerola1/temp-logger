# Tőkeválasztó dialógus újrahasznált listázással

Feature: vine-tracking
Type: enhancement
Status: done
Blocked by: –

## Cél

A többtőkés eseményrögzítés célválasztója ne inline checkbox-lista legyen az
űrlapon, hanem egy gombbal felhozott dialógus. Így az űrlap alapból rövidebb,
a választó felület viszont a tőkelista teljes szűrés- és rendezéskészletét
megkaphatja — ötven tőkénél a mostani „görgess és keress szemmel" nem működik.

## Kiindulás

Az `add` módú eseményűrlap ma egy `max-h-48` magas, szűrhetetlen és
rendezhetetlen checkbox-listát tartalmaz, `Mind` és `Törlés` gombbal
([VineEventForm.tsx:188-215](../../dashboard/src/features/vines/ui/VineEventForm.tsx#L188-L215)).
A lista sorrendje a `vines` tömb sorrendje, a soron csak `#sorszám - fajta` és
egy állapotjelvény látszik. A hívó előszűri a jelölteket aktív + épp nyitott
tőkére ([VineDetail.tsx:167-170](../../dashboard/src/features/vines/ui/VineDetail.tsx#L167-L170)).

A tőkelista ezzel szemben már ma három rétegre esik szét, csak nincs kimondva:

- a szűrés/rendezés **tiszta logikája** a `VineListState` +
  `selectVisibleVines` párban él, egységteszttel fedve
  ([listState.ts:107-143](../../dashboard/src/features/vines/listState.ts#L107-L143)) —
  ez már most újrahasználható, nem kell hozzányúlni;
- a **szűrőpanel UI** beégetve a lapba
  ([VinesPage.tsx:272-327](../../dashboard/src/features/vines/ui/VinesPage.tsx#L272-L327));
- a **kártya** a `VinesList`-ben, ami egyben a navigációt is végzi: a
  `<button aria-pressed>` a kártya külső eleme
  ([VinesList.tsx:73-131](../../dashboard/src/features/vines/ui/VinesList.tsx#L73-L131)).

A kártya *tartalma* (borítóbélyeg, `#sorszám`, fajta, állapot- és
gyökérzetjelvény, címkék) pont az, amit a választóban is látni akarunk; a külső
elem és az interakció az, ami nem.

## Triage döntések

- **A `VinesList` nem kap `mode: 'navigate' | 'select'` propot.** A két kontextus
  interakciója érdemben más: egyes vs. többes választás, `aria-pressed` vs.
  checkbox, és a „Mind" is mást jelent. Egy mode-prop mindkét ágat
  olvashatatlanabbá tenné, mint két külön, rövid komponens. Amit meg kell
  osztani, az a kártya belseje és a szűrőpanel — nem a lista váza.
- **A dialógus szűrői mindig `DEFAULT_VINE_LIST_STATE`-ből indulnak**, nem a lap
  aktuális szűrőiből. A választó így kiszámítható: ugyanaz a gomb mindig
  ugyanazt a kezdőállapotot hozza fel, függetlenül attól, mire volt szűrve a
  háttérben lévő lista. A dialógus szűrőállapota **nem** ír vissza sem a
  `VinesPage` state-jébe, sem az URL-be.
- **A dialógus draft állapoton dolgozik, és csak a `Kész`-re commitál.** Belépéskor
  lemásolja a mostani kijelölést, a `Mégse` ingyen visszaáll. Élő mutálás
  helyett ez teszi biztonságossá a „nézzük meg, mit is választanék" böngészést.
- **A „Mind" az épp szűrt halmazt jelöli ki, nem az összes létező tőkét**, és a
  meglévő kijelölést nem törli, hanem uniózza vele. A `Törlés` marad teljes
  ürítés. Enélkül a szűrés nem ér semmit: a szűrés utáni „Mind" az egyetlen ok,
  amiért a listázást ide hozzuk.
- **A jelöltek előszűrése megszűnik**, a dialógus a teljes `vines` listát kapja,
  és a szűrés a `listState.status`-ra bízódik (defaultja `'active'`, tehát a
  mai viselkedés marad az alapeset). Cserébe *lehet is* megszűnt tőkét
  választani, ha kell — ma ez nem megy, pedig a `ceased` esemény
  visszaállítása után értelmes igény.
- **A nyitott tőke továbbra is előre ki van jelölve**, és a gyakori
  egytőkés eset dialógus nyitása nélkül elvégezhető: az űrlapon a `Mentés (1)`
  azonnal kattintható. A dialógus tisztán opcionális kiegészítés.
- **A `targetVineIds` a `VineEventForm`-ban marad**, a dialógus
  `createPortal(document.body)`-val jelenik meg. Az űrlap maga egy `<form>`; a
  DOM-ban belülre rendelt overlay érvénytelen beágyazott formot és véletlen
  submitot adna. Portállal a submit-idői `getVineEventTargetError` validáció is
  a helyén marad.
- **A limitet a dialógus is ismeri.** A `MAX_VINE_EVENT_TARGETS` (400,
  [model.ts:130](../../dashboard/src/features/vines/model.ts#L130)) túllépése ma
  csak beküldéskor derül ki; a `Mind` után ez a legkönnyebben elérhető hiba,
  ezért a dialógus a `Kész`-t tiltja és a helyszínen üzen.
- **A `Dialog` burkoló kiemelve, de minimálisan.** Overlay, `Esc`, body
  scroll-lock — a `PhotoLightbox` ma kézzel csinálja ugyanezt
  ([PhotoLightbox.tsx:199-231](../../dashboard/src/features/photos/ui/PhotoLightbox.tsx#L199-L231)),
  most lesz a második hívó. A `PhotoLightbox` átállítása viszont **nem** része
  ennek az issue-nak: ott a gesztuskezelés és a burkoló összefonódik, azt
  külön kell szétszedni.
- **A dugványoldal nem változik.** A `cutting-event-targets` folyamat
  ([cutting-event-targets.spec.ts:75](../../dashboard/e2e/cutting-event-targets.spec.ts#L75))
  marad inline listán; ha a megoldás beválik, külön issue követheti.

## Scope

- új közös `Dialog` komponens (`components/Dialog.tsx`): `role="dialog"`,
  `aria-modal`, `aria-label`, overlay-kattintás és `Esc` zárás, body
  scroll-lock, portál `document.body`-ba
- `VineListFilters.tsx` kiemelése a `VinesPage`-ből egy az egyben (keresés,
  rendezés, állapot, gyökérzet, termés, címke); propok: `state`,
  `tagSuggestions`, `onPatch`, `onReset`, `resetVisible`. A `VinesPage`
  ugyanezt használja tovább, a szűrőpanel megjelenése nem változik
- `VineCard.tsx` kiemelése a `VinesList`-ből: a kártya belseje (borítóbélyeg
  `photoThumbnailUrl`-lel és `loading="lazy"`-vel, `#sorszám`, fajta,
  állapot- és gyökérzetjelvény, címkék). A `VinesList` ezután `<button>` +
  `VineCard`, változatlan kimenettel
- új `VineTargetPickerDialog.tsx`: `Dialog` + `VineListFilters` +
  `selectVisibleVines` + `<label><input type="checkbox">` + `VineCard` sorok.
  Saját `useState<VineListState>` `DEFAULT_VINE_LIST_STATE`-ből, saját draft
  kijelölés, `Kész` / `Mégse`
- a dialógus fejlécében `N kiválasztva` számláló, `Mind` (a szűrt halmazra) és
  `Törlés` gomb, valamint egy „csak a kiválasztottak" pipa a szelekció
  átnézéséhez
- a limit felett a `Kész` tiltva, a `getVineEventTargetError` üzenetével
- `VineEventForm`: az inline checkbox-blokk helyére összefoglaló sor + a
  dialógust nyitó gomb. A `targetVineIds` és a submit-idői validáció marad
- `VineDetail`: az `eventTargetVines` előszűrés törlése, a teljes `vines` és a
  `tagSuggestions` átadása az űrlapnak
- `VinesList` üres/betöltő/hiba állapotai maradnak a `VinesList`-ben; a
  dialógusnak elég a „nincs találat a megadott szűrőkkel" eset, mert a tőkék
  már be vannak töltve, amikor az űrlap megnyitható
- az E2E-ben a többtőkés folyamat átírása: a `#1 - Kékfrankos` checkbox már nem
  az űrlapon, hanem a dialógusban van
  ([zz-vine-mutation.spec.ts:118-135](../../dashboard/e2e/zz-vine-mutation.spec.ts#L118-L135))

## Elfogadási kritériumok

- [x] Az `add` módú eseményűrlapon nincs inline tőkelista; a helyén egy
      összefoglaló sor (`N tőke kiválasztva`) és egy `Kiválasztás…` gomb van.
- [x] A nyitott tőke előre ki van jelölve, és a dialógus megnyitása nélkül
      mentődik: az űrlap `Esemény mentése (1)` gombja azonnal működik.
- [x] A gomb egy `role="dialog"` `aria-modal="true"` dialógust nyit, ami `Esc`-re
      és az overlay-re kattintva is zárul.
- [x] A dialógus nyitva tartása alatt a háttéroldal nem görgethető, zárás után
      a görgetés visszaáll.
- [x] A dialógus szűrői a lap szűrőitől függetlenül `DEFAULT_VINE_LIST_STATE`-ből
      indulnak: a sidebaron beállított szűrés/keresés nem szivárog be.
- [x] A dialógusban végzett szűrés nem írja át a lap szűrőit és nem módosítja
      az URL query stringjét.
- [x] A dialógusban a keresés, a rendezés, az állapot-, gyökérzet-, termés- és
      címkeszűrő ugyanúgy működik, mint a lapon, és ugyanazt a találati
      sorrendet adja.
- [x] A `Mind` csak az épp szűrt tőkéket jelöli ki, a szűrésen kívüli meglévő
      kijelölést nem dobja el.
- [x] A `Törlés` a teljes kijelölést üríti, a szűrőket nem állítja vissza.
- [x] A „csak a kiválasztottak" pipa a kijelölt tőkéket mutatja a szűrőktől
      függetlenül, és kikapcsolva visszaáll a szűrt lista.
- [x] A `Mégse` a dialógus megnyitása előtti kijelölést állítja vissza, az
      űrlap összefoglaló sora sem változik.
- [x] A `Kész` után az űrlap összefoglalója és az `Esemény mentése (N)` gomb
      számláló a dialógusban választott darabszámot mutatja.
- [x] `MAX_VINE_EVENT_TARGETS`-nél több kijelölés esetén a `Kész` tiltott, és a
      dialógus a `getVineEventTargetError` üzenetét mutatja.
- [x] A dialógus sorai borítóbélyeget mutatnak, nem az 1280 px-es képet, és a
      képernyőn kívüli sorok képe csak görgetésre töltődik le.
- [x] Megszűnt tőke is választható célnak, ha a dialógus állapotszűrője
      `Megszűnt` vagy `Mind`.
- [x] Szűrésre üres találat esetén a dialógus a „nincs találat" üzenetet mutatja,
      nem üres felületet.
- [x] A tőkelista lapja vizuálisan és viselkedésben változatlan: a szűrőpanel és
      a kártyák kimenete a kiemelés után is ugyanaz.
- [x] A `VineEventForm` `edit` módja változatlan: nincs célválasztó gomb, nincs
      dialógus.
- [x] A dugványoldal eseménycél-választója változatlanul inline lista.
- [x] Egységteszt fedi a `VineTargetPickerDialog`-ot: szűrt `Mind`, `Törlés`,
      `Mégse` visszaállítás, limit feletti tiltás, „csak a kiválasztottak".
- [x] Egységteszt fedi, hogy a `VineEventForm` a dialógusból visszaadott
      kijelölést küldi be, és hogy a nyitott tőke előre ki van jelölve.
- [x] `npm test`, `npm run test:integration`, `npm run lint`, `npm run build`
      zöld.
- [x] Playwright E2E zöld; a tőkelista képernyőképei érdemben változatlanok, és
      az eseményűrlap képernyőképe a rövidebb formát mutatja.

## Érintett terület

- `dashboard/src/components/Dialog.tsx`
- `dashboard/src/features/vines/ui/VineListFilters.tsx`
- `dashboard/src/features/vines/ui/VineCard.tsx`
- `dashboard/src/features/vines/ui/VineTargetPickerDialog.tsx`
- `dashboard/src/features/vines/ui/VineTargetPickerDialog.test.tsx`
- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/vines/ui/VineEventForm.test.tsx`
- `dashboard/src/features/vines/ui/VinesList.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`
- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/e2e/zz-vine-mutation.spec.ts`

## Comments

- 2026-08-04: A `listState.ts` szándékosan nincs az érintett területek között.
  A `VineListState` és a `selectVisibleVines` már ma is tiszta, hívófüggetlen és
  tesztelt — a dialógus ugyanazt a függvényt hívja ugyanarra az állapotalakra.
  Ez az issue lényege: a listázás legértékesebb rétege már újrahasználható,
  csak a fölötte lévő UI volt beégetve egyetlen hívóba.
- 2026-08-04: Megvalósítva. Három ponton pontosítottunk a terven:
  - A `VineListFilters` a felsorolt propokon túl egy `summary` propot is kapott.
    A lapon a találatszám és az `Alaphelyzet` gomb egy sorban él a panel alatt;
    e sor nélkül a szűrőpanel megjelenése megváltozott volna. A dialógus
    ugyanezt a sort a saját `N találat` szövegével használja.
  - A `Kész` nem csak a limit felett, hanem nulla kijelölésnél is tiltott — a
    `getVineEventTargetError` mindkét esetre üzenetet ad, és az üres kijelölés
    commitálásának nincs értelme: a `Mégse` a régi kijelölést hozza vissza.
  - Az összefoglaló sor a darabszám mellett a kiválasztott sorszámokat is
    mutatja (`#1, #2`, nyolc felett `+N`), különben a dialógus megnyitása nélkül
    nem látszódna, *mely* tőkék a célok.
  A `toke-esemeny-urlap-*` képernyőképek a rövidebb űrlapra frissültek, új
  `toke-celvalaszto-desktop` készült, a `vines-list` képernyőképei viszont
  bájtra változatlanok: a szűrőpanel és a kártya kiemelése nem mozdított semmit.
- 2026-08-04: A `Blocked by` üres, mert a `15` és a `17` (borítókép, bélyeg) már
  lezárult, és a `VineCard` kiemelése a `photoThumbnailUrl`-es, `loading="lazy"`
  mostani állapotot mozgatja át — nem hoz vissza nagyképes kártyát.
