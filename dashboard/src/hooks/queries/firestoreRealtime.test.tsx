/** @vitest-environment happy-dom */

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { DocumentData, Query, QuerySnapshot } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFirestoreRealtimeQuery } from './firestoreRealtime';

interface MockSubscription {
  next: (snapshot: QuerySnapshot<DocumentData>) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const subscriptions: MockSubscription[] = [];

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(
    (
      _query: Query<DocumentData>,
      next: MockSubscription['next'],
      error: MockSubscription['error'],
    ) => {
      const unsubscribe = vi.fn();
      subscriptions.push({ next, error, unsubscribe });
      return unsubscribe;
    },
  ),
}));

const FIRST_QUERY = {} as Query<DocumentData>;
const SECOND_QUERY = {} as Query<DocumentData>;
const SNAPSHOT = {} as QuerySnapshot<DocumentData>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFirestoreRealtimeQuery', () => {
  beforeEach(() => {
    subscriptions.length = 0;
  });

  it('nem iratkozik fel újra azonos logikai kulcsú render és nem stabil mapper esetén', async () => {
    let mappedVersion = 0;
    const { result, rerender } = renderHook(
      ({ label }) =>
        useFirestoreRealtimeQuery({
          queryKey: ['records', label],
          queryRef: FIRST_QUERY,
          initialData: [] as Array<{ version: number }>,
          mapSnapshot: () => [{ version: ++mappedVersion }],
        }),
      {
        initialProps: { label: 'same' },
        wrapper: createWrapper(),
      },
    );

    expect(subscriptions).toHaveLength(1);
    expect(result.current.loading).toBe(true);

    act(() => subscriptions[0].next(SNAPSHOT));

    await waitFor(() => expect(result.current.data).toEqual([{ version: 1 }]));
    expect(result.current.loading).toBe(false);
    expect(subscriptions).toHaveLength(1);

    rerender({ label: 'same' });

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].unsubscribe).not.toHaveBeenCalled();
  });

  it('queryváltáskor és unmountkor pontosan egyszer takarítja el az aktív listenert', () => {
    const { rerender, unmount } = renderHook(
      ({ label, queryRef }) =>
        useFirestoreRealtimeQuery({
          queryKey: ['records', label],
          queryRef,
          initialData: [] as string[],
          mapSnapshot: () => [],
        }),
      {
        initialProps: { label: 'first', queryRef: FIRST_QUERY },
        wrapper: createWrapper(),
      },
    );

    expect(subscriptions).toHaveLength(1);

    rerender({ label: 'second', queryRef: SECOND_QUERY });

    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions[1].unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
  });
});
