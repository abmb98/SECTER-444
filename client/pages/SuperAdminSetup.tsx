import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertCircle, UserCheck, Key } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function SuperAdminSetup() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [superAdminExists, setSuperAdminExists] = useState<boolean | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom: 'Super Administrateur'
  });

  // Check if super admin already exists
  useEffect(() => {
    const checkSuperAdminExists = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const hasSuperAdmin = users.some(user => (user as any).role === 'superadmin');
        setSuperAdminExists(hasSuperAdmin);
      } catch (error) {
        console.error('Error checking super admin:', error);
        setSuperAdminExists(false);
      }
    };

    checkSuperAdminExists();
  }, []);

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Create super admin document in Firestore
      const userData = {
        email: formData.email,
        nom: formData.nom,
        role: 'superadmin',
        telephone: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      setSetupComplete(true);
      setMessage('Super administrateur créé avec succès ! Vous pouvez maintenant accéder à tous les outils d\'administration.');
      
      // Clear form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        nom: 'Super Administrateur'
      });

    } catch (error: any) {
      let errorMessage = 'Erreur lors de la création du super administrateur';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Cette adresse email est déjà utilisée';
          break;
        case 'auth/weak-password':
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Adresse email invalide';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (authLoading || superAdminExists === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Vérification du système...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If super admin already exists and user is authenticated
  if (superAdminExists && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Système déjà configuré
              </h3>
              <p className="text-gray-600 mb-4">
                Un super administrateur existe déjà dans le système.
              </p>
              <Button 
                onClick={() => window.location.href = '/admin-tools'}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 mb-2"
              >
                Accéder aux outils d'administration
              </Button>
              <br />
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
              >
                Retour au tableau de bord
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If super admin already exists but user is not authenticated
  if (superAdminExists && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <UserCheck className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connectez-vous en tant que super administrateur
              </h3>
              <p className="text-gray-600 mb-4">
                Un super administrateur existe déjà. Connectez-vous avec ces identifiants.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                Aller à la page de connexion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main setup form (no super admin exists)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Configuration Initiale
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Créez le premier compte super administrateur pour gérer le système
          </p>
        </CardHeader>
        
        <CardContent>
          {setupComplete ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-green-800">
                Configuration terminée !
              </h3>
              <p className="text-green-700 text-sm">
                Le super administrateur a été créé avec succès.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => window.location.href = '/admin-tools'}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  Accéder aux outils d'administration
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'}
                  variant="outline"
                  className="w-full"
                >
                  Retour au tableau de bord
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  <strong>Première configuration :</strong> Créez le compte super administrateur 
                  qui aura accès à tous les outils de gestion du système.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="email">Email du super administrateur</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@exemple.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nom">Nom complet</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Nom et prénom"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Au moins 6 caractères"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Répétez le mot de passe"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {message && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {loading ? 'Création en cours...' : 'Créer le super administrateur'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
