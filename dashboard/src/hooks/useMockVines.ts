import { useCallback, useState } from 'react';
import { createMockVines } from '../data/mockVines';
import type { CreateVineInput, Vine } from '../types/vine';

/**
 * Prototípus tároló. Ugyanazt a felületet adja, mint a `useCuttingsQuery`, de
 * kizárólag memóriában dolgozik: nincs Firestore, nincs Storage, nincs auth.
 * Az éles verzióban ezt a hookot kell lecserélni a valódi query hookra.
 */
export function useMockVines() {
  const [vines, setVines] = useState<Vine[]>(() => createMockVines());
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  const createVine = useCallback(async (vineId: string, input: CreateVineInput) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const now = new Date().toISOString();
      setVines((current) => [
        ...current,
        { ...input, id: vineId, events: [], createdAt: now, updatedAt: now },
      ]);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setCreateError(normalized);
      throw normalized;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateVine = useCallback(
    async (vineId: string, updates: Partial<Omit<Vine, 'id'>>) => {
      setIsUpdating(true);
      setUpdateError(null);
      try {
        setVines((current) =>
          current.map((vine) =>
            vine.id === vineId ? { ...vine, ...updates, updatedAt: new Date().toISOString() } : vine,
          ),
        );
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        setUpdateError(normalized);
        throw normalized;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  // Prototípus kényelem: a dugványok Firestore-ból, aszinkron érkeznek, ezért a
  // bemutató hivatkozást csak utólag tudjuk beakasztani. Egyszer fut le, és nem
  // nyúl az updatedAt mezőhöz, hogy a lista sorrendje ne ugorjon el.
  const linkDemoCutting = useCallback((cuttingId: string) => {
    setVines((current) =>
      current.some((vine) => vine.sourceCuttingId !== null)
        ? current
        : current.map((vine) =>
            vine.id === 'vine-12' ? { ...vine, sourceCuttingId: cuttingId } : vine,
          ),
    );
  }, []);

  const resetMockVines = useCallback(() => {
    setVines(createMockVines());
    setCreateError(null);
    setUpdateError(null);
  }, []);

  return {
    data: vines,
    loading: false,
    error: null as string | null,
    isCreating,
    isUpdating,
    createError,
    updateError,
    resetCreateError: useCallback(() => setCreateError(null), []),
    resetUpdateError: useCallback(() => setUpdateError(null), []),
    createVine,
    updateVine,
    linkDemoCutting,
    resetMockVines,
  };
}
