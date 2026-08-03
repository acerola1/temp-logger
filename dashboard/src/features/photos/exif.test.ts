import { describe, expect, it } from 'vitest';
import { readExifMetadata, readImageExif } from './exif';
import {
  buildExifApp1,
  buildExifJpeg,
  buildExifTiff,
  buildJpeg,
  buildJpegSegment,
  toArrayBuffer,
  type JpegBytes,
} from './exifFixtures';

// A tag időzóna nélkül a kamera helyi idejét tartalmazza, ezért a várt ISO-t is
// helyi időből számoljuk.
function localIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
}

function readJpeg(bytes: JpegBytes) {
  return readExifMetadata(toArrayBuffer(bytes));
}

describe('readExifMetadata', () => {
  it('kiolvassa a DateTimeOriginal-t és az Orientation-t', () => {
    const metadata = readJpeg(
      buildExifJpeg({ orientation: 6, dateTimeOriginal: '2026:05:02 10:11:12' }),
    );

    expect(metadata).toEqual({
      capturedAt: localIso(2026, 5, 2, 10, 11, 12),
      orientation: 6,
    });
  });

  it('big-endian (MM) bájtsorrendet is olvas', () => {
    const metadata = readJpeg(
      buildExifJpeg({
        littleEndian: false,
        orientation: 8,
        dateTimeOriginal: '2025:12:24 18:00:00',
      }),
    );

    expect(metadata).toEqual({
      capturedAt: localIso(2025, 12, 24, 18, 0, 0),
      orientation: 8,
    });
  });

  it('átlépi az APP1 előtti szegmenseket', () => {
    const jfif = buildJpegSegment(0xe0, new Uint8Array([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02]));
    const app1 = buildExifApp1(buildExifTiff({ orientation: 3, dateTimeOriginal: '2026:01:02 03:04:05' }));

    const metadata = readJpeg(buildJpeg(jfif, app1));

    expect(metadata.orientation).toBe(3);
    expect(metadata.capturedAt).toBe(localIso(2026, 1, 2, 3, 4, 5));
  });

  it('csak az egyik tag jelenlétét is elfogadja', () => {
    expect(readJpeg(buildExifJpeg({ orientation: 5 }))).toEqual({
      capturedAt: null,
      orientation: 5,
    });
    expect(readJpeg(buildExifJpeg({ dateTimeOriginal: '2026:03:04 05:06:07' }))).toEqual({
      capturedAt: localIso(2026, 3, 4, 5, 6, 7),
      orientation: null,
    });
  });

  it('nem jpeg bemenetre null-okat ad', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    expect(readJpeg(png)).toEqual({ capturedAt: null, orientation: null });
    expect(readExifMetadata(new ArrayBuffer(0))).toEqual({ capturedAt: null, orientation: null });
  });

  it('EXIF nélküli jpeg-re null-okat ad', () => {
    expect(readJpeg(buildJpeg())).toEqual({ capturedAt: null, orientation: null });
  });

  it('csonka EXIF-blokkra nem dob hibát', () => {
    const full = buildExifJpeg({ orientation: 6, dateTimeOriginal: '2026:05:02 10:11:12' });

    for (let length = 2; length < full.length; length += 1) {
      const truncated = full.slice(0, length);
      expect(() => readJpeg(truncated)).not.toThrow();
    }

    // Épp a dátum adatterületét vágjuk le: a dátum eltűnik, hibát nem kapunk.
    const cut = readJpeg(full.slice(0, full.length - 8));
    expect(cut.capturedAt).toBeNull();
  });

  it('sérült TIFF-fejlécre null-okat ad', () => {
    expect(readJpeg(buildExifJpeg({ orientation: 6, brokenMagic: true }))).toEqual({
      capturedAt: null,
      orientation: null,
    });
    expect(readJpeg(buildExifJpeg({ orientation: 6, brokenByteOrder: true }))).toEqual({
      capturedAt: null,
      orientation: null,
    });
  });

  it('értelmetlen dátumot és tartományon kívüli orientációt eldob', () => {
    expect(
      readJpeg(buildExifJpeg({ orientation: 9, dateTimeOriginal: '0000:00:00 00:00:00' })),
    ).toEqual({ capturedAt: null, orientation: null });
    expect(readJpeg(buildExifJpeg({ dateTimeOriginal: '2026:02:30 10:00:00' })).capturedAt).toBeNull();
    expect(readJpeg(buildExifJpeg({ dateTimeOriginal: 'nem egy datum ' })).capturedAt).toBeNull();
  });
});

describe('readImageExif', () => {
  it('a fájl elejéből olvassa ki a metaadatot', async () => {
    const bytes = buildExifJpeg({ orientation: 6, dateTimeOriginal: '2026:07:08 09:10:11' });
    const file = new File([bytes], 'photo.jpg', { type: 'image/jpeg' });

    await expect(readImageExif(file)).resolves.toEqual({
      capturedAt: localIso(2026, 7, 8, 9, 10, 11),
      orientation: 6,
    });
  });

  it('EXIF nélküli fájlra null-okat ad, hiba nélkül', async () => {
    const file = new File([new Uint8Array(64)], 'photo.jpg', { type: 'image/jpeg' });

    await expect(readImageExif(file)).resolves.toEqual({ capturedAt: null, orientation: null });
  });
});
