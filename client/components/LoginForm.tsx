import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building2, Lock, Mail, Shield, UserPlus, CheckCircle, Wifi, AlertTriangle } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, testFirebaseConnection } from '@/lib/firebase';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();

  // Super admin setup states
  const [showSuperAdminSetup, setShowSuperAdminSetup] = useState(false);
  const [superAdminExists, setSuperAdminExists] = useState<boolean | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [superAdminForm, setSuperAdminForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: 'Super Administrateur'
  });

  // Check Firebase connection and super admin existence on component mount
  useEffect(() => {
    const initializeFirebaseChecks = async () => {
      try {
        // Test Firebase connection
        console.log('Testing Firebase connection on login page load...');
        const connectionTest = await testFirebaseConnection();
        setFirebaseStatus(connectionTest.success ? 'connected' : 'disconnected');

        if (connectionTest.success) {
          // Only check super admin if connection is working
          const usersRef = collection(db, 'users');
          const snapshot = await getDocs(usersRef);
          const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const hasSuperAdmin = users.some(user => (user as any).role === 'superadmin');
          setSuperAdminExists(hasSuperAdmin);
        } else {
          console.error('Firebase connection failed:', connectionTest.error);
          setSuperAdminExists(null);
        }
      } catch (error) {
        console.error('Error initializing Firebase checks:', error);
        setFirebaseStatus('disconnected');
        setSuperAdminExists(null);
      }
    };

    initializeFirebaseChecks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    }
  };

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (superAdminForm.password !== superAdminForm.confirmPassword) {
      setSetupError('Les mots de passe ne correspondent pas');
      return;
    }

    if (superAdminForm.password.length < 6) {
      setSetupError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setSetupLoading(true);
    setSetupError('');

    try {
      // Test Firebase connection first
      console.log('Testing Firebase connection before creating super admin...');
      const connectionTest = await testFirebaseConnection();

      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.error}`);
      }

      console.log('Firebase connection OK, proceeding with super admin creation...');
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        superAdminForm.email,
        superAdminForm.password
      );

      // Create super admin document in Firestore
      const userData = {
        email: superAdminForm.email,
        nom: superAdminForm.nom,
        role: 'superadmin',
        telephone: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      setSetupSuccess(true);
      setSuperAdminExists(true);

      // Clear form
      setSuperAdminForm({
        email: '',
        password: '',
        confirmPassword: '',
        nom: 'Super Administrateur'
      });

      // Close dialog after 2 seconds
      setTimeout(() => {
        setShowSuperAdminSetup(false);
        setSetupSuccess(false);
      }, 2000);

    } catch (error: any) {
      let errorMessage = 'Erreur lors de la création du super administrateur';

      console.error('Super admin creation error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Check if this is a connection test failure
      if (error.message && error.message.includes('Connection test failed')) {
        errorMessage = `Problème de connexion Firebase: ${error.message.replace('Connection test failed: ', '')}`;
      } else {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Cette adresse email est déjà utilisée. Un compte existe déjà avec cet email.';
            // Refresh the super admin check in case one was created
            setTimeout(() => {
              const recheckSuperAdmin = async () => {
                try {
                  const usersRef = collection(db, 'users');
                  const snapshot = await getDocs(usersRef);
                  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                  const hasSuperAdmin = users.some(user => (user as any).role === 'superadmin');
                  setSuperAdminExists(hasSuperAdmin);
                } catch (err) {
                  console.error('Error rechecking super admin:', err);
                }
              };
              recheckSuperAdmin();
            }, 1000);
            break;
          case 'auth/weak-password':
            errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Adresse email invalide';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Erreur de connexion réseau. Vérifiez votre connexion internet et la configuration Firebase.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Trop de tentatives. Veuillez attendre quelques minutes avant de réessayer.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Authentification par email/mot de passe non activée dans Firebase Console.';
            break;
          case 'auth/project-not-found':
            errorMessage = 'Projet Firebase introuvable. Vérifiez la configuration.';
            break;
          default:
            errorMessage = error.message || `Erreur: ${error.code || 'UNKNOWN_ERROR'}`;
        }
      }

      setSetupError(errorMessage);
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Secteurs</h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre espace</p>

          {/* Firebase Status Indicator */}
          <div className="mt-3">
            {firebaseStatus === 'connected' && (
              <div className="flex items-center justify-center text-green-600 text-sm">
                <Wifi className="h-4 w-4 mr-1" />
                Firebase connecté
              </div>
            )}
            {firebaseStatus === 'disconnected' && (
              <div className="flex items-center justify-center text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Problème de connexion Firebase
              </div>
            )}
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Connexion</CardTitle>
            <CardDescription>
              Entrez vos identifiants pour accéder au système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre.email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error}
                    {error.includes('Utilisateur non trouvé') && (
                      <div className="mt-2 text-sm">
                        <p>Assurez-vous que votre compte a été créé par un administrateur.</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            {/* Super Admin Setup Section */}
            {superAdminExists === false && firebaseStatus === 'connected' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <Alert className="mb-4">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Première installation :</strong> Aucun super administrateur détecté.
                      Créez le premier compte pour configurer le système.
                    </AlertDescription>
                  </Alert>

                  <Dialog open={showSuperAdminSetup} onOpenChange={setShowSuperAdminSetup}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Créer un Super Administrateur
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center">
                          <Shield className="mr-2 h-5 w-5 text-blue-600" />
                          Configuration Initiale
                        </DialogTitle>
                        <DialogDescription>
                          Créez le premier compte super administrateur pour gérer le système
                        </DialogDescription>
                      </DialogHeader>

                      {setupSuccess ? (
                        <div className="text-center space-y-4 py-4">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                          <h3 className="text-lg font-semibold text-green-800">
                            Super administrateur créé !
                          </h3>
                          <p className="text-green-700 text-sm">
                            Vous pouvez maintenant vous connecter avec ces identifiants.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="super-email">Email</Label>
                            <Input
                              id="super-email"
                              type="email"
                              value={superAdminForm.email}
                              onChange={(e) => setSuperAdminForm(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="admin@exemple.com"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="super-nom">Nom complet</Label>
                            <Input
                              id="super-nom"
                              value={superAdminForm.nom}
                              onChange={(e) => setSuperAdminForm(prev => ({ ...prev, nom: e.target.value }))}
                              placeholder="Nom et prénom"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="super-password">Mot de passe</Label>
                            <Input
                              id="super-password"
                              type="password"
                              value={superAdminForm.password}
                              onChange={(e) => setSuperAdminForm(prev => ({ ...prev, password: e.target.value }))}
                              placeholder="Au moins 6 caractères"
                              required
                              minLength={6}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="super-confirm">Confirmer le mot de passe</Label>
                            <Input
                              id="super-confirm"
                              type="password"
                              value={superAdminForm.confirmPassword}
                              onChange={(e) => setSuperAdminForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              placeholder="Répétez le mot de passe"
                              required
                              minLength={6}
                            />
                          </div>

                          {setupError && (
                            <Alert variant="destructive">
                              <AlertDescription>
                                {setupError}
                                {setupError.includes('déjà utilisée') && (
                                  <div className="mt-2 text-sm">
                                    <p><strong>Solutions possibles :</strong></p>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                      <li>Utilisez une adresse email différente</li>
                                      <li>Ou essayez de vous connecter avec cet email s'il s'agit de votre compte</li>
                                      <li>Contactez l'administrateur si vous pensez qu'il y a une erreur</li>
                                    </ul>
                                  </div>
                                )}
                                {setupError.includes('réseau') && (
                                  <div className="mt-2 text-sm">
                                    <p><strong>Vérifiez :</strong></p>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                      <li>Votre connexion internet</li>
                                      <li>Que Firebase est accessible</li>
                                      <li>Réessayez dans quelques minutes</li>
                                    </ul>
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" type="button" onClick={() => setShowSuperAdminSetup(false)}>
                              Annuler
                            </Button>
                            <Button
                              type="submit"
                              disabled={setupLoading}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600"
                            >
                              {setupLoading ? 'Création...' : 'Créer'}
                            </Button>
                          </div>
                        </form>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}

            {/* Firebase Connection Error */}
            {firebaseStatus === 'disconnected' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Problème de connexion Firebase</strong></p>
                      <p className="text-sm">
                        Impossible de se connecter aux services Firebase.
                        Les fonctionnalités de connexion et de création de compte ne sont pas disponibles.
                      </p>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.reload()}
                          className="mr-2"
                        >
                          Recharger la page
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const test = await testFirebaseConnection();
                            setFirebaseStatus(test.success ? 'connected' : 'disconnected');
                          }}
                        >
                          Tester la connexion
                        </Button>
                      </div>
                      <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                        <p><strong>Solutions possibles :</strong></p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Vérifiez votre connexion internet</li>
                          <li>Vérifiez que Firebase est correctement configuré</li>
                          <li>Vérifiez la configuration du projet Firebase</li>
                          <li>Contactez l'administrateur système</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
};
