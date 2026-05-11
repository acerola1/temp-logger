import type { IsoDateTimeString } from './datetime';

export interface BaseEvent {
  id: string;
  occurredAt: IsoDateTimeString;
  title: string;
}

export interface BaseEventInput {
  occurredAt: IsoDateTimeString;
  title: string;
}

export type CuttingEventType = 'watering' | 'handover' | 'planting_out' | 'perished';

export interface CuttingEvent extends BaseEvent {
  type: CuttingEventType;
  notes: string;
}

export interface SessionEventInput extends BaseEventInput {
  description: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}
