import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { onSnapshot, type DocumentData, type Query, type QuerySnapshot } from 'firebase/firestore';

interface FirestoreRealtimeQueryOptions<T> {
  queryKey: QueryKey;
  queryRef: Query<DocumentData> | null;
  enabled?: boolean;
  initialData: T;
  mapSnapshot: (snapshot: QuerySnapshot<DocumentData>) => T;
  onErrorMessage?: string;
}

export function useFirestoreRealtimeQuery<T>({
  queryKey,
  queryRef,
  enabled = true,
  initialData,
  mapSnapshot,
  onErrorMessage = 'Nem sikerült betölteni az adatokat.',
}: FirestoreRealtimeQueryOptions<T>) {
  const queryClient = useQueryClient();
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const queryResult = useQuery<T, Error>({
    queryKey,
    enabled: enabled && !!queryRef,
    initialData,
    queryFn: async () => {
      if (!queryRef) {
        return initialData;
      }

      return new Promise<T>((resolve, reject) => {
        const unsubscribe = onSnapshot(
          queryRef,
          (snapshot) => {
            unsubscribe();
            resolve(mapSnapshot(snapshot));
          },
          (error) => {
            unsubscribe();
            reject(error);
          },
        );
      });
    },
  });

  useEffect(() => {
    if (!enabled || !queryRef) {
      return;
    }

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        queryClient.setQueryData(queryKey, mapSnapshot(snapshot));
        setSubscriptionError(null);
      },
      (error) => {
        console.error('Firestore realtime query error:', error);
        setSubscriptionError(onErrorMessage);
      },
    );

    return unsubscribe;
  }, [enabled, mapSnapshot, onErrorMessage, queryClient, queryKey, queryRef]);

  const error =
    enabled && queryRef
      ? subscriptionError ?? (queryResult.error ? queryResult.error.message : null)
      : null;

  return {
    data: queryResult.data ?? initialData,
    loading: enabled && !!queryRef ? queryResult.isLoading : false,
    isFetching: queryResult.isFetching,
    error,
  };
}
