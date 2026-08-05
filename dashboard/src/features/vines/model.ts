import type { Photo, PhotoThumbnail } from '../photos/photoMetadata';
import type { IsoDateString, IsoDateTimeString } from '../../types/datetime';

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

// A tőkefotó ugyanaz a közös fotó-metaadat, mint a dugványfotó. A fotó nem
// hordoz eseményhivatkozást: a tőke önálló képe, nem egy esemény melléklete.
export type VinePhoto = Photo;

// A fotó kis változata: a lista és a bélyegrács kis keretei ezt töltik le.
export type VinePhotoThumbnail = PhotoThumbnail;

export interface VineEvent {
  id: string;
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
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
  photos: VinePhoto[];
  /** `null` esetén a borító automatikus: a legutóljára fényképezett kép. */
  coverPhotoId: string | null;
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

// Az eseményrögzítés nem fogad fotófájlt: a fotó külön tőkeművelet.
export interface AddVineEventsInput {
  targetVineIds: string[];
  openedVineId?: string;
  event: VineEventDetailsInput;
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

export interface AddVinePhotosInput {
  vineId: string;
  photos: File[];
}

export interface DeleteVinePhotoInput {
  vineId: string;
  photoId: string;
}

export interface EditVinePhotoCaptionInput {
  vineId: string;
  photoId: string;
  caption: string;
}

export interface SetVineCoverPhotoInput {
  vineId: string;
  /** `null` a kijelölés visszavonása, azaz visszatérés az automatikus borítóra. */
  photoId: string | null;
}

export const MAX_VINE_EVENT_TARGETS = 400;

// Tőkénkénti biztonsági korlát. A fotók a tőke dokumentumába beágyazva élnek,
// ezért a tömb nem nőhet korlátlanul; a 100 nem használati, hanem
// dokumentumméret-korlát, ezért csak a kapacitás közelében látszik a felületen.
export const MAX_VINE_PHOTOS = 100;
