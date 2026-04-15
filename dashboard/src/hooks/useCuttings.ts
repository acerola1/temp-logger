import { useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  CreateCuttingInput,
  Cutting,
  CuttingEvent,
  CuttingPhoto,
} from '../types/cutting';
import { useFirestoreCollection } from './useFirestoreSubscription';
import { useAuth } from './useAuth';

interface FirestoreCutting {
  serialNumber?: number;
  variety?: string;
  plantType?: Cutting['plantType'];
  plantedAt?: string;
  status?: Cutting['status'];
  notes?: string;
  photos?: CuttingPhoto[];
  events?: CuttingEvent[];
  wateringLogs?: LegacyFirestoreCuttingWateringLog[];
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string | null;
}

interface LegacyFirestoreCuttingPhoto {
  id?: string;
  storagePath?: string;
  downloadUrl?: string;
  url?: string;
  capturedAt?: string | null;
  uploadedAt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

interface LegacyFirestoreCuttingWateringLog {
  id?: string;
  wateredAt?: string;
  occurredAt?: string;
  title?: string;
  notes?: string;
}

const EMPTY_CUTTINGS: Cutting[] = [];

function mapLegacyLogToEvent(
  log: LegacyFirestoreCuttingWateringLog,
  fallbackIdPrefix: string,
  index: number,
): CuttingEvent | null {
  const occurredAt = log.occurredAt ?? log.wateredAt;
  if (!occurredAt) {
    return null;
  }

  return {
    id: log.id ?? `${fallbackIdPrefix}-event-${index}`,
    occurredAt,
    title: log.title?.trim() || 'Esemény',
    notes: log.notes ?? '',
  } satisfies CuttingEvent;
}

export function useCuttings() {
  const { user } = useAuth();

  const cuttingsQuery = useMemo(
    () => query(collection(db, 'cuttings'), orderBy('plantedAt', 'desc')),
    [],
  );

  const mapCuttings = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data() as FirestoreCutting;
        const mappedPhotos = Array.isArray(data.photos)
          ? data.photos
              .map((photo, index) => {
                const legacyPhoto = photo as LegacyFirestoreCuttingPhoto;
                const url = legacyPhoto.url ?? legacyPhoto.downloadUrl ?? '';

                if (!url) {
                  return null;
                }

                return {
                  id: legacyPhoto.id ?? `${snapshotDoc.id}-photo-${index}`,
                  storagePath: legacyPhoto.storagePath ?? '',
                  downloadUrl: url,
                  capturedAt: legacyPhoto.capturedAt ?? null,
                  uploadedAt: legacyPhoto.uploadedAt ?? new Date(0).toISOString(),
                  width: legacyPhoto.width ?? 0,
                  height: legacyPhoto.height ?? 0,
                  caption: legacyPhoto.caption ?? '',
                } satisfies CuttingPhoto;
              })
              .filter((photo): photo is CuttingPhoto => photo !== null)
          : [];

        return {
          id: snapshotDoc.id,
          serialNumber: typeof data.serialNumber === 'number' ? data.serialNumber : 0,
          variety: data.variety ?? 'Ismeretlen fajta',
          plantType: data.plantType ?? 'cutting',
          plantedAt: data.plantedAt ?? data.createdAt ?? new Date(0).toISOString(),
          status: data.status ?? 'active',
          notes: data.notes ?? '',
          photos: mappedPhotos,
          events: Array.isArray(data.events)
            ? data.events
                .map((log, index) =>
                  mapLegacyLogToEvent(log as LegacyFirestoreCuttingWateringLog, snapshotDoc.id, index),
                )
                .filter((log): log is CuttingEvent => log !== null)
            : Array.isArray(data.wateringLogs)
              ? data.wateringLogs
                  .map((log, index) =>
                    mapLegacyLogToEvent(log as LegacyFirestoreCuttingWateringLog, snapshotDoc.id, index),
                  )
                  .filter((log): log is CuttingEvent => log !== null)
            : [],
          createdAt: data.createdAt ?? new Date(0).toISOString(),
          updatedAt: data.updatedAt ?? data.createdAt ?? new Date(0).toISOString(),
          createdByUid: data.createdByUid ?? null,
        } satisfies Cutting;
      }),
    [],
  );

  const subscription = useFirestoreCollection(cuttingsQuery, mapCuttings, {
    initialData: EMPTY_CUTTINGS,
    onErrorMessage: 'Nem sikerült betölteni a dugványokat.',
  });

  const createCutting = useCallback(
    async (cuttingId: string, input: CreateCuttingInput) => {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'cuttings', cuttingId), {
        serialNumber: input.serialNumber,
        variety: input.variety.trim(),
        plantType: input.plantType,
        plantedAt: input.plantedAt,
        status: input.status,
        notes: input.notes.trim(),
        photos: input.photos,
        events: [],
        createdAt: now,
        updatedAt: now,
        createdByUid: user?.uid ?? null,
      });
    },
    [user],
  );

  const updateCutting = useCallback(
    async (cuttingId: string, updates: Partial<Omit<Cutting, 'id'>>) => {
      await updateDoc(doc(db, 'cuttings', cuttingId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  return {
    ...subscription,
    createCutting,
    updateCutting,
  };
}
