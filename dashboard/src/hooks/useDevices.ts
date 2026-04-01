import { useCallback, useMemo } from 'react';
import {
  collection,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Device } from '../types/sensor';
import { useFirestoreCollection } from './useFirestoreSubscription';

const EMPTY_DEVICES: Device[] = [];

interface FirestoreDevice {
  name: string;
}

export function useDevices() {
  const devicesQuery = useMemo(
    () => query(collection(db, 'devices'), orderBy('name', 'asc')),
    [],
  );

  const mapDevices = useCallback(
    (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreDevice;
        return {
          id: doc.id,
          name: data.name || doc.id,
        } satisfies Device;
      }),
    [],
  );

  return useFirestoreCollection(devicesQuery, mapDevices, {
    initialData: EMPTY_DEVICES,
    onErrorMessage: 'Nem sikerült betölteni az eszközöket.',
  });
}
