# Issue tracker: Local Markdown

A repó feladatai és specifikációi lokális Markdown fájlokként élnek a `tasks/` könyvtárban.

## Elrendezés

- Specifikációk: `tasks/<feature-slug>/spec.md`
- Issue-k: `tasks/issues/<NN>-<slug>.md`
- Az issue-k két számjegyű sorszámot kapnak, `01`-től kezdve.
- A feature neve az issue elején lévő `Feature:` mezőben szerepel.
- A triage állapotot az issue elején lévő `Status:` mező tartalmazza.
- A hozzászólások az issue végén, a `## Comments` szakaszba kerülnek.

## Amikor egy skill publikál az issue trackerbe

Hozzon létre egy új Markdown fájlt a `tasks/issues/` könyvtárban.

## Amikor egy skill lekéri a kapcsolódó ticketet

Olvassa be a megadott fájlt a `tasks/issues/` könyvtárból.

## Wayfinding

- Térkép: `tasks/<effort>/map.md`
- Gyermekfeladat: `tasks/issues/<NN>-<slug>.md`
- A feladat típusa a `Type:` mezőben szerepel.
- A foglalási állapot a `Status:` mezőben szerepel.
- A függőségeket a `Blocked by: NN, NN` mező tartalmazza.
- Egy feladat akkor végezhető, ha nyitott, nincs lefoglalva, és minden blokkoló feladata lezárult.
