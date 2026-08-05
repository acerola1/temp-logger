# Önálló tőkefotók: megvalósítási térkép

Források:

- [Koncepció és specifikáció](./spec.md)
- [ADR: A tőkefotók a tőkéhez tartoznak](../../docs/adr/0001-tokefotok-a-tokehez-tartoznak.md)

## Issue-k

| ID | Feladat | Függőség | Status |
| --- | --- | --- | --- |
| [19](../issues/19-kozos-fotogaleria-es-dugvany-kepszerkesztes.md) | Közös fotógaléria és dugvány-képaláírás szerkesztés | – | ready-for-agent |
| [20](../issues/20-tokefoto-migracios-script.md) | Tőkeeseményfotók migrálása önálló tőkefotókká | – | ready-for-agent |
| [21](../issues/21-onallo-tokefoto-modell-es-galeria-cutover.md) | Önálló tőkefotó-modell és galéria cutover | 19, 20 | ready-for-agent |

## Végrehajtási sorrend

```text
19 ─┐
    ├→ 21
20 ─┘
```

A `19` és `20` egymástól függetlenül elvégezhető. A `19` úgy emeli ki a közös
galériát, hogy a tőke adattárolása még nem változik; a `20` pedig elkészíti és
emulátorban ellenőrzi a migrációt anélkül, hogy éles adaton futna. A `21` csak
mindkettő után végzi el az atomi alkalmazás-cutover-t.
