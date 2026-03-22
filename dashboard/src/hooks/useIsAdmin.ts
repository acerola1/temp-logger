import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedUid, setCheckedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setCheckedUid(null);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'admins', user.uid),
      (snapshot) => {
        setIsAdmin(snapshot.exists());
        setCheckedUid(user.uid);
        setLoading(false);
      },
      (err) => {
        console.error('useIsAdmin error:', err);
        setIsAdmin(false);
        setCheckedUid(user.uid);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const waitingForCurrentUid = Boolean(user && checkedUid !== user.uid);

  return { isAdmin, loading: loading || waitingForCurrentUid };
}
