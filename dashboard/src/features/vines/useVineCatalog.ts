import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, storage } from '../../lib/firebase';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../hooks/useAuth';
import {
  addEvents as addFirestoreEvents,
  createVine as createFirestoreVine,
  deleteVine as deleteFirestoreVine,
  deleteEvent as deleteFirestoreEvent,
  deleteVinePhoto as deleteFirestoreVinePhoto,
  editEvent as editFirestoreEvent,
  editVinePhotoCaption as editFirestoreVinePhotoCaption,
  editVine as editFirestoreVine,
  setCoverPhoto as setFirestoreCoverPhoto,
  subscribeToVines,
  retryDeletedVinePhotoCleanup as retryFirestoreDeletedVinePhotoCleanup,
} from './firestoreVines';
import type {
  AddVineEventsInput,
  CreateVineInput,
  DeleteVineEventInput,
  DeleteVinePhotoInput,
  DeleteVineResult,
  EditVineEventInput,
  EditVinePhotoCaptionInput,
  EditVineInput,
  SetVineCoverPhotoInput,
  Vine,
} from './model';
import { getVineLocationSuggestions } from './vineLocations';
export { getNextVineSerialNumber } from './vineSerialNumber';

export interface VineCatalogMutationState {
  pending: boolean;
  error: string | null;
  uploadProgress: number | null;
}

export interface VineCatalog {
  vines: readonly Vine[];
  locationSuggestions: readonly string[];
  tagSuggestions: readonly string[];
  loadingVines: boolean;
  error: string | null;
  mutation: VineCatalogMutationState;
  createVine(input: CreateVineInput): Promise<{ vineId: string }>;
  deleteVine(
    vineId: string,
    additionalStoragePaths?: readonly string[],
  ): Promise<DeleteVineResult>;
  retryDeletedVinePhotoCleanup(storagePaths: readonly string[]): Promise<DeleteVineResult>;
  editVine(vineId: string, input: EditVineInput): Promise<void>;
  addEvents(input: AddVineEventsInput): Promise<void>;
  editEvent(input: EditVineEventInput): Promise<void>;
  deleteEvent(input: DeleteVineEventInput): Promise<void>;
  deleteVinePhoto(input: DeleteVinePhotoInput): Promise<void>;
  editVinePhotoCaption(input: EditVinePhotoCaptionInput): Promise<void>;
  setCoverPhoto(input: SetVineCoverPhotoInput): Promise<void>;
  clearMutationError(): void;
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

  useEffect(
    () =>
      subscribeToVines(
        db,
        (nextVines) => {
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

        const result = await createFirestoreVine(
          db,
          user?.uid ?? null,
          input,
        );
        return { vineId: result.vineId };
      }),
    [runMutation, user?.uid],
  );

  const deleteVine = useCallback(
    (vineId: string, additionalStoragePaths: readonly string[] = []) =>
      runMutation(
        () => deleteFirestoreVine(db, storage, vineId, additionalStoragePaths),
        'Nem sikerült végleg törölni a tőkét.',
      ),
    [runMutation],
  );

  const retryDeletedVinePhotoCleanup = useCallback(
    (storagePaths: readonly string[]) =>
      runMutation(
        () => retryFirestoreDeletedVinePhotoCleanup(storage, storagePaths),
        'Nem sikerült befejezni a képek törlését.',
      ),
    [runMutation],
  );

  const editVine = useCallback(
    (vineId: string, input: EditVineInput) =>
      runMutation(() => editFirestoreVine(db, vineId, input)),
    [runMutation],
  );

  const addEvents = useCallback(
    (input: AddVineEventsInput) =>
      runMutation(() => addFirestoreEvents(db, input), 'Nem sikerült menteni az eseményt.'),
    [runMutation],
  );

  const editEvent = useCallback(
    (input: EditVineEventInput) =>
      runMutation(() => editFirestoreEvent(db, input), 'Nem sikerült szerkeszteni az eseményt.'),
    [runMutation],
  );

  const deleteEvent = useCallback(
    (input: DeleteVineEventInput) =>
      runMutation(() => deleteFirestoreEvent(db, input), 'Nem sikerült törölni az eseményt.'),
    [runMutation],
  );

  const deleteVinePhoto = useCallback(
    (input: DeleteVinePhotoInput) =>
      runMutation(
        () => deleteFirestoreVinePhoto(db, storage, input),
        'Nem sikerült törölni a fotót.',
      ),
    [runMutation],
  );

  const editVinePhotoCaption = useCallback(
    (input: EditVinePhotoCaptionInput) =>
      runMutation(
        () => editFirestoreVinePhotoCaption(db, input),
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
  const locationSuggestions = useMemo(() => getVineLocationSuggestions(vines), [vines]);
  const clearMutationError = useCallback(() => {
    setMutation((current) => current.error ? { ...current, error: null } : current);
  }, []);

  return {
    vines,
    locationSuggestions,
    tagSuggestions,
    loadingVines,
    error,
    mutation,
    createVine,
    deleteVine,
    retryDeletedVinePhotoCleanup,
    editVine,
    addEvents,
    editEvent,
    deleteEvent,
    deleteVinePhoto,
    editVinePhotoCaption,
    setCoverPhoto,
    clearMutationError,
  };
}
