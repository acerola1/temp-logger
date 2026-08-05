# Szőlőkövetés

A dashboardban nyilvántartott szőlőtőkék, dugványok, a hozzájuk tartozó
megfigyelések és fényképes dokumentáció közös domainnyelve.

## Language

**Szőlőtőke**:
Egy helyre kiültetett, önállóan nyilvántartott szőlőnövény.
_Avoid_: Tőkeelem, kiültetett dugvány

**Dugvány**:
Cserepezett szőlődugvány vagy oltvány, amely a szőlőtőkétől önállóan követett
egyed.
_Avoid_: Fiatal tőke

**Tőkeesemény**:
Egy adott szőlőtőkét érintő, időponthoz kötött naplóbejegyzés. Tömeges
rögzítéskor is minden érintett tőke saját eseménypéldányt kap.
_Avoid_: Közös esemény

**Tőkefotó**:
Pontosan egy szőlőtőkéhez tartozó, az eseményektől független fényképes
dokumentum. A fotó és a tőkeesemény között nincs domainkapcsolat.
_Avoid_: Eseményfotó

**Borítókép**:
A szőlőtőke listában és adatlapon kiemelten megjelenő tőkefotó. Lehet kézzel
kijelölt vagy a fotók sorrendjéből automatikusan választott.
_Avoid_: Esemény borítóképe, elsődleges eseményfotó

**Tömeges eseményrögzítés**:
Adatbeviteli művelet, amely azonos tartalmú, de később egymástól független
tőkeesemény-példányokat hoz létre több szőlőtőkén.
_Avoid_: Megosztott esemény
