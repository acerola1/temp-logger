import type { CuttingEvent } from './events';
import type { IsoDateString, IsoDateTimeString } from './datetime';
import type { Photo } from '../features/photos/photoMetadata';

export type { CuttingEvent, CuttingEventType } from './events';

export type CuttingPlantType = 'graft' | 'cutting';
export type CuttingStatus = 'active' | 'lost' | 'archived';

// A dugványfotó a közös fotó-metaadat; saját mezője nincs.
export type CuttingPhoto = Photo;

export interface Cutting {
  id: string;
  serialNumber: number;
  variety: string;
  plantType: CuttingPlantType;
  plantedAt: IsoDateString;
  status: CuttingStatus;
  categories: string[];
  notes: string;
  photos: CuttingPhoto[];
  events: CuttingEvent[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUid: string | null;
}

export interface CreateCuttingInput {
  serialNumber: number;
  variety: string;
  plantType: CuttingPlantType;
  plantedAt: string;
  status: CuttingStatus;
  categories: string[];
  notes: string;
  photos: CuttingPhoto[];
}
