import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Firebase configuration
const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyDw6-qV783J7-iwpjXy6kYOgHNnqjdkntk",
  authDomain: "gso-gamified-social.firebaseapp.com",
  projectId: "gso-gamified-social",
  storageBucket: "gso-gamified-social.firebasestorage.app",
  messagingSenderId: "619160895146",
  appId: "1:619160895146:web:0cb66a76cbd12c80389ad3"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

// Connect to Firebase emulators in development (uncomment for local testing)
// if (__DEV__) {
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectAuthEmulator(auth, 'http://localhost:9099');
// }

export default app;