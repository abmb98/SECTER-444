import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class FirebaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Firebase Error Boundary caught an error:', error, errorInfo);
    
    // Log Firebase-specific errors
    if (error.message?.includes('fetch') || error.message?.includes('Firebase')) {
      console.error('This appears to be a Firebase connectivity error');
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isFirebaseError = this.state.error?.message?.includes('fetch') || 
                             this.state.error?.message?.includes('Firebase') ||
                             this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">
                      {isFirebaseError ? 'Problème de connexion Firebase' : 'Une erreur est survenue'}
                    </h3>
                    <p className="text-sm mt-2">
                      {isFirebaseError 
                        ? 'Impossible de se connecter aux services Firebase. Cela peut être dû à un problème de réseau ou de configuration.'
                        : 'Une erreur inattendue s\'est produite dans l\'application.'
                      }
                    </p>
                  </div>

                  {isFirebaseError && (
                    <div className="text-sm space-y-2">
                      <p className="font-medium">Solutions possibles :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Vérifiez votre connexion internet</li>
                        <li>Désactivez temporairement votre pare-feu/antivirus</li>
                        <li>Essayez de recharger la page</li>
                        <li>Contactez l'administrateur système</li>
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button 
                      onClick={this.handleRetry}
                      className="w-full"
                      variant="outline"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Recharger la page
                    </Button>
                    
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600">
                        Détails techniques
                      </summary>
                      <div className="mt-2 p-2 bg-gray-50 rounded text-gray-700 font-mono text-xs">
                        {this.state.error?.message}
                      </div>
                    </details>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
