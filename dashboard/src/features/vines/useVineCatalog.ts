import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../lib/firebase';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../hooks/useAuth';
import {
  createVine as createFirestoreVine,
  editVine as editFirestoreVine,
  subscribeToVines,
} from './firestoreVines';
import type { CreateVineInput, EditVineInput, Vine } from './model';

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

  const runMutation = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setMutation({ pending: true, error: null, uploadProgress: null });

    try {
      const result = await operation();
      setMutation(INITIAL_MUTATION);
      return result;
    } catch (mutationError) {
      setMutation({
        pending: false,
        error: getErrorMessage(mutationError, 'Nem sikerült menteni a tőkét.'),
        uploadProgress: null,
      });
      throw mutationError;
    }
  }, []);

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

  const tagSuggestions = useMemo(() => getVineTagSuggestions(vines), [vines]);

  return {
    vines,
    tagSuggestions,
    loadingVines,
    error,
    mutation,
    createVine,
    editVine,
  };
}
