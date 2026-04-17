import { useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { AuthContext } from './auth-context';

const googleProvider = new GoogleAuthProvider();
const isEmulatorMode = import.meta.env.VITE_USE_EMULATORS === 'true';
const e2eAdminEmail = import.meta.env.VITE_E2E_ADMIN_EMAIL ?? 'admin-e2e@example.com';
const e2eAdminPassword = import.meta.env.VITE_E2E_ADMIN_PASSWORD ?? 'Admin1234!';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithTestAdmin = useCallback(async () => {
    if (!isEmulatorMode) {
      throw new Error('Teszt admin belépés csak emulátoros módban használható.');
    }
    await signInWithEmailAndPassword(auth, e2eAdminEmail, e2eAdminPassword);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithTestAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
