export function getTimeDomain(values: number[]): [number, number] {
  if (values.length === 0) {
    const now = Date.now();
    return [now - 60 * 60 * 1000, now];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const paddingMs = 15 * 60 * 1000;
    return [min - paddingMs, max + paddingMs];
  }

  return [min, max];
}
