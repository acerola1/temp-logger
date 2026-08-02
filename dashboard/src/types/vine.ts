import type { IsoDateString, IsoDateTimeString } from './datetime';

export type VineRootstockType = 'grafted' | 'own_rooted' | 'unknown';
export type VineStatus = 'active' | 'removed';
export type VineEventType = 'observation' | 'pruning' | 'spraying' | 'removal';

// A telepítési idő ismerete tőkénként eltér: van pontos dátum, van csak év, és
// van, ahol semmi. Ezért nem egy nullable dátum, hanem explicit pontosság.
export type VinePlantedAt =
  | { precision: 'date'; date: IsoDateString }
  | { precision: 'year'; year: number }
  | { precision: 'unknown' };

export interface VineEventPhoto {
  id: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export interface VineEvent {
  id: string;
  type: VineEventType;
  occurredAt: IsoDateTimeString;
  title: string;
  notes: string;
  photos: VineEventPhoto[];
}

export interface Vine {
  id: string;
  serialNumber: number;
  variety: string;
  hasFruited: boolean;
  rootstockType: VineRootstockType;
  rootstockVariety: string;
  plantedAt: VinePlantedAt;
  areaDescription: string;
  status: VineStatus;
  tags: string[];
  notes: string;
  // Csak navigációs link egy dugványra. Nem örököl és nem szinkronizál adatot.
  sourceCuttingId: string | null;
  events: VineEvent[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export type CreateVineInput = Omit<Vine, 'id' | 'events' | 'createdAt' | 'updatedAt'>;
