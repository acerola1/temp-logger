import { describe, expect, it } from 'vitest';
import {
  clampLightboxOffset,
  MAX_LIGHTBOX_SCALE,
  RESET_LIGHTBOX_VIEW,
  zoomLightboxView,
  type LightboxBounds,
  type LightboxView,
} from './photoLightboxView';

// 800×600-as kép egy 1000×800-as vásznon: alaphelyzetben belefér.
const BOUNDS: LightboxBounds = {
  imageWidth: 800,
  imageHeight: 600,
  canvasWidth: 1000,
  canvasHeight: 800,
};

// A fókusz alatti képpont a vászon közepéhez képest, a kép saját koordinátáiban.
const imagePointUnder = (view: LightboxView, focus: { x: number; y: number }) => ({
  x: (focus.x - view.x) / view.s,
  y: (focus.y - view.y) / view.s,
});

describe('zoomLightboxView', () => {
  it('a fókuszpont alatti képrészletet a helyén tartja', () => {
    const focus = { x: 120, y: -80 };
    const before = imagePointUnder(RESET_LIGHTBOX_VIEW, focus);

    const zoomed = zoomLightboxView(RESET_LIGHTBOX_VIEW, 2, focus, null);

    expect(zoomed.s).toBe(2);
    expect(imagePointUnder(zoomed, focus)).toEqual(before);
  });

  it('több egymást követő nagyítás után is a fókuszpontnál marad', () => {
    const focus = { x: -60, y: 40 };
    let view = RESET_LIGHTBOX_VIEW;
    const before = imagePointUnder(view, focus);

    for (const target of [1.4, 2.1, 3.2]) {
      view = zoomLightboxView(view, target, focus, null);
    }

    const after = imagePointUnder(view, focus);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('a vászon közepére nagyít, ha nincs fókuszpont', () => {
    const zoomed = zoomLightboxView(RESET_LIGHTBOX_VIEW, 2.5, { x: 0, y: 0 }, null);

    expect(zoomed).toEqual({ s: 2.5, x: 0, y: 0 });
  });

  it('a nagyítást a megengedett sávba vágja', () => {
    expect(zoomLightboxView(RESET_LIGHTBOX_VIEW, 12, { x: 0, y: 0 }, null).s).toBe(
      MAX_LIGHTBOX_SCALE,
    );
    expect(zoomLightboxView({ s: 2, x: 10, y: 10 }, 0.2, { x: 0, y: 0 }, null).s).toBe(1);
  });

  it('változatlan nagyításnál ugyanazt a nézetet adja vissza', () => {
    const view: LightboxView = { s: 2, x: 30, y: -10 };

    expect(zoomLightboxView(view, 2, { x: 100, y: 100 }, BOUNDS)).toBe(view);
  });

  it('a nagyítás eredményét is a vászon határai közé szorítja', () => {
    // 1,25× nagyításnál a kép 1000×750, a vászon 1000×800: vízszintesen épp
    // nincs mozgástér, ezért a széli fókuszpont sem tolhatja el.
    const zoomed = zoomLightboxView(RESET_LIGHTBOX_VIEW, 1.25, { x: 400, y: 0 }, BOUNDS);

    expect(zoomed.s).toBe(1.25);
    expect(zoomed.x).toBeCloseTo(0, 10);
    expect(zoomed.y).toBeCloseTo(0, 10);
  });
});

describe('clampLightboxOffset', () => {
  it('a vászonba beférő képet nem engedi eltolni', () => {
    const offset = clampLightboxOffset(120, -90, 1, BOUNDS);

    expect(offset.x).toBeCloseTo(0, 10);
    expect(offset.y).toBeCloseTo(0, 10);
  });

  it('a nagyított képet a kilógó fél-fél sávon belül engedi mozgatni', () => {
    // 2× nagyításnál a kép 1600×1200, a vászon 1000×800 → 300, illetve 200 px.
    expect(clampLightboxOffset(500, 500, 2, BOUNDS)).toEqual({ x: 300, y: 200 });
    expect(clampLightboxOffset(-500, -500, 2, BOUNDS)).toEqual({ x: -300, y: -200 });
    expect(clampLightboxOffset(120, -90, 2, BOUNDS)).toEqual({ x: 120, y: -90 });
  });

  it('méretek nélkül nem korlátoz', () => {
    expect(clampLightboxOffset(9999, -9999, 3, null)).toEqual({ x: 9999, y: -9999 });
  });
});
