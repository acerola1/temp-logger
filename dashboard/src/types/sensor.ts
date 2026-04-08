export interface SensorReading {
  id: string;
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt: string;
  sessionId?: string;
}

export type TimeRange = '24h' | '7d' | '30d';

export interface Session {
  id: string;
  deviceId: string;
  name: string;
  sessionTypeId: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
}

export interface SessionEvent {
  id: string;
  deviceId: string;
  sessionId: string;
  title: string;
  description: string;
  occurredAt: string;
  imageUrl: string | null;
  imageStoragePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
}

export interface SessionType {
  id: string;
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
}
