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
  it('a legkisebb nem használt pozitív egész sorszámot adja', () => {
    const vines = [
      { serialNumber: 1 },
      { serialNumber: 4 },
      { serialNumber: 2 },
    ] as Vine[];

    expect(getNextVineSerialNumber(vines)).toBe(3);
    expect(getNextVineSerialNumber([{ serialNumber: 2 }] as Vine[])).toBe(1);
    expect(getNextVineSerialNumber([])).toBe(1);
  });
});
