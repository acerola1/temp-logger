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

export interface CuttingEvent extends BaseEvent {
  notes: string;
}

export interface SessionEventInput extends BaseEventInput {
  description: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}
