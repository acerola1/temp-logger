# Szőlőtőke-követés: megvalósítási térkép

Források:

- [Termékspecifikáció](./spec.md)
- [Codebase design](./codebase-design.md)

## Issue-k

| ID | Feladat | Függőség |
| --- | --- | --- |
| [02](../issues/02-toke-domainmodell-url-allapot-es-urlap-lekepezes.md) | Domainmodell, form-leképezés és listaállapot | – |
| [03](../issues/03-toke-katalogus-es-firestore-alapmuveletek.md) | Catalog és Firestore-alapműveletek | 02 |
| [04](../issues/04-tokeesemenyek-es-fotok-adattarolasa.md) | Esemény- és fotó-adattárolás | 03 |
| [05](../issues/05-tokelista-navigacio-kereses-szures.md) | Lista, navigáció, keresés és szűrés | 02, 03 |
| [06](../issues/06-toke-adatlap-letrehozas-es-szerkesztes.md) | Adatlap, létrehozás és szerkesztés | 03, 05 |
| [07](../issues/07-toke-esemenynaplo-es-tomeges-esemeny-urlap.md) | Eseménynapló és többtőkés eseményűrlap | 04, 06 |
| [08](../issues/08-toke-jogosultsagi-szabalyok-e2e-es-prototipus-takaritas.md) | Jogosultságok, teljes E2E és prototípus-takarítás | 03–07 |

## Végrehajtási sorrend

```text
02 → 03 ┬→ 04 ─────┐
        └→ 05 → 06 ┴→ 07 → 08
```

A `04` és `05` issue a `03` lezárása után párhuzamosan végezhető. Minden UI-t
érintő issue külön rögzíti, hogy a megjelenés és az interakciók vizuális referenciája
az elkészült prototípus.
