# Tőke-eseménynapló és többtőkés eseményűrlap

Feature: vine-tracking
Type: feature
Status: ready-for-agent
Blocked by: 04, 06

## Cél

Az adatlapon legyen publikus esemény-idővonal, admin eseményrögzítés, szerkesztés és
törlés a catalog eseményparancsaira kötve.

## Megjelenési referencia

Ez UI-issue: az idővonal, az eseménykártyák, az űrlapok, a célpontválasztó és a
fotómegjelenítés a worktree-ben elkészült UI-prototípust kövesse desktopon és
mobilon. Az aktuális látható állapotot minden vizuális módosítás előtt reprodukálni
kell.

## Scope

- időrendbe rendezett eseménynapló és fotók
- új esemény egy vagy több tőkére
- eseményszerkesztés és megerősített törlés
- aktív céltőkék kiválasztása, a megnyitott tőke kontextusának megtartásával
- feltöltési progress, pending és hibaállapotok

## Elfogadási kritériumok

- [x] Megfigyelés, metszés, permetezés és megszűnés esemény rögzíthető dátummal és
      idővel, opcionális címmel, jegyzettel és több fotóval.
- [x] Üres cím esetén az eseménytípus magyar neve jelenik meg címként.
- [x] Ugyanaz az esemény több kiválasztott tőkére menthető, majd az egyes példányok
      egymástól függetlenül szerkeszthetők és törölhetők.
- [x] A célpontlista és a **Mind** művelet nem küld eseményt nem aktív tőkére a
      megnyitott tőke dokumentált kivételén kívül; a számláló konzisztens.
- [x] 400-nál több célpont esetén a felület feltöltés előtt érthető hibát mutat.
- [x] A feltöltési progress látható, pending állapotban nincs duplikált beküldés,
      hiba esetén az űrlap javítható marad.
- [x] Eseménytörlés megerősítést kér, és siker után a fotók sem jelennek meg.
- [x] `ceased` esemény után a tőke megszűntként látszik; az esemény törlése nem
      aktiválja automatikusan.
- [x] Nem admin felhasználó az eseményeket és fotókat látja, de módosító vezérlőt
      nem kap.
- [x] Az idővonal és az összes űrlapállapot desktop/mobil DOM-ellenőrzése és
      screenshotja igazolja a prototípussal való vizuális egyezést.

## Érintett terület

- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`

## Comments

- 2026-08-02: Elkészült a publikus esemény-idővonal, a fotónézet, valamint az admin
  többtőkés eseményrögzítő, szerkesztő és megerősített törlő folyamat.
- 2026-08-02: A megnyitott megszűnt tőke dokumentált kivételét a catalog validáció
  és integrációs teszt is lefedi; a többi célpont továbbra is csak aktív lehet.
- 2026-08-02: A review során az edit űrlap prototípus-eltérését, a hiányzó
  pending/progress/hiba/edit vizuális állapotokat és az elavult nyers Firebase-hiba
  átvitelét javítottuk.
- 2026-08-02: Ellenőrzés: unit tesztek (27/27), lint, production build, integrációs
  tesztek (12/12) és teljes Playwright E2E (16/16). A desktop és mobil eseménynapló-
  és űrlapsnapshotok vizuálisan ellenőrizve.
