import { useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SensorReading } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_READINGS: SensorReading[] = [];

interface FirestoreDoc {
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt?: string;
  createdAt?: Timestamp;
  sessionId?: string;
}

export function useFirestoreReadings(sessionId: string | null) {
  const readingsQuery = useMemo(() => {
    const constraints: QueryConstraint[] = [];
    if (sessionId) {
      constraints.push(where('sessionId', '==', sessionId));
    }
    constraints.push(orderBy('createdAt', 'asc'));

    return query(collection(db, 'sensorReadings'), ...constraints);
  }, [sessionId]);

  const mapReadings = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreDoc;
        const timestamp = data.createdAt
          ? data.createdAt.toDate().toISOString()
          : data.recordedAt ?? new Date().toISOString();

        return {
          id: doc.id,
          deviceId: data.deviceId,
          temperatureC: data.temperatureC,
          humidity: data.humidity,
          recordedAt: data.recordedAt ?? timestamp,
          createdAt: timestamp,
          sessionId: data.sessionId,
        };
      }),
    [],
  );

  const { data: readings, loading, error } = useFirestoreCollection(readingsQuery, mapReadings, {
    initialData: EMPTY_READINGS,
    onErrorMessage: 'Nem sikerült betölteni az adatokat.',
  });

  return { readings, loading, error };
}
