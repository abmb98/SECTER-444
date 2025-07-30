import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { testFirebaseConnection } from '@/lib/firebase';

interface ConnectionStatus {
  status: 'testing' | 'connected' | 'disconnected' | 'error';
  message?: string;
  lastTested?: Date;
}

export const FirebaseConnectionTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'testing'
  });
  const [isManualTesting, setIsManualTesting] = useState(false);

  const testConnection = async (isManual = false) => {
    if (isManual) setIsManualTesting(true);
    
    setConnectionStatus({ status: 'testing' });
    
    try {
      const result = await testFirebaseConnection();
      
      if (result.success) {
        setConnectionStatus({
          status: 'connected',
          message: 'Firebase connexion établie avec succès',
          lastTested: new Date()
        });
      } else {
        setConnectionStatus({
          status: 'error',
          message: result.error || 'Erreur de connexion inconnue',
          lastTested: new Date()
        });
      }
    } catch (error: any) {
      setConnectionStatus({
        status: 'disconnected',
        message: error.message || 'Impossible de se connecter à Firebase',
        lastTested: new Date()
      });
    } finally {
      if (isManual) setIsManualTesting(false);
    }
  };

  // Test connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'connected': return 'text-green-600';
      case 'disconnected': 
      case 'error': return 'text-red-600';
      case 'testing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disconnected': 
      case 'error': return <WifiOff className="h-4 w-4 text-red-600" />;
      case 'testing': return (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      );
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus.status) {
      case 'connected': 
        return <Badge className="bg-green-100 text-green-800">Connecté</Badge>;
      case 'disconnected': 
        return <Badge className="bg-red-100 text-red-800">Déconnecté</Badge>;
      case 'error': 
        return <Badge className="bg-red-100 text-red-800">Erreur</Badge>;
      case 'testing': 
        return <Badge className="bg-blue-100 text-blue-800">Test en cours...</Badge>;
      default: 
        return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon()}
            <span className="ml-2">Statut Firebase</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connectionStatus.message && (
            <Alert className={connectionStatus.status === 'connected' ? 'bg-green-50 border-green-200' : 
                             connectionStatus.status === 'testing' ? 'bg-blue-50 border-blue-200' : 
                             'bg-red-50 border-red-200'}>
              <AlertDescription className={getStatusColor()}>
                {connectionStatus.message}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {connectionStatus.lastTested && (
                <span>
                  Dernier test: {connectionStatus.lastTested.toLocaleTimeString('fr-FR')}
                </span>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection(true)}
              disabled={isManualTesting}
              className="flex items-center"
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${isManualTesting ? 'animate-spin' : ''}`} />
              Retester
            </Button>
          </div>

          {(connectionStatus.status === 'disconnected' || connectionStatus.status === 'error') && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Solutions possibles:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Vérifiez votre connexion internet</li>
                <li>• Rafraîchissez la page (F5)</li>
                <li>• Vérifiez que Firebase n'est pas bloqué par un pare-feu</li>
                <li>• Contactez l'administrateur si le problème persiste</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FirebaseConnectionTest;
