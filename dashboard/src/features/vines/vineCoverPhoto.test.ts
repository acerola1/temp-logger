import { describe, expect, it } from 'vitest';
import type { VinePhoto } from './model';
import {
  resolveVineCoverPhoto,
  sortVinePhotos,
  type VineCoverPhotoSource,
} from './vineCoverPhoto';

function photo(id: string, overrides: Partial<VinePhoto> = {}): VinePhoto {
  return {
    id,
    storagePath: `vines/vine-1/photos/${id}.jpg`,
    downloadUrl: `https://example.test/${id}.jpg`,
    width: 800,
    height: 600,
    thumbnail: null,
    capturedAt: null,
    uploadedAt: '2026-08-01T10:00:00.000Z',
    caption: '',
    ...overrides,
  };
}

function vine(
  photos: VinePhoto[],
  coverPhotoId: string | null = null,
): VineCoverPhotoSource {
  return { photos, coverPhotoId };
}

describe('sortVinePhotos', () => {
  it('a legújabb fotót adja elsőnek, a készítési idő szerint', () => {
    const sorted = sortVinePhotos([
      photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' }),
      photo('b', { capturedAt: '2026-07-20T08:00:00.000Z' }),
      photo('c', { capturedAt: '2026-06-10T08:00:00.000Z' }),
    ]);

    expect(sorted.map((candidate) => candidate.id)).toEqual(['b', 'c', 'a']);
  });

  it('EXIF nélküli fotót a feltöltési ideje szerint rangsorolja a többi közé', () => {
    // A `b` feltöltése későbbi, mint az `a` valódi készítési ideje, ezért az van
    // elöl — a fotó alatt kiírt `Feltöltve` dátum szerint is ez a frissebb.
    const sorted = sortVinePhotos([
      photo('a', {
        capturedAt: '2026-05-01T08:00:00.000Z',
        uploadedAt: '2026-08-01T10:00:00.000Z',
      }),
      photo('b', { capturedAt: null, uploadedAt: '2026-06-01T10:00:00.000Z' }),
    ]);

    expect(sorted.map((candidate) => candidate.id)).toEqual(['b', 'a']);
  });

  it('azonos megjelenítési időnél a feltöltés, majd az azonosító dönt', () => {
    // A migrációval egy tömbbe került, azonos dátumú régi fotóknál ez az új
    // tie-break: a tárolt tömbsorrend helyett determinisztikus és stabil.
    const sameCapture = { capturedAt: '2026-07-01T08:00:00.000Z' };
    const source = [
      photo('a', { ...sameCapture, uploadedAt: '2026-07-02T10:00:00.000Z' }),
      photo('c', { ...sameCapture, uploadedAt: '2026-07-03T10:00:00.000Z' }),
      photo('b', { ...sameCapture, uploadedAt: '2026-07-03T10:00:00.000Z' }),
    ];

    expect(sortVinePhotos(source).map((candidate) => candidate.id)).toEqual(['c', 'b', 'a']);
    expect(sortVinePhotos(source).map((candidate) => candidate.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('resolveVineCoverPhoto automatikus borító', () => {
  it('fotó nélküli tőkéhez nem ad képet', () => {
    expect(resolveVineCoverPhoto(vine([]))).toBeNull();
  });

  it('a rendezés első fotója az automatikus borító', () => {
    const cover = resolveVineCoverPhoto(
      vine([
        photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' }),
        photo('b', { capturedAt: '2026-07-20T08:00:00.000Z' }),
      ]),
    );

    expect(cover?.photo.id).toBe('b');
    expect(cover?.isPinned).toBe(false);
  });
});

describe('resolveVineCoverPhoto kijelölt borító', () => {
  it('a kijelölt képet adja a frissebb helyett', () => {
    const cover = resolveVineCoverPhoto(
      vine(
        [
          photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' }),
          photo('b', { capturedAt: '2026-07-20T08:00:00.000Z' }),
        ],
        'a',
      ),
    );

    expect(cover?.photo.id).toBe('a');
    expect(cover?.isPinned).toBe(true);
  });

  it('nem létező fotóra mutató kijelölésnél az automatikus képre esik vissza', () => {
    const cover = resolveVineCoverPhoto(
      vine([photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' })], 'torolt'),
    );

    expect(cover?.photo.id).toBe('a');
    expect(cover?.isPinned).toBe(false);
  });

  it('elavult kijelölés és fotó nélküli tőke esetén sem ad képet', () => {
    expect(resolveVineCoverPhoto(vine([], 'a'))).toBeNull();
  });
});
