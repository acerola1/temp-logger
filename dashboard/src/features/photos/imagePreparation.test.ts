import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFileExtension, prepareImageUpload } from './imagePreparation';

interface CanvasCall {
  width: number;
  height: number;
  contentType: string;
  quality: number | undefined;
  drawnWidth: number;
  drawnHeight: number;
}

let naturalSize = { width: 0, height: 0 };
let canvasCalls: CanvasCall[] = [];

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    this.naturalWidth = naturalSize.width;
    this.naturalHeight = naturalSize.height;
    queueMicrotask(() => this.onload?.());
  }
}

function createFakeCanvas() {
  let drawn = { width: 0, height: 0 };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => {
        drawn = { width, height };
      },
    }),
    toBlob: (
      callback: (blob: Blob | null) => void,
      contentType: string,
      quality: number | undefined,
    ) => {
      canvasCalls.push({
        width: canvas.width,
        height: canvas.height,
        contentType,
        quality,
        drawnWidth: drawn.width,
        drawnHeight: drawn.height,
      });
      callback(new Blob(['resized'], { type: contentType }));
    },
  };

  return canvas;
}

function makeFile(type: string) {
  return new File([new Uint8Array(16)], `photo.${getFileExtension(type)}`, { type });
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  canvasCalls = [];
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('document', { createElement: () => createFakeCanvas() });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.unstubAllGlobals();
});

describe('prepareImageUpload', () => {
  it('a méretkorlát alatti képet változatlanul engedi tovább', async () => {
    naturalSize = { width: 800, height: 600 };
    const file = makeFile('image/jpeg');

    const prepared = await prepareImageUpload(file, { maxImageSide: 1000 });

    expect(prepared.blob).toBe(file);
    expect(prepared.width).toBe(800);
    expect(prepared.height).toBe(600);
    expect(prepared.contentType).toBe('image/jpeg');
    expect(canvasCalls).toHaveLength(0);
  });

  it('a méretkorlát feletti képet a hosszabbik oldalra méretezi át', async () => {
    naturalSize = { width: 4000, height: 3000 };
    const file = makeFile('image/jpeg');

    const prepared = await prepareImageUpload(file, { maxImageSide: 1000 });

    expect(prepared.blob).not.toBe(file);
    expect(prepared.width).toBe(1000);
    expect(prepared.height).toBe(750);
    expect(canvasCalls).toEqual([
      {
        width: 1000,
        height: 750,
        contentType: 'image/jpeg',
        quality: 0.9,
        drawnWidth: 1000,
        drawnHeight: 750,
      },
    ]);
  });

  it('hívónként eltérő méretkorlátot fogad el, alapértelmezésben 1000 px-et', async () => {
    naturalSize = { width: 2000, height: 4000 };

    const vinePhoto = await prepareImageUpload(makeFile('image/jpeg'), { maxImageSide: 1280 });
    const cuttingPhoto = await prepareImageUpload(makeFile('image/jpeg'));

    expect([vinePhoto.width, vinePhoto.height]).toEqual([640, 1280]);
    expect([cuttingPhoto.width, cuttingPhoto.height]).toEqual([500, 1000]);
  });

  it('png és webp esetén megtartja a formátumot, minőségparaméter nélkül', async () => {
    naturalSize = { width: 2000, height: 2000 };

    const prepared = await prepareImageUpload(makeFile('image/png'), { maxImageSide: 1000 });

    expect(prepared.contentType).toBe('image/png');
    expect(canvasCalls[0].quality).toBeUndefined();
  });
});

describe('getFileExtension', () => {
  it('a tárolt formátumhoz igazítja a kiterjesztést', () => {
    expect(getFileExtension('image/png')).toBe('png');
    expect(getFileExtension('image/webp')).toBe('webp');
    expect(getFileExtension('image/jpeg')).toBe('jpg');
    expect(getFileExtension('image/heic')).toBe('jpg');
  });
});
