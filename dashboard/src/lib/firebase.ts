import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

const shouldUseEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

if (shouldUseEmulators) {
  // Prevent duplicate emulator connections during HMR in dev.
  const emulatorsConnected = (globalThis as { __esp32FirebaseEmulatorsConnected?: boolean })
    .__esp32FirebaseEmulatorsConnected;

  if (!emulatorsConnected) {
    connectFirestoreEmulator(
      db,
      import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? 8088),
    );
    connectAuthEmulator(
      auth,
      `http://${import.meta.env.VITE_AUTH_EMULATOR_HOST ?? '127.0.0.1'}:${import.meta.env.VITE_AUTH_EMULATOR_PORT ?? 9099}`,
      { disableWarnings: true },
    );
    connectStorageEmulator(
      storage,
      import.meta.env.VITE_STORAGE_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT ?? 9199),
    );

    (globalThis as { __esp32FirebaseEmulatorsConnected?: boolean })
      .__esp32FirebaseEmulatorsConnected = true;
  }
}
