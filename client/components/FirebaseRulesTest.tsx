import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, TestTube } from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  message: string;
}

export const FirebaseRulesTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTests = async () => {
    setTesting(true);
    const testResults: TestResult[] = [];

    const tests = [
      {
        name: 'Connection Test',
        test: async () => {
          const testDoc = doc(db, 'app_config', 'connection_test');
          await getDoc(testDoc);
          return 'Connection test successful';
        }
      },
      {
        name: 'Users Collection',
        test: async () => {
          const usersRef = collection(db, 'users');
          const snapshot = await getDocs(usersRef);
          return `Users collection accessible (${snapshot.docs.length} documents)`;
        }
      },
      {
        name: 'Rooms Collection',
        test: async () => {
          const roomsRef = collection(db, 'rooms');
          const snapshot = await getDocs(roomsRef);
          return `Rooms collection accessible (${snapshot.docs.length} documents)`;
        }
      },
      {
        name: 'Workers Collection',
        test: async () => {
          const workersRef = collection(db, 'workers');
          const snapshot = await getDocs(workersRef);
          return `Workers collection accessible (${snapshot.docs.length} documents)`;
        }
      },
      {
        name: 'Fermes Collection',
        test: async () => {
          const fermesRef = collection(db, 'fermes');
          const snapshot = await getDocs(fermesRef);
          return `Fermes collection accessible (${snapshot.docs.length} documents)`;
        }
      }
    ];

    for (const { name, test } of tests) {
      try {
        const message = await test();
        testResults.push({
          name,
          success: true,
          message
        });
      } catch (error: any) {
        testResults.push({
          name,
          success: false,
          error: error.code || 'unknown',
          message: error.message || 'Unknown error'
        });
      }
    }

    setResults(testResults);
    setTesting(false);
  };

  const getIcon = (result: TestResult) => {
    if (result.success) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getAlertVariant = (): "default" | "destructive" => {
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length === 0 && results.length > 0) {
      return "default"; // success (default)
    } else if (failedTests.length > 0) {
      return 'destructive';
    }
    return "default";
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TestTube className="mr-2 h-5 w-5" />
          Test des Règles Firebase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Ce test vérifie l'accès aux collections Firebase avec l'utilisateur actuel.</p>
          <p className="mt-1">
            <strong>Utilisateur:</strong> {auth.currentUser?.email || 'Non connecté'}
          </p>
        </div>

        <Button 
          onClick={runTests} 
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Test en cours...' : 'Lancer les tests'}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <Alert variant={getAlertVariant()}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Résultats des tests:</strong> {results.filter(r => r.success).length}/{results.length} réussis
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                  {getIcon(result)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{result.name}</div>
                    <div className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                      {result.message}
                    </div>
                    {result.error && (
                      <div className="text-xs text-gray-500 mt-1">
                        Code d'erreur: {result.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {results.some(r => !r.success) && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Des erreurs ont été détectées.</strong></p>
                    <p className="text-sm">Solutions possibles:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Vérifiez que les règles Firebase sont correctement déployées</li>
                      <li>Assurez-vous d'être connecté avec un compte valide</li>
                      <li>Vérifiez que l'authentification Email/Password est activée</li>
                      <li>Consultez le fichier FIREBASE_SETUP.md pour les instructions détaillées</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
