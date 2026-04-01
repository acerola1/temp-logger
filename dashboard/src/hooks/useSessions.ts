import { useMemo, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Session } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_SESSIONS: Session[] = [];

interface FirestoreSession {
  name: string;
  sessionTypeId: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
}

export function useSessions(deviceId: string | null) {
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

  const { data: sessions, loading } = useFirestoreCollection(sessionsQuery, mapSessions, {
    initialData: EMPTY_SESSIONS,
    enabled: !!sessionsQuery,
  });

  const activeSession = sessions.find((s) => s.status === 'active') ?? null;

  const createSession = useCallback(
    async (name: string, sessionTypeId: string) => {
      if (!deviceId) return;

      await addDoc(collection(db, 'devices', deviceId, 'sessions'), {
        name,
        sessionTypeId,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
      });
    },
    [deviceId],
  );

  const archiveSession = useCallback(
    async (sessionId: string) => {
      if (!deviceId) return;

      await updateDoc(doc(db, 'devices', deviceId, 'sessions', sessionId), {
        status: 'archived',
        endDate: new Date().toISOString(),
      });
    },
    [deviceId],
  );

  return { sessions, activeSession, loading, createSession, archiveSession };
}
