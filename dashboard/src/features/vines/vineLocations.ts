import type { Vine } from './model';

const HUNGARIAN_LOCALE = 'hu';

export function locationKey(value: string): string {
  return value.trim().toLocaleLowerCase(HUNGARIAN_LOCALE);
}

export function getVineLocationSuggestions(vines: readonly Vine[]): string[] {
  const suggestions = new Map<string, string>();

  for (const vine of vines) {
    const location = vine.location?.trim() ?? '';
    const key = locationKey(location);
    if (location && !suggestions.has(key)) suggestions.set(key, location);
  }

  return [...suggestions.values()].sort((left, right) =>
    left.localeCompare(right, HUNGARIAN_LOCALE, { sensitivity: 'base' }),
  );
}

export function resolveVineLocation(
  value: string,
  knownLocations: readonly string[],
): string {
  const trimmed = value.trim();
  const key = locationKey(trimmed);
  return knownLocations.find((location) => locationKey(location) === key)?.trim() ?? trimmed;
}

export function getLatestVineLocation(vines: readonly Vine[]): string {
  let latest: Vine | null = null;

  for (const vine of vines) {
    if (!vine.location?.trim()) continue;
    if (!latest || Date.parse(vine.createdAt) > Date.parse(latest.createdAt)) latest = vine;
  }

  return latest?.location?.trim() ?? '';
}
