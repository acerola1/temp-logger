import { useMemo, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Session } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_SESSIONS: Session[] = [];

interface FirestoreSession {
  name: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
  createdAt?: Timestamp;
}

export function useSessions() {
  const sessionsQuery = useMemo(
    () => query(collection(db, 'sessions'), orderBy('createdAt', 'desc')),
    [],
  );

  const mapSessions = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((d) => {
        const data = d.data() as FirestoreSession;
        return {
          id: d.id,
          name: data.name,
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate,
          createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
        };
      }),
    [],
  );

  const { data: sessions, loading } = useFirestoreCollection(sessionsQuery, mapSessions, {
    initialData: EMPTY_SESSIONS,
  });

  const activeSession = sessions.find((s) => s.status === 'active') ?? null;

  const createSession = useCallback(async (name: string) => {
    await addDoc(collection(db, 'sessions'), {
      name,
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: null,
      createdAt: serverTimestamp(),
    });
  }, []);

  const archiveSession = useCallback(async (sessionId: string) => {
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'archived',
      endDate: new Date().toISOString(),
    });
  }, []);

  return { sessions, activeSession, loading, createSession, archiveSession };
}
