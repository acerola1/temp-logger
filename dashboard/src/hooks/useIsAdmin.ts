import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useFirestoreDocument } from './useFirestoreSubscription';

export function useIsAdmin() {
  const { user } = useAuth();
  const adminDocRef = useMemo(() => (user ? doc(db, 'admins', user.uid) : null), [user]);
  const { data: isAdmin, loading } = useFirestoreDocument(adminDocRef, () => true, {
    initialData: false,
    enabled: Boolean(user),
  });

  return { isAdmin, loading };
}
