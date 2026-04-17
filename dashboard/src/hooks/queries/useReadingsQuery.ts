import { useCallback, useMemo } from 'react';
import {
  collection,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { SensorReading } from '../../types/sensor';
import { useFirestoreRealtimeQuery } from './firestoreRealtime';

const EMPTY_READINGS: SensorReading[] = [];

interface FirestoreDoc {
  sessionId?: string | null;
  temperatureC: number;
  humidity: number;
  recordedAt?: string;
  createdAt?: {
    toDate?: () => Date;
  };
}

export function useReadingsQuery(deviceId: string | null, sessionId: string | null) {
  const readingsQuery = useMemo(() => {
    if (!deviceId) {
      return null;
    }

    const constraints: QueryConstraint[] = [];
    if (sessionId) {
      constraints.push(where('sessionId', '==', sessionId));
    }
    constraints.push(orderBy('recordedAt', 'asc'));

    return query(collection(db, 'devices', deviceId, 'readings'), ...constraints);
  }, [deviceId, sessionId]);

  const mapReadings = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) => {
      if (!deviceId) {
        return EMPTY_READINGS;
      }

      return snapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreDoc;
        const serverRecordedAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined;
        return {
          id: doc.id,
          deviceId,
          temperatureC: data.temperatureC,
          humidity: data.humidity,
          recordedAt: serverRecordedAt ?? data.recordedAt ?? new Date().toISOString(),
          sessionId: data.sessionId ?? undefined,
        } satisfies SensorReading;
      });
    },
    [deviceId],
  );

  const { data, loading, error } = useFirestoreRealtimeQuery({
    queryKey: ['readings', deviceId ?? 'none', sessionId ?? 'all'],
    queryRef: readingsQuery,
    enabled: !!readingsQuery,
    initialData: EMPTY_READINGS,
    mapSnapshot: mapReadings,
    onErrorMessage: 'Nem sikerült betölteni az adatokat.',
  });

  return {
    readings: data,
    loading,
    error,
  };
}
