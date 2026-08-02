export type IsoDateString = string;
export type IsoDateTimeString = string;

export const VINE_STATUSES = ['active', 'ceased'] as const;
export type VineStatus = (typeof VINE_STATUSES)[number];

export const VINE_ROOT_TYPES = ['grafted', 'own_rooted', 'unknown'] as const;
export type VineRootType = (typeof VINE_ROOT_TYPES)[number];

export const VINE_EVENT_TYPES = ['observation', 'pruning', 'spraying', 'ceased'] as const;
export type VineEventType = (typeof VINE_EVENT_TYPES)[number];

export type VinePlantingDate =
  | { precision: 'date'; date: IsoDateString }
  | { precision: 'year'; year: number }
  | { precision: 'unknown' };

export interface VineEventPhoto {
  id: string;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  uploadedAt: IsoDateTimeString;
}

export interface VineEvent {
  id: string;
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
  photos: VineEventPhoto[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface Vine {
  id: string;
  serialNumber: number;
  variety: string;
  hasFruited: boolean;
  rootType: VineRootType;
  rootstockVariety: string;
  plantingDate: VinePlantingDate;
  areaDescription: string;
  status: VineStatus;
  tags: string[];
  notes: string;
  sourceCuttingId: string | null;
  events: VineEvent[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUid: string | null;
}

export interface CreateVineInput {
  variety: string;
  hasFruited: boolean;
  rootType: VineRootType;
  rootstockVariety: string;
  plantingDate: VinePlantingDate;
  areaDescription: string;
  status: VineStatus;
  tags: string[];
  notes: string;
  sourceCuttingId: string | null;
}

export type EditVineInput = CreateVineInput;

export interface VineEventDetailsInput {
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
}

export interface AddVineEventsInput {
  targetVineIds: string[];
  openedVineId?: string;
  event: VineEventDetailsInput;
  photos: File[];
}

export interface EditVineEventInput {
  vineId: string;
  eventId: string;
  event: VineEventDetailsInput;
}

export interface DeleteVineEventInput {
  vineId: string;
  eventId: string;
}

export const MAX_VINE_EVENT_TARGETS = 400;
