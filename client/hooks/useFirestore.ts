import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  DocumentData,
  QueryConstraint,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { db, auth, attemptConnectionRecovery } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useFirestore = <T = DocumentData>(
  collectionName: string,
  waitForAuth: boolean = true,
  useRealtime: boolean = true
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!waitForAuth);

  const fetchData = async (constraints: QueryConstraint[] = [], retries = 5) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        setLoading(true);
        if (attempt === 1) setError(null);

        console.log(`🔄 Fetching data from collection: ${collectionName} (attempt ${attempt}/${retries})`);

        const collectionRef = collection(db, collectionName);
        const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

        // Add timeout to prevent hanging requests (increased timeout)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 30000); // Increased to 30 seconds
        });

        const fetchPromise = getDocs(q);
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;

        const documents = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as T[];

        console.log(`Successfully fetched ${documents.length} documents from ${collectionName}`);
        setData(documents);
        setError(null);
        return; // Success, exit retry loop
      } catch (err: any) {
        console.error(`Error fetching data from ${collectionName} (attempt ${attempt}):`, err);

        // Enhanced retry logic for different types of errors
        const isRetryableError = (
          err.message?.includes('fetch') ||
          err.message?.includes('network') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('TypeError: Failed to fetch') ||
          err.message === 'Request timeout' ||
          err.code === 'unavailable' ||
          err.code === 'deadline-exceeded' ||
          err.code === 'network-request-failed' ||
          err.name === 'TypeError'
        );

        if (attempt < retries && isRetryableError) {
          const delay = Math.min(2000 * Math.pow(1.5, attempt - 1), 10000); // Progressive backoff
          console.log(`⏳ Network error detected, retrying in ${delay}ms... (${attempt}/${retries})`);

          // For fetch errors, try connection recovery on second attempt
          if (attempt === 2 && (err.message?.includes('fetch') || err.name === 'TypeError')) {
            console.log('🔄 Attempting connection recovery...');
            const recovery = await attemptConnectionRecovery();
            if (!recovery.success) {
              console.log('❌ Connection recovery failed:', recovery.error);
            }
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // This is the final attempt or a non-retryable error
        let errorMessage = 'Erreur de connexion';

        if (err.message === 'Request timeout') {
          errorMessage = 'La requête a pris trop de temps. Vérifiez votre connexion internet.';
        } else if (err.code) {
          switch (err.code) {
            case 'unavailable':
              errorMessage = 'Service Firebase temporairement indisponible. Veuillez réessayer dans quelques instants.';
              break;
            case 'permission-denied':
              const currentUser = auth.currentUser;
              if (!currentUser) {
                errorMessage = 'Vous devez être connecté pour accéder aux données. Veuillez vous reconnecter.';
              } else {
                errorMessage = 'Permissions insuffisantes pour accéder aux données. Contactez un administrateur si nécessaire.';
              }
              break;
            case 'failed-precondition':
              errorMessage = 'Configuration Firebase incorrecte.';
              break;
            case 'deadline-exceeded':
              errorMessage = 'Délai d\'attente dépassé. Vérifiez votre connexion internet.';
              break;
            case 'unauthenticated':
              errorMessage = 'Session expirée. Veuillez vous reconnecter.';
              break;
            case 'network-request-failed':
              errorMessage = 'Échec de la requête réseau. Vérifiez votre connexion internet.';
              break;
            default:
              errorMessage = `Erreur Firebase: ${err.code} - ${err.message}`;
          }
        } else if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
          errorMessage = '🌐 Erreur de réseau détectée. Solutions possibles:\n• Rafraîchissez la page (F5)\n• Vérifiez votre connexion internet\n• Désactivez temporairement VPN/Proxy\n• Contactez le support si le problème persiste';
        } else if (err.message?.includes('CORS')) {
          errorMessage = 'Erreur CORS - problème de configuration du domaine Firebase.';
        } else if (err.message?.includes('timeout') || err.message === 'Request timeout') {
          errorMessage = '⏱️ Délai d\'attente dépassé. Le serveur met trop de temps à répondre.';
        } else {
          errorMessage = err.message || 'Une erreur inattendue s\'est produite lors de la connexion à Firebase.';
        }

        setError(errorMessage);
        setData([]);
        break; // Exit retry loop
      } finally {
        setLoading(false);
      }
    }
  };

  const addDocument = async (data: any) => {
    try {
      console.log(`Adding document to collection: ${collectionName}`);
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Successfully added document with ID: ${docRef.id}`);
      return docRef.id;
    } catch (err: any) {
      console.error(`Error adding document to ${collectionName}:`, err);

      let errorMessage = 'Erreur lors de l\'ajout';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissions insuffisantes pour ajouter des données.';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'Problème de connexion réseau lors de l\'ajout.';
      } else {
        errorMessage = err.message || 'Erreur lors de l\'ajout du document';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateDocument = async (id: string, data: any) => {
    try {
      console.log(`Updating document ${id} in collection: ${collectionName}`);
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      console.log(`Successfully updated document: ${id}`);
    } catch (err: any) {
      console.error(`Error updating document ${id} in ${collectionName}:`, err);

      let errorMessage = 'Erreur lors de la mise à jour';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissions insuffisantes pour modifier les données.';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'Problème de connexion réseau lors de la mise à jour.';
      } else {
        errorMessage = err.message || 'Erreur lors de la mise à jour du document';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      console.log(`Deleting document ${id} from collection: ${collectionName}`);
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      console.log(`Successfully deleted document: ${id}`);
    } catch (err: any) {
      console.error(`Error deleting document ${id} from ${collectionName}:`, err);

      let errorMessage = 'Erreur lors de la suppression';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissions insuffisantes pour supprimer les données.';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'Problème de connexion réseau lors de la suppression.';
      } else {
        errorMessage = err.message || 'Erreur lors de la suppression du document';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getDocument = async (id: string) => {
    try {
      console.log(`Getting document ${id} from collection: ${collectionName}`);
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log(`Successfully retrieved document: ${id}`);
        return { id: docSnap.id, ...docSnap.data() };
      }
      console.log(`Document ${id} not found`);
      return null;
    } catch (err: any) {
      console.error(`Error getting document ${id} from ${collectionName}:`, err);

      let errorMessage = 'Erreur lors de la récupération';
      if (err.code === 'permission-denied') {
        errorMessage = 'Permissions insuffisantes pour accéder aux données.';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'Problème de connexion réseau lors de la récupération.';
      } else {
        errorMessage = err.message || 'Erreur lors de la récupération du document';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    if (!waitForAuth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log(`Auth state changed for ${collectionName} hook:`, user ? 'authenticated' : 'not authenticated');
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [waitForAuth, collectionName]);

  // Setup real-time listener or fetch data when collection name changes or auth is ready
  useEffect(() => {
    if (!authReady) return;

    let unsubscribe: (() => void) | undefined;

    if (useRealtime) {
      // Setup real-time listener
      console.log(`Setting up real-time listener for collection: ${collectionName}`);

      try {
        const collectionRef = collection(db, collectionName);

        unsubscribe = onSnapshot(
          collectionRef,
          (snapshot) => {
            const documents = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as T[];

            console.log(`📡 Real-time update: ${documents.length} documents in ${collectionName}`);
            setData(documents);
            setError(null);
            setLoading(false);
          },
          (err: any) => {
            console.error(`❌ Real-time listener error for ${collectionName}:`, err);

            let errorMessage = '🔄 Erreur de connexion temps réel - tentative de reconnexion...';

            if (err.code === 'permission-denied') {
              const currentUser = auth.currentUser;
              if (!currentUser) {
                errorMessage = '🔐 Vous devez être connecté pour accéder aux données en temps réel.';
              } else {
                errorMessage = '🚫 Permissions insuffisantes pour l\'accès temps réel aux données.';
              }
            } else if (err.code === 'unavailable') {
              errorMessage = '🌐 Service Firebase temporairement indisponible. Reconnexion automatique en cours...';
            } else if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch')) {
              errorMessage = '🌐 Problème de réseau détecté. Vérifiez votre connexion internet.';
            }

            setError(errorMessage);
            setLoading(false);

            // Auto-retry for network errors after delay
            if (err.code === 'unavailable' || err.message?.includes('fetch')) {
              setTimeout(() => {
                console.log(`🔄 Auto-retrying real-time connection for ${collectionName}...`);
                fetchData(); // Fallback to one-time fetch
              }, 5000);
            }
          }
        );
      } catch (err) {
        console.error(`Failed to setup real-time listener for ${collectionName}:`, err);
        // Fallback to one-time fetch
        fetchData();
      }
    } else {
      // Use one-time fetch
      fetchData();
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        console.log(`Cleaning up real-time listener for ${collectionName}`);
        unsubscribe();
      }
    };
  }, [collectionName, authReady, useRealtime]);

  return {
    data,
    loading,
    error,
    fetchData,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocument,
    refetch: () => fetchData()
  };
};

export const useFirestoreDoc = (collectionName: string, docId: string | null) => {
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchDoc = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() });
        } else {
          setData(null);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching document');
        console.error('Error fetching document:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [collectionName, docId]);

  return { data, loading, error };
};
