// A képnéző nagyítás-matematikája, DOM nélkül. A komponens csak megméri a
// vásznat és a képet, a döntést ezek a függvények hozzák.

export const MIN_LIGHTBOX_SCALE = 1;
export const MAX_LIGHTBOX_SCALE = 5;

// A kép aktuális nézete: nagyítás és eltolás (a vászon közepéhez képest, px).
export interface LightboxView {
  s: number;
  x: number;
  y: number;
}

// A megjelenített kép és a vászon mérete px-ben, nagyítás nélkül.
export interface LightboxBounds {
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const RESET_LIGHTBOX_VIEW: LightboxView = { s: 1, x: 0, y: 0 };

// A néző mindenhol ugyanezzel vág sávba: nagyítást, eltolást és képindexet is.
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// A kép ne csúszhasson ki a képernyőről: az eltolást a nagyított kép és a vászon
// méretének különbségére korlátozzuk. Ha a kép belefér, nincs mit eltolni.
export function clampLightboxOffset(
  x: number,
  y: number,
  s: number,
  bounds: LightboxBounds | null,
): { x: number; y: number } {
  if (!bounds) return { x, y };
  const maxX = Math.max(0, (bounds.imageWidth * s - bounds.canvasWidth) / 2);
  const maxY = Math.max(0, (bounds.imageHeight * s - bounds.canvasHeight) / 2);
  return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
}

// Nagyítás úgy, hogy a fókuszpont alatti képrészlet a helyén maradjon. A fókusz a
// vászon közepéhez relatív pont; a közepére nagyításhoz `{ x: 0, y: 0 }`.
export function zoomLightboxView(
  view: LightboxView,
  target: number,
  focus: { x: number; y: number },
  bounds: LightboxBounds | null,
): LightboxView {
  const s = clamp(target, MIN_LIGHTBOX_SCALE, MAX_LIGHTBOX_SCALE);
  if (s === view.s) return view;
  const ratio = s / view.s;
  const x = focus.x - ratio * (focus.x - view.x);
  const y = focus.y - ratio * (focus.y - view.y);
  return { s, ...clampLightboxOffset(x, y, s, bounds) };
}
