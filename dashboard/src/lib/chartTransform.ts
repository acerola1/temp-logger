export function scaleX(
  value: number,
  domain: [number, number],
  plotLeft: number,
  plotWidth: number,
): number {
  const span = domain[1] - domain[0];

  if (span <= 0 || plotWidth <= 0) {
    return plotLeft;
  }

  const ratio = (value - domain[0]) / span;
  return plotLeft + ratio * plotWidth;
}
