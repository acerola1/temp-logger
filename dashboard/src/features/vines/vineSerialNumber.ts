export interface NumberedVine {
  serialNumber: number;
}

/** A meglévő tőkék által nem használt legkisebb pozitív egész sorszám. */
export function getNextVineSerialNumber(vines: readonly NumberedVine[]): number {
  const used = new Set(
    vines
      .map((vine) => vine.serialNumber)
      .filter((serialNumber) => Number.isInteger(serialNumber) && serialNumber > 0),
  );
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}
