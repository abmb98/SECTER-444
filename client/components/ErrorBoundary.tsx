import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log to external service if needed
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  isFirebaseError = (error: Error): boolean => {
    return error.message?.includes('Firebase') || 
           error.message?.includes('Firestore') ||
           error.message?.includes('fetch') ||
           error.stack?.includes('firebase');
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { error } = this.state;
      const isFirebase = this.isFirebaseError(error);

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <AlertTriangle className="mr-2 h-6 w-6" />
                {isFirebase ? 'Erreur de connexion Firebase' : 'Une erreur s\'est produite'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">
                    {isFirebase ? 'Problème de connexion aux services' : 'Erreur d\'application'}
                  </p>
                  <p className="text-sm">
                    {isFirebase 
                      ? 'Impossible de se connecter à Firebase. Vérifiez votre connexion internet et réessayez.'
                      : error.message || 'Une erreur inattendue s\'est produite.'
                    }
                  </p>
                </AlertDescription>
              </Alert>

              {isFirebase && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Solutions recommandées :</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Vérifiez votre connexion internet</li>
                    <li>• Actualisez la page (F5)</li>
                    <li>• Vérifiez la configuration Firebase</li>
                    <li>• Contactez l'administrateur si le problème persiste</li>
                  </ul>
                </div>
              )}

              <div className="flex space-x-3">
                <Button onClick={this.handleReset} className="flex items-center">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réessayer
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="flex items-center"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recharger la page
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                  className="flex items-center"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Accueil
                </Button>
              </div>

              {/* Development mode: Show detailed error */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-4 bg-gray-100 rounded">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    Détails techniques (développement)
                  </summary>
                  <div className="mt-2 text-sm">
                    <p><strong>Erreur :</strong> {error.message}</p>
                    {error.stack && (
                      <pre className="mt-2 overflow-x-auto text-xs bg-white p-2 rounded border">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
