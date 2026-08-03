import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decoderAppliesExifOrientation,
  resetDecoderOrientationProbe,
} from './decoderOrientation';
import { readExifMetadata } from './exif';

// A mérőkép nyers mérete 2×1, `Orientation = 6`-tal. A fake dekóder azt játssza
// el, hogy a böngésző elforgatja-e: 1×2 (forgat) vagy 2×1 (nem forgat).
let decodedSize = { width: 0, height: 0 };
let decodeFails = false;
let decodedBlobs: Blob[] = [];

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    this.naturalWidth = decodedSize.width;
    this.naturalHeight = decodedSize.height;
    queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onload?.()));
  }
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  decodeFails = false;
  decodedBlobs = [];
  resetDecoderOrientationProbe();
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    decodedBlobs.push(blob as Blob);
    return 'blob:probe';
  };
  URL.revokeObjectURL = () => {};
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.unstubAllGlobals();
  resetDecoderOrientationProbe();
});

describe('decoderAppliesExifOrientation', () => {
  it('true, ha a dekóder elforgatva adja vissza a mérőképet', async () => {
    decodedSize = { width: 1, height: 2 };

    await expect(decoderAppliesExifOrientation()).resolves.toBe(true);
  });

  it('false, ha a dekóder a nyers méretet adja vissza', async () => {
    decodedSize = { width: 2, height: 1 };

    await expect(decoderAppliesExifOrientation()).resolves.toBe(false);
  });

  it('sikertelen dekódolásnál inkább nem forgat', async () => {
    decodeFails = true;

    await expect(decoderAppliesExifOrientation()).resolves.toBe(true);
  });

  it('csak egyszer mér, utána a gyorsítótárazott eredményt adja', async () => {
    decodedSize = { width: 2, height: 1 };

    const first = await decoderAppliesExifOrientation();
    const second = await decoderAppliesExifOrientation();

    expect([first, second]).toEqual([false, false]);
    expect(decodedBlobs).toHaveLength(1);
  });

  it('a mérőkép valóban Orientation = 6 EXIF-et hordoz', async () => {
    decodedSize = { width: 1, height: 2 };
    await decoderAppliesExifOrientation();

    const probeBytes = new Uint8Array(await decodedBlobs[0].arrayBuffer());
    const metadata = readExifMetadata(probeBytes.buffer as ArrayBuffer);

    expect(metadata.orientation).toBe(6);
    expect(decodedBlobs[0].type).toBe('image/jpeg');
  });
});
