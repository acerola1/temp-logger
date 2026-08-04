import type { Photo } from '../photos/photoMetadata';
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

// A tőkeeseményfotó ugyanaz a közös fotó-metaadat, mint a dugványfotó.
export type VineEventPhoto = Photo;

/**
 * A kijelölt borítókép mutatója. A tőke gyökerén él, nem a fotórekordban: így az
 * áthelyezés egyetlen mezőt ír, és nem állhat elő két elsődleges kép.
 */
export interface VineCoverPhotoRef {
  eventId: string;
  photoId: string;
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
  /** `null` esetén a borító automatikus: a legutóljára fényképezett kép. */
  coverPhoto: VineCoverPhotoRef | null;
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

export interface AddVineEventPhotosInput {
  vineId: string;
  eventId: string;
  photos: File[];
}

export interface DeleteVineEventPhotoInput {
  vineId: string;
  eventId: string;
  photoId: string;
}

export interface EditVineEventPhotoCaptionInput {
  vineId: string;
  eventId: string;
  photoId: string;
  caption: string;
}

export interface SetVineCoverPhotoInput {
  vineId: string;
  /** `null` a kijelölés visszavonása, azaz visszatérés az automatikus borítóra. */
  coverPhoto: VineCoverPhotoRef | null;
}

export const MAX_VINE_EVENT_TARGETS = 400;

// Eseményenkénti fotókorlát. Egy választásból legfeljebb hat kép jön
// (`DEFAULT_MAX_SELECTED_PHOTOS`), tehát két teli kör belefér, a fotók viszont a
// tőke dokumentumába beágyazva élnek: a tömb nem nőhet korlátlanul.
export const MAX_VINE_EVENT_PHOTOS = 12;
