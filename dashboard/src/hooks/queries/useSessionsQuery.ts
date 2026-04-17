import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  doc,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Session } from '../../types/sensor';
import { useFirestoreRealtimeQuery } from './firestoreRealtime';

const EMPTY_SESSIONS: Session[] = [];

interface FirestoreSession {
  name: string;
  sessionTypeId: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
}

export function useSessionsQuery(deviceId: string | null) {
  const queryClient = useQueryClient();

  const sessionsQuery = useMemo(() => {
    if (!deviceId) {
      return null;
    }

    return query(collection(db, 'devices', deviceId, 'sessions'), orderBy('startDate', 'desc'));
  }, [deviceId]);

  const mapSessions = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((d) => {
        const data = d.data() as FirestoreSession;
        return {
          id: d.id,
          deviceId: deviceId!,
          name: data.name,
          sessionTypeId: data.sessionTypeId,
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate,
        } satisfies Session;
      }),
    [deviceId],
  );

  const { data: sessions, loading, error } = useFirestoreRealtimeQuery({
    queryKey: ['sessions', deviceId ?? 'none'],
    queryRef: sessionsQuery,
    enabled: !!sessionsQuery,
    initialData: EMPTY_SESSIONS,
    mapSnapshot: mapSessions,
    onErrorMessage: 'Nem sikerült betölteni a sessionöket.',
  });

  const createSessionMutation = useMutation({
    mutationFn: async ({ name, sessionTypeId }: { name: string; sessionTypeId: string }) => {
      if (!deviceId) return;

      await addDoc(collection(db, 'devices', deviceId, 'sessions'), {
        name,
        sessionTypeId,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', deviceId ?? 'none'] });
    },
  });

  const archiveSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!deviceId) return;

      await updateDoc(doc(db, 'devices', deviceId, 'sessions', sessionId), {
        status: 'archived',
        endDate: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions', deviceId ?? 'none'] });
    },
  });

  const activeSession = sessions.find((s) => s.status === 'active') ?? null;

  return {
    sessions,
    activeSession,
    loading,
    error,
    isCreating: createSessionMutation.isPending,
    isArchiving: archiveSessionMutation.isPending,
    createSessionError: createSessionMutation.error,
    archiveSessionError: archiveSessionMutation.error,
    resetCreateSessionError: createSessionMutation.reset,
    resetArchiveSessionError: archiveSessionMutation.reset,
    createSession: async (name: string, sessionTypeId: string) => {
      createSessionMutation.reset();
      return createSessionMutation.mutateAsync({ name, sessionTypeId });
    },
    archiveSession: async (sessionId: string) => {
      archiveSessionMutation.reset();
      return archiveSessionMutation.mutateAsync(sessionId);
    },
  };
}
