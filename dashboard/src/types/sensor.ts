export interface SensorReading {
  id: string;
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt: string;
  createdAt: string;
  sessionId?: string;
}

export type TimeRange = '24h' | '7d' | '30d';

export interface Session {
  id: string;
  name: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
  createdAt: string;
}
