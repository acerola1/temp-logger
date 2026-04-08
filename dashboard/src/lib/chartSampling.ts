import type { SensorReading, TimeRange } from '../types/sensor';

function getSamplingStep(timeRange: TimeRange): number {
  if (timeRange === '30d') return 4;
  if (timeRange === '7d') return 2;
  return 1;
}

export function sampleReadingsForChart(
  readings: SensorReading[],
  timeRange: TimeRange,
): SensorReading[] {
  const step = getSamplingStep(timeRange);

  // Kis mintánál ne dobjunk el pontokat, mert félrevezető lesz a görbe.
  if (step === 1 || readings.length < step * 8) {
    return readings;
  }

  return readings.filter((_, index) => index % step === 0);
}
