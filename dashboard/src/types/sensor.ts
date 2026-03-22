export interface SensorReading {
  id: string;
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt: string;
  createdAt: string;
}

export type TimeRange = '24h' | '7d' | '30d';
