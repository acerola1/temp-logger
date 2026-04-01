import { useCallback, useMemo } from 'react';
import {
  collection,
  query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SessionType } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_SESSION_TYPES: SessionType[] = [];

interface FirestoreSessionType {
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
}

export function useSessionTypes() {
  const sessionTypesQuery = useMemo(() => query(collection(db, 'sessionTypes')), []);

  const mapSessionTypes = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreSessionType;
        return {
          id: doc.id,
          name: data.name,
          temperatureMin: data.temperatureMin,
          temperatureMax: data.temperatureMax,
          humidityMin: data.humidityMin,
          humidityMax: data.humidityMax,
        } satisfies SessionType;
      }),
    [],
  );

  return useFirestoreCollection(sessionTypesQuery, mapSessionTypes, {
    initialData: EMPTY_SESSION_TYPES,
    onErrorMessage: 'Nem sikerült betölteni a session típusokat.',
  });
}
