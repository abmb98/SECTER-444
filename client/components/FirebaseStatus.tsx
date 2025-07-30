import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface FirebaseStatusProps {
  onRetry?: () => void;
}

export const FirebaseStatus: React.FC<FirebaseStatusProps> = ({ onRetry }) => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      setError(null);
      
      // Try to read a simple document to test connection
      const testDoc = doc(db, '__test__', 'connection');
      await getDoc(testDoc);
      
      setConnectionStatus('connected');
      console.log('Firebase connection: OK');
    } catch (err: any) {
      console.error('Firebase connection error:', err);
      setConnectionStatus('disconnected');
      
      let errorMessage = 'Connexion Firebase échouée';
      if (err.code) {
        switch (err.code) {
          case 'unavailable':
            errorMessage = 'Service Firebase temporairement indisponible';
            break;
          case 'permission-denied':
            errorMessage = 'Problème de configuration Firebase';
            break;
          case 'failed-precondition':
            errorMessage = 'Configuration Firebase incorrecte';
            break;
          default:
            errorMessage = `Erreur Firebase: ${err.code}`;
        }
      } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
        errorMessage = 'Problème de connexion réseau';
      }
      
      setError(errorMessage);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    if (onRetry) {
      onRetry();
    }
    setIsRetrying(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  if (connectionStatus === 'connected') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Connexion Firebase établie
        </AlertDescription>
      </Alert>
    );
  }

  if (connectionStatus === 'checking') {
    return (
      <Alert>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <AlertDescription>
          Vérification de la connexion Firebase...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <p><strong>Problème de connexion Firebase</strong></p>
          <p className="text-sm">{error}</p>
          <div className="flex space-x-2 mt-3">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Wifi className="h-3 w-3 mr-1" />
              )}
              {isRetrying ? 'Reconnexion...' : 'Réessayer'}
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Recharger la page
            </Button>
          </div>
          <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
            <p><strong>Solutions possibles :</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Vérifiez votre connexion internet</li>
              <li>Vérifiez la configuration Firebase</li>
              <li>Contactez l'administrateur système</li>
            </ul>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
