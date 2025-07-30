import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { testFirebaseConnection, attemptConnectionRecovery } from '@/lib/firebase';

interface ConnectionState {
  isConnected: boolean;
  isChecking: boolean;
  lastError?: string;
  lastCheck?: Date;
}

export const FirebaseConnectionMonitor = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: true,
    isChecking: false
  });

  const checkConnection = async (showLoading = true) => {
    if (showLoading) {
      setConnectionState(prev => ({ ...prev, isChecking: true }));
    }

    try {
      const result = await testFirebaseConnection(2);
      setConnectionState({
        isConnected: result.success,
        isChecking: false,
        lastError: result.error,
        lastCheck: new Date()
      });
    } catch (error) {
      setConnectionState({
        isConnected: false,
        isChecking: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      });
    }
  };

  const attemptRecovery = async () => {
    setConnectionState(prev => ({ ...prev, isChecking: true }));
    
    try {
      const result = await attemptConnectionRecovery();
      setConnectionState({
        isConnected: result.success,
        isChecking: false,
        lastError: result.error,
        lastCheck: new Date()
      });

      if (result.success) {
        // Reload the page to reset the app state
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      setConnectionState({
        isConnected: false,
        isChecking: false,
        lastError: error instanceof Error ? error.message : 'Recovery failed',
        lastCheck: new Date()
      });
    }
  };

  useEffect(() => {
    // Initial connection check
    checkConnection(false);

    // Set up periodic connection monitoring
    const interval = setInterval(() => {
      if (!connectionState.isChecking) {
        checkConnection(false);
      }
    }, 30000); // Check every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('Network came back online, checking Firebase connection...');
      setTimeout(() => checkConnection(false), 1000);
    };

    const handleOffline = () => {
      console.log('Network went offline');
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        lastError: 'Network offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if connection is good
  if (connectionState.isConnected) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert variant="destructive" className="max-w-4xl mx-auto">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4" />
              <div>
                <span className="font-semibold">Connexion Firebase interrompue</span>
                <p className="text-sm mt-1">
                  {connectionState.lastError || 'Problème de connectivité détecté'}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkConnection(true)}
                disabled={connectionState.isChecking}
              >
                {connectionState.isChecking ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Wifi className="h-3 w-3" />
                )}
                Tester
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={attemptRecovery}
                disabled={connectionState.isChecking}
              >
                {connectionState.isChecking ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Reconnecter
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};
