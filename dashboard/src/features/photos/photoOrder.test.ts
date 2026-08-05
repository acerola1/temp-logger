import { describe, expect, it } from 'vitest';
import type { Photo } from './photoMetadata';
import { photoDisplayTime, resolvePhotoCover, sortPhotosNewestFirst } from './photoOrder';

function photo(id: string, capturedAt: string | null, uploadedAt: string): Photo {
  return {
    id,
    storagePath: `${id}.jpg`,
    downloadUrl: `https://example.test/${id}.jpg`,
    width: 800,
    height: 600,
    thumbnail: null,
    capturedAt,
    uploadedAt,
    caption: '',
  };
}

describe('sortPhotosNewestFirst', () => {
  it('a készítési időt, annak hiányában a feltöltési időt rendezi csökkenően', () => {
    const olderCapture = photo('older-capture', '2026-07-01T08:00:00.000Z', '2026-08-03T08:00:00.000Z');
    const newerUpload = photo('newer-upload', null, '2026-08-02T08:00:00.000Z');
    const newestCapture = photo('newest-capture', '2026-08-04T08:00:00.000Z', '2026-08-01T08:00:00.000Z');

    expect(sortPhotosNewestFirst([olderCapture, newerUpload, newestCapture]).map(({ id }) => id))
      .toEqual(['newest-capture', 'newer-upload', 'older-capture']);
  });

  it('azonos megjelenítési időnél feltöltési idővel, majd id-val dönt', () => {
    const capturedAt = '2026-08-04T08:00:00.000Z';
    const first = photo('a', capturedAt, '2026-08-04T09:00:00.000Z');
    const second = photo('b', capturedAt, '2026-08-04T10:00:00.000Z');
    const third = photo('c', capturedAt, '2026-08-04T10:00:00.000Z');

    expect(sortPhotosNewestFirst([first, second, third]).map(({ id }) => id))
      .toEqual(['c', 'b', 'a']);
  });

  it('az epoch és hibás legacy dátumokat a végén, eredeti sorrendben tartja', () => {
    const legacyFirst = photo('legacy-first', null, new Date(0).toISOString());
    const known = photo('known', null, '2026-08-04T08:00:00.000Z');
    const legacySecond = photo('legacy-second', null, 'hibás');

    expect(sortPhotosNewestFirst([legacyFirst, known, legacySecond]).map(({ id }) => id))
      .toEqual(['known', 'legacy-first', 'legacy-second']);
    expect(photoDisplayTime(legacyFirst)).toBeNull();
  });
});

describe('resolvePhotoCover', () => {
  const newest = photo('newest', null, '2026-08-04T08:00:00.000Z');
  const older = photo('older', null, '2026-08-03T08:00:00.000Z');

  it('null kijelölésnél a rendezés első fotóját adja automatikus borítóként', () => {
    expect(resolvePhotoCover([newest, older], null)).toEqual({ photo: newest, isPinned: false });
  });

  it('létező kijelölést ad vissza rögzített borítóként', () => {
    expect(resolvePhotoCover([newest, older], 'older')).toEqual({ photo: older, isPinned: true });
  });

  it('elavult kijelölésnél automatikus borítóra esik vissza', () => {
    expect(resolvePhotoCover([newest, older], 'missing')).toEqual({ photo: newest, isPinned: false });
  });
});
