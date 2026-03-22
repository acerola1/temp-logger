import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  type Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SensorReading } from '../types/sensor';

interface FirestoreDoc {
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt?: string;
  createdAt?: Timestamp;
  sessionId?: string;
}

export function useFirestoreReadings(sessionId: string | null) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [];
    if (sessionId) {
      constraints.push(where('sessionId', '==', sessionId));
    }
    constraints.push(orderBy('createdAt', 'asc'));

    const q = query(collection(db, 'sensorReadings'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SensorReading[] = snapshot.docs.map((doc) => {
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
        });
        setReadings(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError('Nem sikerült betölteni az adatokat.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [sessionId]);

  return { readings, loading, error };
}
