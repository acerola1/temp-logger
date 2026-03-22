import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Session } from '../types/sensor';

interface FirestoreSession {
  name: string;
  status: 'active' | 'archived';
  startDate: string;
  endDate: string | null;
  createdAt?: Timestamp;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Session[] = snapshot.docs.map((d) => {
          const data = d.data() as FirestoreSession;
          return {
            id: d.id,
            name: data.name,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
            createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
          };
        });
        setSessions(items);
        setLoading(false);
      },
      (err) => {
        console.error('Sessions error:', err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

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
