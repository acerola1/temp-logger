import { describe, expect, it } from 'vitest';
import { normalizeStoredPlantingYear } from './plantingYear';

describe('normalizeStoredPlantingYear', () => {
  it.each([
    [{ plantingYear: 2024 }, 2024],
    [{ plantingDate: { precision: 'date', date: '2022-04-03' } }, 2022],
    [{ plantingDate: { precision: 'year', year: 2021 } }, 2021],
    [{ plantingDate: { precision: 'unknown' } }, null],
    [{}, null],
    [{ plantingDate: { precision: 'date', date: '2022-02-30' } }, null],
  ] as const)('normalizes the stored planting value %#', (stored, expected) => {
    expect(normalizeStoredPlantingYear(stored)).toBe(expected);
  });
});
