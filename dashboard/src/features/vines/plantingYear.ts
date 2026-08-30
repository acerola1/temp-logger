function isPlantingYear(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1000 && (value as number) <= 9999;
}

export function normalizeStoredPlantingYear(value: Record<string, unknown>): number | null {
  if (isPlantingYear(value.plantingYear)) return value.plantingYear;

  const legacy = value.plantingDate;
  if (!legacy || typeof legacy !== 'object') return null;
  const legacyValue = legacy as Record<string, unknown>;
  if (
    legacyValue.precision === 'year' &&
    isPlantingYear(legacyValue.year)
  ) {
    return legacyValue.year;
  }
  if (legacyValue.precision !== 'date' || typeof legacyValue.date !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(legacyValue.date);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= 1000
    ? year
    : null;
}
