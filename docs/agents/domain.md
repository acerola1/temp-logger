# Domain Docs

A repó single-context domain-dokumentációt használ.

## Feltérképezés előtt olvasd el

- A gyökérben lévő `CONTEXT.md` fájlt, ha létezik.
- Az érintett ADR-eket a `docs/adr/` könyvtárból, ha léteznek.

A hiányzó dokumentumokat nem kell előre létrehozni. A `domain-modeling`,
`grill-with-docs` és kapcsolódó skillek akkor hozzák létre őket, amikor valódi
domainfogalom vagy architekturális döntés születik.

## Elrendezés

- Domainfogalmak: `/CONTEXT.md`
- Architektúradöntések: `/docs/adr/`

A skillek következetesen a `CONTEXT.md` fogalmait használják. Ha egy javaslat
ellentmond egy meglévő ADR-nek, azt kifejezetten jelezni kell.
