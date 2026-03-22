import { useMemo } from 'react';
import type { SensorReading, TimeRange } from '../types/sensor';

interface Stats {
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  minHumidity: number;
  maxHumidity: number;
  avgHumidity: number;
}

interface ReadingsResult {
  readings: SensorReading[];
  latest: SensorReading | null;
  stats: Stats;
}

const rangeMs: Record<TimeRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function useReadings(allReadings: SensorReading[], timeRange: TimeRange): ReadingsResult {
  return useMemo(() => {
    const cutoff = Date.now() - rangeMs[timeRange];
    const readings = allReadings.filter((r) => new Date(r.recordedAt).getTime() >= cutoff);

    const latest = readings.length > 0 ? readings[readings.length - 1] : null;

    if (readings.length === 0) {
      return {
        readings,
        latest,
        stats: { minTemp: 0, maxTemp: 0, avgTemp: 0, minHumidity: 0, maxHumidity: 0, avgHumidity: 0 },
      };
    }

    let minTemp = Infinity,
      maxTemp = -Infinity,
      sumTemp = 0;
    let minHumidity = Infinity,
      maxHumidity = -Infinity,
      sumHumidity = 0;

    for (const r of readings) {
      if (r.temperatureC < minTemp) minTemp = r.temperatureC;
      if (r.temperatureC > maxTemp) maxTemp = r.temperatureC;
      sumTemp += r.temperatureC;
      if (r.humidity < minHumidity) minHumidity = r.humidity;
      if (r.humidity > maxHumidity) maxHumidity = r.humidity;
      sumHumidity += r.humidity;
    }

    return {
      readings,
      latest,
      stats: {
        minTemp: Math.round(minTemp * 10) / 10,
        maxTemp: Math.round(maxTemp * 10) / 10,
        avgTemp: Math.round((sumTemp / readings.length) * 10) / 10,
        minHumidity: Math.round(minHumidity * 10) / 10,
        maxHumidity: Math.round(maxHumidity * 10) / 10,
        avgHumidity: Math.round((sumHumidity / readings.length) * 10) / 10,
      },
    };
  }, [allReadings, timeRange]);
}
