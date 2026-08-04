import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, storage } from '../../lib/firebase';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../hooks/useAuth';
import {
  addEventPhotos as addFirestoreEventPhotos,
  addEvents as addFirestoreEvents,
  createVine as createFirestoreVine,
  deleteEvent as deleteFirestoreEvent,
  deleteEventPhoto as deleteFirestoreEventPhoto,
  editEvent as editFirestoreEvent,
  editEventPhotoCaption as editFirestoreEventPhotoCaption,
  editVine as editFirestoreVine,
  setCoverPhoto as setFirestoreCoverPhoto,
  subscribeToVines,
} from './firestoreVines';
import type {
  AddVineEventPhotosInput,
  AddVineEventsInput,
  CreateVineInput,
  DeleteVineEventInput,
  DeleteVineEventPhotoInput,
  EditVineEventInput,
  EditVineEventPhotoCaptionInput,
  EditVineInput,
  SetVineCoverPhotoInput,
  Vine,
} from './model';

export interface VineCatalogMutationState {
  pending: boolean;
  error: string | null;
  uploadProgress: number | null;
}

export interface VineCatalog {
  vines: readonly Vine[];
  tagSuggestions: readonly string[];
  loadingVines: boolean;
  error: string | null;
  mutation: VineCatalogMutationState;
  createVine(input: CreateVineInput): Promise<{ vineId: string }>;
  editVine(vineId: string, input: EditVineInput): Promise<void>;
  addEvents(input: AddVineEventsInput): Promise<void>;
  editEvent(input: EditVineEventInput): Promise<void>;
  deleteEvent(input: DeleteVineEventInput): Promise<void>;
  addEventPhotos(input: AddVineEventPhotosInput): Promise<void>;
  deleteEventPhoto(input: DeleteVineEventPhotoInput): Promise<void>;
  editEventPhotoCaption(input: EditVineEventPhotoCaptionInput): Promise<void>;
  setCoverPhoto(input: SetVineCoverPhotoInput): Promise<void>;
  clearMutationError(): void;
}

export function getNextVineSerialNumber(vines: readonly Vine[]): number {
  return vines.reduce(
    (highest, vine) => Math.max(highest, vine.serialNumber),
    0,
  ) + 1;
}

export function getVineTagSuggestions(vines: readonly Vine[]): string[] {
  const suggestions = new Map<string, string>();

  for (const vine of vines) {
    for (const candidate of vine.tags) {
      const tag = candidate.trim();
      const key = tag.toLocaleLowerCase('hu');
      if (tag && !suggestions.has(key)) {
        suggestions.set(key, tag);
      }
    }
  }

  return [...suggestions.values()].sort((left, right) => left.localeCompare(right, 'hu'));
}

const INITIAL_MUTATION: VineCatalogMutationState = {
  pending: false,
  error: null,
  uploadProgress: null,
};

export function useVineCatalog(): VineCatalog {
  const { user } = useAuth();
  const [vines, setVines] = useState<Vine[]>([]);
  const [loadingVines, setLoadingVines] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutation, setMutation] = useState(INITIAL_MUTATION);
  const hasLoadedVines = useRef(false);
  const highestAllocatedSerialNumber = useRef(0);

  useEffect(
    () =>
      subscribeToVines(
        db,
        (nextVines) => {
          const highestLoadedSerialNumber = getNextVineSerialNumber(nextVines) - 1;
          highestAllocatedSerialNumber.current = Math.max(
            highestAllocatedSerialNumber.current,
            highestLoadedSerialNumber,
          );
          hasLoadedVines.current = true;
          setVines(nextVines);
          setLoadingVines(false);
          setError(null);
        },
        (subscriptionError) => {
          console.error('Firestore vines subscription error:', subscriptionError);
          setLoadingVines(false);
          setError('Nem sikerült betölteni a tőkéket.');
        },
      ),
    [],
  );

  const runMutation = useCallback(
    async <T,>(
      operation: (reportProgress: (progress: number) => void) => Promise<T>,
      fallbackError = 'Nem sikerült menteni a tőkét.',
    ): Promise<T> => {
      setMutation({ pending: true, error: null, uploadProgress: null });

      try {
        const result = await operation((progress) => {
          setMutation((current) => ({ ...current, uploadProgress: progress }));
        });
        setMutation(INITIAL_MUTATION);
        return result;
      } catch (mutationError) {
        setMutation({
          pending: false,
          error: mutationError instanceof Error && mutationError.message.startsWith('Firebase')
            ? fallbackError
            : getErrorMessage(mutationError, fallbackError),
          uploadProgress: null,
        });
        throw mutationError;
      }
    },
    [],
  );

  const createVine = useCallback(
    (input: CreateVineInput) =>
      runMutation(async () => {
        if (!hasLoadedVines.current) {
          throw new Error('A tőkék betöltéséig nem lehet új tőkét létrehozni.');
        }

        const reservedSerialNumber = highestAllocatedSerialNumber.current + 1;
        highestAllocatedSerialNumber.current = reservedSerialNumber;
        const result = await createFirestoreVine(
          db,
          user?.uid ?? null,
          reservedSerialNumber,
          input,
        );
        return { vineId: result.vineId };
      }),
    [runMutation, user?.uid],
  );

  const editVine = useCallback(
    (vineId: string, input: EditVineInput) =>
      runMutation(() => editFirestoreVine(db, vineId, input)),
    [runMutation],
  );

  const addEvents = useCallback(
    (input: AddVineEventsInput) =>
      runMutation(
        (reportProgress) => addFirestoreEvents(db, storage, input, reportProgress),
        'Nem sikerült menteni az eseményt.',
      ),
    [runMutation],
  );

  const editEvent = useCallback(
    (input: EditVineEventInput) =>
      runMutation(() => editFirestoreEvent(db, input), 'Nem sikerült szerkeszteni az eseményt.'),
    [runMutation],
  );

  const deleteEvent = useCallback(
    (input: DeleteVineEventInput) =>
      runMutation(
        () => deleteFirestoreEvent(db, storage, input),
        'Nem sikerült törölni az eseményt.',
      ),
    [runMutation],
  );

  const addEventPhotos = useCallback(
    (input: AddVineEventPhotosInput) =>
      runMutation(
        (reportProgress) => addFirestoreEventPhotos(db, storage, input, reportProgress),
        'Nem sikerült feltölteni a fotókat.',
      ),
    [runMutation],
  );

  const deleteEventPhoto = useCallback(
    (input: DeleteVineEventPhotoInput) =>
      runMutation(
        () => deleteFirestoreEventPhoto(db, storage, input),
        'Nem sikerült törölni a fotót.',
      ),
    [runMutation],
  );

  const editEventPhotoCaption = useCallback(
    (input: EditVineEventPhotoCaptionInput) =>
      runMutation(
        () => editFirestoreEventPhotoCaption(db, input),
        'Nem sikerült menteni a képaláírást.',
      ),
    [runMutation],
  );

  const setCoverPhoto = useCallback(
    (input: SetVineCoverPhotoInput) =>
      runMutation(
        () => setFirestoreCoverPhoto(db, input),
        'Nem sikerült menteni a borítóképet.',
      ),
    [runMutation],
  );

  const tagSuggestions = useMemo(() => getVineTagSuggestions(vines), [vines]);
  const clearMutationError = useCallback(() => {
    setMutation((current) => current.error ? { ...current, error: null } : current);
  }, []);

  return {
    vines,
    tagSuggestions,
    loadingVines,
    error,
    mutation,
    createVine,
    editVine,
    addEvents,
    editEvent,
    deleteEvent,
    addEventPhotos,
    deleteEventPhoto,
    editEventPhotoCaption,
    setCoverPhoto,
    clearMutationError,
  };
}
