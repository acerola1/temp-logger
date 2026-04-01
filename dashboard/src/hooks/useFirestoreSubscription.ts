import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';

interface FirestoreSubscriptionOptions<T> {
  initialData: T;
  onErrorMessage?: string;
  enabled?: boolean;
}

interface FirestoreSubscriptionResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useFirestoreCollection<T>(
  queryRef: Query<DocumentData> | null,
  mapSnapshot: (snapshot: QuerySnapshot<DocumentData>) => T,
  options: FirestoreSubscriptionOptions<T>,
): FirestoreSubscriptionResult<T> {
  const { initialData, onErrorMessage = 'Nem sikerült betölteni az adatokat.', enabled = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !queryRef) {
      setData(initialData);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        setData(mapSnapshot(snapshot));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore query error:', err);
        setData(initialData);
        setLoading(false);
        setError(onErrorMessage);
      },
    );

    return unsubscribe;
  }, [enabled, initialData, mapSnapshot, onErrorMessage, queryRef]);

  return { data, loading, error };
}

export function useFirestoreDocument<T>(
  docRef: DocumentReference<DocumentData> | null,
  mapSnapshot: (snapshot: QueryDocumentSnapshot<DocumentData> | null) => T,
  options: FirestoreSubscriptionOptions<T>,
): FirestoreSubscriptionResult<T> {
  const { initialData, onErrorMessage = 'Nem sikerült betölteni az adatokat.', enabled = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !docRef) {
      setData(initialData);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.exists() ? mapSnapshot(snapshot) : mapSnapshot(null));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore document error:', err);
        setData(initialData);
        setLoading(false);
        setError(onErrorMessage);
      },
    );

    return unsubscribe;
  }, [docRef, enabled, initialData, mapSnapshot, onErrorMessage]);

  return { data, loading, error };
}
