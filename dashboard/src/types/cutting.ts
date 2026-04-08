export type CuttingPlantType = 'graft' | 'cutting';
export type CuttingStatus = 'active' | 'rooted' | 'lost' | 'archived';

export interface CuttingPhoto {
  id: string;
  storagePath: string;
  downloadUrl: string;
  capturedAt: string | null;
  uploadedAt: string;
  width: number;
  height: number;
  caption: string;
}

export interface CuttingWateringLog {
  id: string;
  wateredAt: string;
  notes: string;
}

export interface Cutting {
  id: string;
  serialNumber: number;
  variety: string;
  plantType: CuttingPlantType;
  plantedAt: string;
  status: CuttingStatus;
  notes: string;
  photos: CuttingPhoto[];
  wateringLogs: CuttingWateringLog[];
  createdAt: string;
  updatedAt: string;
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
