import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Wifi } from 'lucide-react';

interface LoadingErrorProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  dataCount?: number;
  children?: React.ReactNode;
}

export const LoadingError: React.FC<LoadingErrorProps> = ({
  loading,
  error,
  onRetry,
  emptyMessage = "Aucune donnée disponible",
  dataCount = 0,
  children
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Chargement des données...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isNetworkError = error.includes('connexion') || error.includes('réseau') || error.includes('fetch');
    
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-3">
            <div>
              <p className="font-semibold">
                {isNetworkError ? 'Problème de connexion' : 'Erreur de chargement'}
              </p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            
            {onRetry && (
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" onClick={onRetry}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Réessayer
                </Button>
                {isNetworkError && (
                  <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                    <Wifi className="h-3 w-3 mr-1" />
                    Recharger la page
                  </Button>
                )}
              </div>
            )}
            
            {isNetworkError && (
              <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                <p><strong>Conseils :</strong></p>
                <ul className="list-disc list-inside mt-1">
                  <li>Vérifiez votre connexion internet</li>
                  <li>Actualisez la page (F5)</li>
                  <li>Contactez l'administrateur si le problème persiste</li>
                </ul>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (dataCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-gray-600">{emptyMessage}</p>
            {onRetry && (
              <Button 
                variant="outline" 
                onClick={onRetry} 
                className="mt-3"
                size="sm"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Actualiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};
