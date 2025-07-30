import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { testFirebaseConnection } from '@/lib/firebase';

export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [firebaseStatus, setFirebaseStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Test Firebase when coming back online
      if (firebaseStatus === 'disconnected') {
        testFirebase();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setFirebaseStatus('disconnected');
      setLastError('Connexion internet perdue');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firebaseStatus]);

  // Test Firebase connection
  const testFirebase = async () => {
    if (!isOnline) {
      setFirebaseStatus('disconnected');
      setLastError('Pas de connexion internet');
      return;
    }

    setIsTestingFirebase(true);
    try {
      const result = await testFirebaseConnection();
      if (result.success) {
        setFirebaseStatus('connected');
        setLastError(null);
      } else {
        setFirebaseStatus('disconnected');
        setLastError(result.error || 'Connexion Firebase échouée');
      }
    } catch (error: any) {
      setFirebaseStatus('disconnected');
      setLastError(error.message || 'Erreur de test de connexion');
    } finally {
      setIsTestingFirebase(false);
    }
  };

  // Test Firebase on component mount
  useEffect(() => {
    testFirebase();
  }, []);

  // Auto-retry Firebase connection when offline and coming back online
  useEffect(() => {
    if (isOnline && firebaseStatus === 'disconnected') {
      const retryTimer = setTimeout(() => {
        testFirebase();
      }, 2000);

      return () => clearTimeout(retryTimer);
    }
  }, [isOnline, firebaseStatus]);

  // Don't show anything if everything is working fine
  if (isOnline && firebaseStatus === 'connected') {
    return null;
  }

  // Show status if there are issues
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert variant={!isOnline || firebaseStatus === 'disconnected' ? 'destructive' : 'default'}>
        <div className="flex items-center">
          {!isOnline ? (
            <WifiOff className="h-4 w-4" />
          ) : firebaseStatus === 'connected' ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <div className="ml-2 flex-1">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {!isOnline ? 'Hors ligne' : 
                     firebaseStatus === 'connected' ? 'Connecté' : 
                     firebaseStatus === 'unknown' ? 'Test de connexion...' : 'Problème de connexion'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testFirebase}
                    disabled={isTestingFirebase || !isOnline}
                    className="h-6 px-2 text-xs"
                  >
                    {isTestingFirebase ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                
                {lastError && (
                  <p className="text-xs text-gray-600">
                    {lastError}
                  </p>
                )}

                {!isOnline && (
                  <p className="text-xs text-gray-600">
                    Vérifiez votre connexion internet
                  </p>
                )}

                {isOnline && firebaseStatus === 'disconnected' && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Suggestions :</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>Rechargez la page</li>
                      <li>Vérifiez les paramètres de pare-feu</li>
                      <li>Contactez l'administrateur</li>
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
};
