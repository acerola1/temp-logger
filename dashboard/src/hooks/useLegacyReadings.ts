import { useCallback, useMemo } from 'react';
import { collection, orderBy, query, type DocumentData, type QuerySnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SensorReading } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_READINGS: SensorReading[] = [];

interface LegacyReadingDoc {
  deviceId?: string;
  temperatureC: number;
  humidity: number;
  recordedAt?: string;
  createdAt?: {
    toDate?: () => Date;
  };
}

function pickRecordedAt(data: LegacyReadingDoc): string {
  if (typeof data.recordedAt === 'string') {
    return data.recordedAt;
  }

  if (data.createdAt?.toDate) {
    return data.createdAt.toDate().toISOString();
  }

  return new Date().toISOString();
}

export function useLegacyReadings() {
  const readingsQuery = useMemo(
    () => query(collection(db, 'sensorReadings'), orderBy('recordedAt', 'asc')),
    [],
  );

  const mapReadings = useCallback((snapshot: QuerySnapshot<DocumentData>) => {
    return snapshot.docs.map((doc) => {
      const data = doc.data() as LegacyReadingDoc;
      return {
        id: doc.id,
        deviceId: data.deviceId ?? 'legacy-device',
        temperatureC: data.temperatureC,
        humidity: data.humidity,
        recordedAt: pickRecordedAt(data),
      } satisfies SensorReading;
    });
  }, []);

  const { data: readings, loading, error } = useFirestoreCollection(readingsQuery, mapReadings, {
    initialData: EMPTY_READINGS,
    onErrorMessage: 'Nem sikerült betölteni a régi adatokat.',
  });

  return { readings, loading, error };
}
