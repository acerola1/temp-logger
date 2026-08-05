import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { db, storage } from '../../lib/firebase';
import {
  addCuttingPhotos as addCuttingPhotosTransaction,
  deleteCuttingPhoto as deleteCuttingPhotoTransaction,
  editCuttingPhotoCaption as editCuttingPhotoCaptionTransaction,
  mapCuttingPhotos,
} from '../../features/cuttings/firestoreCuttingPhotos';
import type {
  CreateCuttingInput,
  Cutting,
  CuttingEvent,
  CuttingPhoto,
} from '../../types/cutting';
import { useAuth } from '../useAuth';
import { useFirestoreRealtimeQuery } from './firestoreRealtime';

interface FirestoreCutting {
  serialNumber?: number;
  variety?: string;
  plantType?: Cutting['plantType'];
  plantedAt?: string;
  status?: Cutting['status'];
  categories?: string[];
  notes?: string;
  photos?: CuttingPhoto[];
  events?: CuttingEvent[];
  wateringLogs?: LegacyFirestoreCuttingWateringLog[];
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string | null;
}

interface LegacyFirestoreCuttingWateringLog {
  id?: string;
  wateredAt?: string;
  occurredAt?: string;
  type?: CuttingEvent['type'];
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
    type: log.type ?? 'watering',
    title: log.title?.trim() || 'Esemény',
    notes: log.notes ?? '',
  } satisfies CuttingEvent;
}

export function useCuttingsQuery() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const cuttingsQuery = useMemo(
    () => query(collection(db, 'cuttings'), orderBy('plantedAt', 'desc')),
    [],
  );

  const mapCuttings = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data() as FirestoreCutting;
        const mappedPhotos = mapCuttingPhotos(data.photos, snapshotDoc.id);

        return {
          id: snapshotDoc.id,
          serialNumber: typeof data.serialNumber === 'number' ? data.serialNumber : 0,
          variety: data.variety ?? 'Ismeretlen fajta',
          plantType: data.plantType ?? 'cutting',
          plantedAt: data.plantedAt ?? data.createdAt ?? new Date(0).toISOString(),
          status: data.status ?? 'active',
          categories: Array.isArray(data.categories)
            ? data.categories.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : [],
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

  const queryKey = ['cuttings'] as const;

  const { data, loading, error } = useFirestoreRealtimeQuery({
    queryKey,
    queryRef: cuttingsQuery,
    initialData: EMPTY_CUTTINGS,
    mapSnapshot: mapCuttings,
    onErrorMessage: 'Nem sikerült betölteni a dugványokat.',
  });

  const createCuttingMutation = useMutation({
    mutationFn: async ({ cuttingId, input }: { cuttingId: string; input: CreateCuttingInput }) => {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'cuttings', cuttingId), {
        serialNumber: input.serialNumber,
        variety: input.variety.trim(),
        plantType: input.plantType,
        plantedAt: input.plantedAt,
        status: input.status,
        categories: input.categories,
        notes: input.notes.trim(),
        photos: input.photos,
        events: [],
        createdAt: now,
        updatedAt: now,
        createdByUid: user?.uid ?? null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });

  const updateCuttingMutation = useMutation({
    mutationFn: async ({ cuttingId, updates }: { cuttingId: string; updates: Partial<Omit<Cutting, 'id'>> }) => {
      await updateDoc(doc(db, 'cuttings', cuttingId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });

  const addPhotosMutation = useMutation({
    mutationFn: async ({ cuttingId, photos }: { cuttingId: string; photos: CuttingPhoto[] }) => {
      await addCuttingPhotosTransaction(db, storage, cuttingId, photos);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });

  const editPhotoCaptionMutation = useMutation({
    mutationFn: async ({
      cuttingId,
      photoId,
      caption,
    }: {
      cuttingId: string;
      photoId: string;
      caption: string;
    }) => {
      await editCuttingPhotoCaptionTransaction(db, cuttingId, photoId, caption);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async ({ cuttingId, photoId }: { cuttingId: string; photoId: string }) => {
      await deleteCuttingPhotoTransaction(db, storage, cuttingId, photoId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });

  const photoMutationPending =
    addPhotosMutation.isPending ||
    editPhotoCaptionMutation.isPending ||
    deletePhotoMutation.isPending;
  const photoMutationError =
    addPhotosMutation.error ?? editPhotoCaptionMutation.error ?? deletePhotoMutation.error;

  const resetPhotoErrors = () => {
    addPhotosMutation.reset();
    editPhotoCaptionMutation.reset();
    deletePhotoMutation.reset();
  };

  return {
    data,
    loading,
    error,
    isCreating: createCuttingMutation.isPending,
    isUpdating: updateCuttingMutation.isPending || photoMutationPending,
    createError: createCuttingMutation.error,
    updateError: photoMutationError ?? updateCuttingMutation.error,
    resetCreateError: createCuttingMutation.reset,
    resetUpdateError: () => {
      updateCuttingMutation.reset();
      resetPhotoErrors();
    },
    createCutting: async (cuttingId: string, input: CreateCuttingInput) => {
      createCuttingMutation.reset();
      return createCuttingMutation.mutateAsync({ cuttingId, input });
    },
    updateCutting: async (cuttingId: string, updates: Partial<Omit<Cutting, 'id'>>) => {
      updateCuttingMutation.reset();
      return updateCuttingMutation.mutateAsync({ cuttingId, updates });
    },
    addCuttingPhotos: async (cuttingId: string, photos: CuttingPhoto[]) => {
      addPhotosMutation.reset();
      return addPhotosMutation.mutateAsync({ cuttingId, photos });
    },
    editCuttingPhotoCaption: async (cuttingId: string, photoId: string, caption: string) => {
      editPhotoCaptionMutation.reset();
      return editPhotoCaptionMutation.mutateAsync({ cuttingId, photoId, caption });
    },
    deleteCuttingPhoto: async (cuttingId: string, photoId: string) => {
      deletePhotoMutation.reset();
      return deletePhotoMutation.mutateAsync({ cuttingId, photoId });
    },
  };
}
