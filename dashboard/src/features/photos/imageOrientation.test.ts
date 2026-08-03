import { describe, expect, it } from 'vitest';
import {
  isSupportedOrientation,
  orientationDraw,
  orientationSwapsAxes,
  orientedSize,
  type ExifOrientation,
} from './imageOrientation';

// A transzformáció ellenőrzése a nyers kép sarkainak leképezésével: így nem a
// mátrixot hasonlítjuk össze, hanem azt, hogy hová kerül a kép.
function mapCorner(
  orientation: ExifOrientation,
  targetWidth: number,
  targetHeight: number,
  corner: 'topLeft' | 'topRight' | 'bottomLeft',
): { x: number; y: number } {
  const draw = orientationDraw(orientation, targetWidth, targetHeight);
  const [a, b, c, d, e, f] = draw.transform;
  const source = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: draw.drawWidth, y: 0 },
    bottomLeft: { x: 0, y: draw.drawHeight },
  }[corner];

  return { x: a * source.x + c * source.y + e, y: b * source.x + d * source.y + f };
}

describe('isSupportedOrientation', () => {
  it('csak az 1..8 egész értékeket fogadja el', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].every((value) => isSupportedOrientation(value))).toBe(true);
    expect(isSupportedOrientation(0)).toBe(false);
    expect(isSupportedOrientation(9)).toBe(false);
    expect(isSupportedOrientation(1.5)).toBe(false);
    expect(isSupportedOrientation(null)).toBe(false);
    expect(isSupportedOrientation(undefined)).toBe(false);
  });
});

describe('orientationSwapsAxes', () => {
  it('csak az 5..8 forgatásoknál cserél tengelyt', () => {
    expect([1, 2, 3, 4].some((value) => orientationSwapsAxes(value as ExifOrientation))).toBe(false);
    expect([5, 6, 7, 8].every((value) => orientationSwapsAxes(value as ExifOrientation))).toBe(true);
  });
});

describe('orientedSize', () => {
  it('a 90 fokos orientációknál felcseréli a szélességet és a magasságot', () => {
    expect(orientedSize({ width: 4000, height: 3000 }, 6)).toEqual({ width: 3000, height: 4000 });
    expect(orientedSize({ width: 4000, height: 3000 }, 8)).toEqual({ width: 3000, height: 4000 });
    expect(orientedSize({ width: 4000, height: 3000 }, 3)).toEqual({ width: 4000, height: 3000 });
    expect(orientedSize({ width: 4000, height: 3000 }, 1)).toEqual({ width: 4000, height: 3000 });
  });
});

describe('orientationDraw', () => {
  it('orientáció nélkül nem transzformál', () => {
    expect(orientationDraw(1, 1000, 750)).toEqual({
      transform: [1, 0, 0, 1, 0, 0],
      drawWidth: 1000,
      drawHeight: 750,
    });
  });

  it('a forgatott orientációknál a nyers kép fekvő méretét rajzolja az álló vászonra', () => {
    expect(orientationDraw(6, 750, 1000)).toMatchObject({ drawWidth: 1000, drawHeight: 750 });
    expect(orientationDraw(8, 750, 1000)).toMatchObject({ drawWidth: 1000, drawHeight: 750 });
  });

  it('a 6-os orientációt az óramutató irányába forgatja', () => {
    // A nyers kép bal felső sarka a vászon jobb felső sarkába kerül.
    expect(mapCorner(6, 300, 400, 'topLeft')).toEqual({ x: 300, y: 0 });
    expect(mapCorner(6, 300, 400, 'topRight')).toEqual({ x: 300, y: 400 });
    expect(mapCorner(6, 300, 400, 'bottomLeft')).toEqual({ x: 0, y: 0 });
  });

  it('a 8-as orientációt az óramutatóval szemben forgatja', () => {
    expect(mapCorner(8, 300, 400, 'topLeft')).toEqual({ x: 0, y: 400 });
    expect(mapCorner(8, 300, 400, 'topRight')).toEqual({ x: 0, y: 0 });
    expect(mapCorner(8, 300, 400, 'bottomLeft')).toEqual({ x: 300, y: 400 });
  });

  it('a 3-as orientációt 180 fokkal fordítja', () => {
    expect(mapCorner(3, 400, 300, 'topLeft')).toEqual({ x: 400, y: 300 });
    expect(mapCorner(3, 400, 300, 'topRight')).toEqual({ x: 0, y: 300 });
  });

  it('a tükrözéseket a megfelelő tengelyen végzi', () => {
    // 2: vízszintes tükrözés — a bal felső sarok jobbra kerül, de nem fordul le.
    expect(mapCorner(2, 400, 300, 'topLeft')).toEqual({ x: 400, y: 0 });
    // 4: függőleges tükrözés — a bal felső sarok lemegy, de nem megy jobbra.
    expect(mapCorner(4, 400, 300, 'topLeft')).toEqual({ x: 0, y: 300 });
    // 5: átló menti tükrözés — a bal felső sarok helyben marad.
    expect(mapCorner(5, 300, 400, 'topLeft')).toEqual({ x: 0, y: 0 });
    expect(mapCorner(5, 300, 400, 'topRight')).toEqual({ x: 0, y: 400 });
    // 7: ellenátló menti tükrözés — a bal felső sarok a szemközti sarokba megy.
    expect(mapCorner(7, 300, 400, 'topLeft')).toEqual({ x: 300, y: 400 });
  });

  it('minden orientációnál a vászon területén belül marad a kép', () => {
    const orientations: ExifOrientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

    for (const orientation of orientations) {
      for (const corner of ['topLeft', 'topRight', 'bottomLeft'] as const) {
        const point = mapCorner(orientation, 300, 400, corner);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(300);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(400);
      }
    }
  });
});
