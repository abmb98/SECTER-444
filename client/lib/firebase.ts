import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBh3U-f8sUXy-gR-qf7jLA3du0O2uKsngU",
  authDomain: "secteur-25.firebaseapp.com",
  projectId: "secteur-25",
  storageBucket: "secteur-25.firebasestorage.app",
  messagingSenderId: "150863967303",
  appId: "1:150863967303:web:5e75cc0a581e8d1a38ed62"
};

// Debug: Log Firebase config
console.log('Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase uses its own networking - don't intercept fetch

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Test Firebase connectivity
export const testFirebaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Testing Firebase connection...');

    // Test Firestore connection using a valid collection name
    const testDoc = doc(db, 'app_config', 'connection_test');

    // Simple connection test with reasonable timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 seconds
    });

    const connectionPromise = getDoc(testDoc);
    await Promise.race([connectionPromise, timeoutPromise]);

    console.log('Firebase connection: SUCCESS');
    return { success: true };
  } catch (error: any) {
    console.error('Firebase connection test failed:', error);

    // Handle specific error cases
    if (error.code === 'permission-denied') {
      // Permission denied means Firebase is reachable but needs setup
      console.log('Permission denied - Firebase reachable but needs Firestore rules setup');
      return {
        success: true,
        error: 'Firebase project needs setup - please deploy Firestore rules'
      };
    }

    if (error.code === 'failed-precondition') {
      // Firestore database doesn't exist yet
      console.log('Firestore database not created yet');
      return {
        success: false,
        error: 'Firestore database not created - please initialize database in Firebase Console'
      };
    }

    let errorMessage = 'Connection failed';
    if (error.code) {
      errorMessage = `Firebase error: ${error.code}`;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Connection timeout';
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Network connectivity issue';
    }

    return { success: false, error: errorMessage };
  }
};

// Connection recovery utility
export const attemptConnectionRecovery = async () => {
  console.log('🔄 Attempting connection recovery...');

  // Test actual Firestore connection
  return await testFirebaseConnection();
};

export default app;
