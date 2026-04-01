import type { SensorReading } from '../types/sensor';

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateReadings(): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date();
  const intervalMs = 15 * 60 * 1000;
  const totalPoints = 30 * 24 * 4; // 30 days, 15-min intervals

  for (let i = totalPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60;

    // Diurnal temperature pattern: peaks at ~14:00, lowest at ~5:00
    const diurnalPhase = ((hour - 14) / 24) * 2 * Math.PI;
    const baseTemp = 25 + 3 * Math.cos(diurnalPhase);
    const noise = (seededRandom(i * 7 + 1) - 0.5) * 1.0;
    const temperatureC = Math.round((baseTemp + noise) * 10) / 10;

    // Humidity inversely correlated with temperature
    const baseHumidity = 90 - 5 * Math.cos(diurnalPhase);
    const humNoise = (seededRandom(i * 13 + 3) - 0.5) * 4.0;
    const humidity = Math.round(Math.min(99, Math.max(60, baseHumidity + humNoise)) * 10) / 10;

    const iso = timestamp.toISOString();

    readings.push({
      id: `reading-${i}`,
      deviceId: 'esp32-lab',
      temperatureC,
      humidity,
      recordedAt: iso,
    });
  }

  return readings;
}

export const mockReadings: SensorReading[] = generateReadings();
