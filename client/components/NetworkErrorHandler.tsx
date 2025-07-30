import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff, RefreshCw, AlertTriangle, Shield, HelpCircle } from 'lucide-react';

interface NetworkErrorHandlerProps {
  error: string;
  onRetry: () => void;
  className?: string;
}

export const NetworkErrorHandler: React.FC<NetworkErrorHandlerProps> = ({ 
  error, 
  onRetry, 
  className = '' 
}) => {
  const isFetchError = error.includes('fetch') || error.includes('Failed to fetch') || error.includes('TypeError');
  
  if (!isFetchError) {
    return null; // Only handle fetch errors
  }

  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-red-800">
          <WifiOff className="h-5 w-5 mr-2" />
          Problème de connexion réseau
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-red-300 bg-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            Une erreur de réseau empêche la connexion à Firebase. 
            Cela peut être causé par un pare-feu, un proxy, ou un problème de connectivité.
          </AlertDescription>
        </Alert>

        <div className="bg-white p-4 rounded-lg border border-red-200">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Solutions recommandées:
          </h4>
          
          <div className="space-y-3 text-sm text-red-700">
            <div className="flex items-start">
              <RefreshCw className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Rafraîchir la page:</strong> Appuyez sur F5 ou utilisez le bouton ci-dessous
              </div>
            </div>
            
            <div className="flex items-start">
              <WifiOff className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Vérifier la connexion:</strong> Assurez-vous d'avoir une connexion internet stable
              </div>
            </div>
            
            <div className="flex items-start">
              <Shield className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Pare-feu/Proxy:</strong> Désactivez temporairement VPN, proxy ou antivirus bloquant Firebase
              </div>
            </div>
            
            <div className="bg-red-50 p-2 rounded text-xs">
              <strong>Domaines à autoriser:</strong> *.googleapis.com, *.firebaseapp.com
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button 
            onClick={handleRefreshPage}
            className="bg-red-600 hover:bg-red-700 flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Rafraîchir la page
          </Button>
          
          <Button 
            onClick={onRetry}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 flex-1"
          >
            Réessayer
          </Button>
        </div>
        
        <div className="text-xs text-red-600 text-center">
          Si le problème persiste, contactez le support technique
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkErrorHandler;
