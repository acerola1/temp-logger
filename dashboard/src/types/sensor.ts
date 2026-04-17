import type { BaseEvent } from './events';
import type { IsoDateTimeString } from './datetime';

export interface SensorReading {
  id: string;
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt: IsoDateTimeString;
  sessionId?: string;
}

export type TimeRange = '24h' | '7d' | '30d';

export interface Session {
  id: string;
  deviceId: string;
  name: string;
  sessionTypeId: string;
  status: 'active' | 'archived';
  startDate: IsoDateTimeString;
  endDate: IsoDateTimeString | null;
}

export interface SessionEvent extends BaseEvent {
  id: string;
  deviceId: string;
  sessionId: string;
  description: string;
  imageUrl: string | null;
  imageStoragePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
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
