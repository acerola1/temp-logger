import type { CuttingEvent } from './events';
import type { IsoDateString, IsoDateTimeString } from './datetime';

export type { CuttingEvent } from './events';

export type CuttingPlantType = 'graft' | 'cutting';
export type CuttingStatus = 'active' | 'rooted' | 'lost' | 'archived';

export interface CuttingPhoto {
  id: string;
  storagePath: string;
  downloadUrl: string;
  capturedAt: IsoDateTimeString | null;
  uploadedAt: IsoDateTimeString;
  width: number;
  height: number;
  caption: string;
}

export interface Cutting {
  id: string;
  serialNumber: number;
  variety: string;
  plantType: CuttingPlantType;
  plantedAt: IsoDateString;
  status: CuttingStatus;
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
  notes: string;
  photos: CuttingPhoto[];
}
