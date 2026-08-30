import { describe, expect, it } from 'vitest';
import type { Vine } from './model';
import {
  getLatestVineLocation,
  getVineLocationSuggestions,
  resolveVineLocation,
} from './vineLocations';

function vine(
  id: string,
  location: string | null,
  createdAt: string,
): Vine {
  return {
    id,
    serialNumber: Number(id),
    variety: 'Teszt',
    hasFruited: false,
    rootType: 'unknown',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    location,
    areaDescription: 'Tesztterület',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    photos: [],
    coverPhotoId: null,
    events: [],
    createdAt,
    updatedAt: createdAt,
    createdByUid: null,
  };
}

describe('vine locations', () => {
  const vines = [
    vine('1', ' telek ', '2026-01-01T00:00:00.000Z'),
    vine('2', 'Erkély', '2026-03-01T00:00:00.000Z'),
    vine('3', 'TELEK', '2026-02-01T00:00:00.000Z'),
    vine('4', null, '2026-04-01T00:00:00.000Z'),
  ];

  it('trims, de-duplicates case-insensitively and sorts with Hungarian collation', () => {
    expect(getVineLocationSuggestions(vines)).toEqual(['Erkély', 'telek']);
  });

  it('resolves a differently-cased input to the existing spelling', () => {
    expect(resolveVineLocation(' TELEK ', ['Erkély', 'Telek'])).toBe('Telek');
    expect(resolveVineLocation(' Présház ', ['Erkély', 'Telek'])).toBe('Présház');
  });

  it('uses createdAt to select the latest non-empty location', () => {
    expect(getLatestVineLocation(vines)).toBe('Erkély');
    expect(getLatestVineLocation([vine('5', null, '2026-05-01T00:00:00.000Z')])).toBe('');
  });
});
