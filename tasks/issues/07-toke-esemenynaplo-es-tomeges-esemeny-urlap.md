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

- [ ] Megfigyelés, metszés, permetezés és megszűnés esemény rögzíthető dátummal és
      idővel, opcionális címmel, jegyzettel és több fotóval.
- [ ] Üres cím esetén az eseménytípus magyar neve jelenik meg címként.
- [ ] Ugyanaz az esemény több kiválasztott tőkére menthető, majd az egyes példányok
      egymástól függetlenül szerkeszthetők és törölhetők.
- [ ] A célpontlista és a **Mind** művelet nem küld eseményt nem aktív tőkére a
      megnyitott tőke dokumentált kivételén kívül; a számláló konzisztens.
- [ ] 400-nál több célpont esetén a felület feltöltés előtt érthető hibát mutat.
- [ ] A feltöltési progress látható, pending állapotban nincs duplikált beküldés,
      hiba esetén az űrlap javítható marad.
- [ ] Eseménytörlés megerősítést kér, és siker után a fotók sem jelennek meg.
- [ ] `ceased` esemény után a tőke megszűntként látszik; az esemény törlése nem
      aktiválja automatikusan.
- [ ] Nem admin felhasználó az eseményeket és fotókat látja, de módosító vezérlőt
      nem kap.
- [ ] Az idővonal és az összes űrlapállapot desktop/mobil DOM-ellenőrzése és
      screenshotja igazolja a prototípussal való vizuális egyezést.

## Érintett terület

- `dashboard/src/features/vines/ui/VineDetail.tsx`
- `dashboard/src/features/vines/ui/VineEventForm.tsx`
- `dashboard/src/features/vines/ui/VinesPage.tsx`

## Comments

