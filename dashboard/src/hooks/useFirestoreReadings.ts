import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SensorReading } from '../types/sensor';

interface FirestoreDoc {
  deviceId: string;
  temperatureC: number;
  humidity: number;
  recordedAt?: string;
  createdAt?: Timestamp;
}

export function useFirestoreReadings() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'sensorReadings'),
      orderBy('createdAt', 'asc'),
    );

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
  }, []);

  return { readings, loading, error };
}
