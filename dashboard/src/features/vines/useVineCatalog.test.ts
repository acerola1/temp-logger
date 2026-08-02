import { describe, expect, it } from 'vitest';
import type { Vine } from './model';
import { getNextVineSerialNumber, getVineTagSuggestions } from './useVineCatalog';

describe('vine catalog tag suggestions', () => {
  it('csak a tőkék nem üres, egyedi címkéiből készít javaslatokat', () => {
    const vines = [
      { tags: ['kedvenc', ' korai ', ''] },
      { tags: ['Kedvenc', 'bor'] },
    ] as Vine[];

    expect(getVineTagSuggestions(vines)).toEqual(['bor', 'kedvenc', 'korai']);
  });
});

describe('vine catalog serial allocation', () => {
  it('a betöltött legnagyobb sorszám után következő számot adja', () => {
    const vines = [
      { serialNumber: 4 },
      { serialNumber: 11 },
      { serialNumber: 7 },
    ] as Vine[];

    expect(getNextVineSerialNumber(vines)).toBe(12);
    expect(getNextVineSerialNumber([])).toBe(1);
  });
});
