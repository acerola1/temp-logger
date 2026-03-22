import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB8wMcXdj20BJ_hGqAyjPigWjQ-KK7aO2o',
  authDomain: 'g-temp-log.firebaseapp.com',
  projectId: 'g-temp-log',
  storageBucket: 'g-temp-log.firebasestorage.app',
  messagingSenderId: '8465518351',
  appId: '1:8465518351:web:e480c4d631f4ed47a0387a',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
