import type { SensorReading } from '../types/sensor';

export interface TimeSeriesPoint {
  recordedAtMs: number;
  temperatureC: number | null;
  humidity: number | null;
}

const kFallbackGapThresholdMs = 45 * 60 * 1000;
const kMinDynamicGapThresholdMs = 5 * 60 * 1000;
const kDynamicGapMultiplier = 2.5;

function getGapThresholdMs(readings: SensorReading[]): number {
  if (readings.length < 3) {
    return kFallbackGapThresholdMs;
  }

  const intervals = readings
    .slice(1)
    .map((reading, index) => {
      const previousAt = new Date(readings[index].recordedAt).getTime();
      const currentAt = new Date(reading.recordedAt).getTime();
      return currentAt - previousAt;
    })
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((a, b) => a - b);

  if (intervals.length === 0) {
    return kFallbackGapThresholdMs;
  }

  const medianInterval = intervals[Math.floor((intervals.length - 1) / 2)];
  return Math.max(
    kFallbackGapThresholdMs,
    Math.max(kMinDynamicGapThresholdMs, medianInterval * kDynamicGapMultiplier),
  );
}

export function buildChartSeries(readings: SensorReading[]): TimeSeriesPoint[] {
  if (readings.length === 0) {
    return [];
  }

  const sortedReadings = readings.slice().sort((left, right) => {
    return new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime();
  });

  const gapThresholdMs = getGapThresholdMs(sortedReadings);
  const points: TimeSeriesPoint[] = [];

  for (let index = 0; index < sortedReadings.length; index += 1) {
    const reading = sortedReadings[index];
    const recordedAtMs = new Date(reading.recordedAt).getTime();

    if (!Number.isFinite(recordedAtMs)) {
      continue;
    }

    if (points.length > 0) {
      const previousPoint = points[points.length - 1];
      const gapMs = recordedAtMs - previousPoint.recordedAtMs;

      if (gapMs > gapThresholdMs) {
        points.push({
          recordedAtMs: previousPoint.recordedAtMs + Math.floor(gapMs / 2),
          temperatureC: null,
          humidity: null,
        });
      }
    }

    points.push({
      recordedAtMs,
      temperatureC: reading.temperatureC,
      humidity: reading.humidity,
    });
  }

  return points;
}
