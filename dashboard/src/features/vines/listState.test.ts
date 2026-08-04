import { describe, expect, it } from 'vitest';
import type { Vine, VinePlantingDate } from './model';
import {
  DEFAULT_VINE_LIST_STATE,
  parseVineListState,
  selectVisibleVines,
  serializeVineListState,
  type VineListState,
} from './listState';

function vine(
  serialNumber: number,
  overrides: Partial<Vine> & { plantingDate?: VinePlantingDate } = {},
): Vine {
  return {
    id: `vine-${serialNumber}`,
    serialNumber,
    variety: `Fajta ${serialNumber}`,
    hasFruited: false,
    rootType: 'unknown',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    areaDescription: `Terület ${serialNumber}`,
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    coverPhoto: null,
    events: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: `2026-01-${String(serialNumber).padStart(2, '0')}T00:00:00.000Z`,
    createdByUid: null,
    ...overrides,
  };
}

function state(overrides: Partial<VineListState> = {}): VineListState {
  return { ...DEFAULT_VINE_LIST_STATE, ...overrides };
}

describe('vine list URL state', () => {
  it('uses active and most-recently-updated defaults for missing or invalid values', () => {
    expect(parseVineListState('?status=removed&rootType=nope&sort=oldest')).toEqual(
      DEFAULT_VINE_LIST_STATE,
    );
    expect(serializeVineListState({ ...DEFAULT_VINE_LIST_STATE })).toBe('');
  });

  it('round-trips every non-default value and trims free text', () => {
    const value: VineListState = {
      query: ' Kék 12 ',
      status: 'ceased',
      rootType: 'own_rooted',
      tag: ' öreg tőke ',
      fruited: 'yes',
      sort: 'planting_desc',
    };

    expect(parseVineListState(serializeVineListState(value))).toEqual({
      ...value,
      query: 'Kék 12',
      tag: 'öreg tőke',
    });
  });
});

describe('selectVisibleVines', () => {
  const vines = [
    vine(12, {
      variety: 'Kékfrankos',
      hasFruited: true,
      rootType: 'grafted',
      tags: ['pergola'],
      areaDescription: 'Ház mögötti sor',
    }),
    vine(2, {
      variety: 'Othello',
      rootType: 'own_rooted',
      tags: ['öreg tőke'],
      areaDescription: 'Régi lugas',
      status: 'ceased',
    }),
  ];

  it.each(['kÉk', '12', 'MÖGÖTTI'])('searches variety, serial and area for %s', (query) => {
    expect(selectVisibleVines(vines, state({ query, status: 'all' })).map((item) => item.id)).toEqual([
      'vine-12',
    ]);
  });

  it('applies status, root type, exact tag and fruited filters', () => {
    expect(selectVisibleVines(vines, state({ status: 'ceased' })).map((item) => item.id)).toEqual([
      'vine-2',
    ]);
    expect(
      selectVisibleVines(vines, state({ status: 'all', rootType: 'grafted' })).map(
        (item) => item.id,
      ),
    ).toEqual(['vine-12']);
    expect(
      selectVisibleVines(vines, state({ status: 'all', tag: 'Öreg tőke' })),
    ).toEqual([]);
    expect(
      selectVisibleVines(vines, state({ status: 'all', tag: 'öreg tőke' })).map(
        (item) => item.id,
      ),
    ).toEqual(['vine-2']);
    expect(
      selectVisibleVines(vines, state({ status: 'all', fruited: 'yes' })).map(
        (item) => item.id,
      ),
    ).toEqual(['vine-12']);
  });

  it('sorts by updated time descending by default without mutating the input', () => {
    const input = [vine(1), vine(3), vine(2)];

    expect(selectVisibleVines(input, state()).map((item) => item.serialNumber)).toEqual([3, 2, 1]);
    expect(input.map((item) => item.serialNumber)).toEqual([1, 3, 2]);
  });

  it('sorts varieties in Hungarian ascending order with serial-number tie-breaking', () => {
    const input = [
      vine(3, { variety: 'Othello' }),
      vine(2, { variety: 'Árkádia' }),
      vine(1, { variety: 'árkádia' }),
    ];

    expect(
      selectVisibleVines(input, state({ sort: 'variety_asc' })).map((item) => item.serialNumber),
    ).toEqual([1, 2, 3]);
  });

  it('treats a year as January 1 and always puts unknown planting dates last', () => {
    const input = [
      vine(1, { plantingDate: { precision: 'unknown' } }),
      vine(2, { plantingDate: { precision: 'year', year: 2025 } }),
      vine(3, { plantingDate: { precision: 'date', date: '2025-06-01' } }),
      vine(4, { plantingDate: { precision: 'date', date: '2025-01-01' } }),
      vine(5, { plantingDate: { precision: 'year', year: 2026 } }),
    ];

    expect(
      selectVisibleVines(input, state({ sort: 'planting_desc' })).map(
        (item) => item.serialNumber,
      ),
    ).toEqual([5, 3, 2, 4, 1]);
  });
});
