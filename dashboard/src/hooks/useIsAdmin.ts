import { useCallback, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { useFirestoreDocument } from './useFirestoreSubscription';

export function useIsAdmin() {
  const { user } = useAuth();
  const adminDocRef = useMemo(() => (user ? doc(db, 'admins', user.uid) : null), [user]);
  const mapAdminSnapshot = useCallback(() => true, []);
  const { data: isAdmin, loading } = useFirestoreDocument(adminDocRef, mapAdminSnapshot, {
    initialData: false,
    enabled: Boolean(user),
  });

  return { isAdmin, loading };
}
