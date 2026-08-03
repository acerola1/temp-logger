import { useEffect, useMemo, useRef, useState } from 'react';
import { hashKey, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { onSnapshot, type DocumentData, type Query, type QuerySnapshot } from 'firebase/firestore';

interface FirestoreRealtimeQueryOptions<T> {
  queryKey: QueryKey;
  queryRef: Query<DocumentData> | null;
  enabled?: boolean;
  initialData: T;
  mapSnapshot: (snapshot: QuerySnapshot<DocumentData>) => T;
  onErrorMessage?: string;
}

interface SubscriptionState {
  token: object;
  error: string | null;
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
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState | null>(null);
  const mapSnapshotRef = useRef(mapSnapshot);
  const onErrorMessageRef = useRef(onErrorMessage);
  const queryKeyRef = useRef(queryKey);
  const queryKeyHash = hashKey(queryKey);
  const subscriptionToken = useMemo(
    () => ({ enabled, queryKeyHash, queryRef }),
    [enabled, queryKeyHash, queryRef],
  );

  useEffect(() => {
    mapSnapshotRef.current = mapSnapshot;
    onErrorMessageRef.current = onErrorMessage;
    queryKeyRef.current = queryKey;
  });

  const queryResult = useQuery<T, Error>({
    queryKey,
    queryFn: async () => initialData,
    enabled: false,
    initialData,
  });

  useEffect(() => {
    if (!enabled || !queryRef) {
      return;
    }

    const subscribedQueryKey = queryKeyRef.current;

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        queryClient.setQueryData(subscribedQueryKey, mapSnapshotRef.current(snapshot));
        setSubscriptionState({ token: subscriptionToken, error: null });
      },
      (error) => {
        console.error('Firestore realtime query error:', error);
        setSubscriptionState({ token: subscriptionToken, error: onErrorMessageRef.current });
      },
    );

    return unsubscribe;
  }, [enabled, queryClient, queryKeyHash, queryRef, subscriptionToken]);

  const active = enabled && !!queryRef;
  const hasCurrentResult = subscriptionState?.token === subscriptionToken;
  const loading = active && !hasCurrentResult;
  const error = active && hasCurrentResult ? subscriptionState.error : null;

  return {
    data: queryResult.data ?? initialData,
    loading,
    isFetching: loading,
    error,
  };
}
