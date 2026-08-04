import { describe, expect, it } from 'vitest';
import type { VineCoverPhotoRef, VineEvent, VineEventPhoto } from './model';
import { resolveVineCoverPhoto, type VineCoverPhotoSource } from './vineCoverPhoto';

function photo(id: string, overrides: Partial<VineEventPhoto> = {}): VineEventPhoto {
  return {
    id,
    storagePath: `vines/vine-1/events/event-1/photos/${id}.jpg`,
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

function event(id: string, photos: VineEventPhoto[], occurredAt = '2026-08-01T09:00:00.000Z'): VineEvent {
  return {
    id,
    type: 'observation',
    occurredAt,
    title: `${id} esemény`,
    notes: '',
    photos,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function vine(
  events: VineEvent[],
  coverPhoto: VineCoverPhotoRef | null = null,
): VineCoverPhotoSource {
  return { events, coverPhoto };
}

describe('resolveVineCoverPhoto automatikus borító', () => {
  it('fotó nélküli tőkéhez nem ad képet', () => {
    expect(resolveVineCoverPhoto(vine([]))).toBeNull();
    expect(resolveVineCoverPhoto(vine([event('event-1', [])]))).toBeNull();
  });

  it('több esemény fotói közül a legutóljára fényképezettet adja', () => {
    const cover = resolveVineCoverPhoto(
      vine([
        event('event-1', [photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' })]),
        event('event-2', [photo('b', { capturedAt: '2026-07-20T08:00:00.000Z' })]),
        event('event-3', [photo('c', { capturedAt: '2026-06-10T08:00:00.000Z' })]),
      ]),
    );

    expect(cover?.photo.id).toBe('b');
    expect(cover?.event.id).toBe('event-2');
    expect(cover?.isPinned).toBe(false);
  });

  it('EXIF nélküli fotót a feltöltési ideje szerint rangsorolja a készítési idejűek közé', () => {
    // A `b` feltöltése későbbi, mint az `a` valódi készítési ideje, ezért az a
    // borító — a fotó alatt kiírt dátum szerint is ez a frissebb.
    const cover = resolveVineCoverPhoto(
      vine([
        event('event-1', [
          photo('a', { capturedAt: '2026-05-01T08:00:00.000Z', uploadedAt: '2026-08-01T10:00:00.000Z' }),
          photo('b', { capturedAt: null, uploadedAt: '2026-06-01T10:00:00.000Z' }),
        ]),
      ]),
    );

    expect(cover?.photo.id).toBe('b');
  });

  it('azonos dátumnál a későbbi esemény, majd a később felvett fotó dönt', () => {
    const sameDate = { capturedAt: '2026-07-01T08:00:00.000Z' };
    const cover = resolveVineCoverPhoto(
      vine([
        event('event-1', [photo('a', sameDate)], '2026-07-05T09:00:00.000Z'),
        event('event-2', [photo('b', sameDate), photo('c', sameDate)], '2026-07-06T09:00:00.000Z'),
      ]),
    );

    expect(cover?.photo.id).toBe('c');
    expect(cover?.event.id).toBe('event-2');
  });

  it('teljesen azonos dátumoknál is determinisztikus', () => {
    const sameDate = { capturedAt: '2026-07-01T08:00:00.000Z' };
    const source = vine([
      event('event-1', [photo('a', sameDate), photo('b', sameDate)]),
      event('event-2', [photo('c', sameDate)]),
    ]);

    expect(resolveVineCoverPhoto(source)?.photo.id).toBe('c');
    expect(resolveVineCoverPhoto(source)?.photo.id).toBe('c');
  });
});

describe('resolveVineCoverPhoto kijelölt borító', () => {
  it('a kijelölt képet adja a frissebb helyett', () => {
    const cover = resolveVineCoverPhoto(
      vine(
        [
          event('event-1', [photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' })]),
          event('event-2', [photo('b', { capturedAt: '2026-07-20T08:00:00.000Z' })]),
        ],
        { eventId: 'event-1', photoId: 'a' },
      ),
    );

    expect(cover?.photo.id).toBe('a');
    expect(cover?.event.id).toBe('event-1');
    expect(cover?.isPinned).toBe(true);
  });

  it('nem létező fotóra mutató kijelölésnél az automatikus képre esik vissza', () => {
    const cover = resolveVineCoverPhoto(
      vine(
        [event('event-1', [photo('a', { capturedAt: '2026-05-01T08:00:00.000Z' })])],
        { eventId: 'event-1', photoId: 'torolt' },
      ),
    );

    expect(cover?.photo.id).toBe('a');
    expect(cover?.isPinned).toBe(false);
  });

  it('nem létező eseményre mutató kijelölésnél az automatikus képre esik vissza', () => {
    const cover = resolveVineCoverPhoto(
      vine([event('event-1', [photo('a')])], { eventId: 'torolt-esemeny', photoId: 'a' }),
    );

    expect(cover?.photo.id).toBe('a');
    expect(cover?.isPinned).toBe(false);
  });

  it('elavult kijelölés és fotó nélküli tőke esetén sem ad képet', () => {
    expect(
      resolveVineCoverPhoto(vine([], { eventId: 'event-1', photoId: 'a' })),
    ).toBeNull();
  });
});
