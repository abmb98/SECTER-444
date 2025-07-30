import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, UserPlus, Users, AlertCircle, Edit, Trash2, Shield, Key } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserRole } from '@shared/types';

export default function AdminTools() {
  const { user, isSuperAdmin, logout } = useAuth();
  const { data: fermes } = useFirestore('fermes');
  const { data: allUsers, refetch: refetchUsers } = useFirestore('users');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    telephone: '',
    role: 'user' as UserRole,
    fermeId: ''
  });
  const [autoRestoreSession, setAutoRestoreSession] = useState(true);

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Accès non autorisé
              </h3>
              <p className="text-gray-600 mb-4">
                Seuls les super administrateurs peuvent accéder à cette page.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Pour accéder à cette page:</strong>
                </p>
                <p className="text-sm text-blue-700">
                  1. Déconnectez-vous de votre compte actuel<br/>
                  2. Connectez-vous avec un compte super administrateur<br/>
                  3. Ou demandez à un super administrateur de vous créer un compte
                </p>
              </div>
              <Button 
                onClick={async () => {
                  if (window.confirm('Voulez-vous vous déconnecter pour changer de compte ?')) {
                    await logout();
                  }
                }}
                variant="outline"
                className="mr-2"
              >
                Se déconnecter
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                Retour au tableau de bord
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Store current admin session info BEFORE creating new user
    const currentUser = auth.currentUser;
    const currentUserEmail = currentUser?.email;

    if (!currentUser || !currentUserEmail) {
      setError('Session invalide. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth (this will automatically sign in the new user)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Store the new user's UID for Firestore document creation
      const newUserUid = userCredential.user.uid;

      // Create user document in Firestore
      const userData = {
        email: formData.email,
        nom: formData.nom,
        telephone: formData.telephone,
        role: formData.role,
        ...(formData.role === 'admin' && { fermeId: formData.fermeId }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', newUserUid), userData);

      // Now sign out the newly created user to clear their session
      await auth.signOut();

      if (autoRestoreSession) {
        // Prompt for superadmin password to restore session
        const superAdminPassword = prompt(
          `Utilisateur créé avec succès!\n\nEntrez votre mot de passe administrateur pour restaurer votre session:`
        );

        if (superAdminPassword) {
          try {
            // Re-sign in the superadmin
            await signInWithEmailAndPassword(auth, currentUserEmail, superAdminPassword);
            setMessage(`✅ Utilisateur "${formData.email}" créé avec succès! Session administrateur restaurée.`);
          } catch (reAuthError) {
            console.error('Erreur de ré-authentification:', reAuthError);
            setError(`Utilisateur créé avec succès mais mot de passe administrateur incorrect. Veuillez vous reconnecter manuellement.`);
          }
        } else {
          setMessage(`Utilisateur "${formData.email}" créé avec succès. Restauration de session annulée - veuillez vous reconnecter.`);
        }
      } else {
        setMessage(`✅ Utilisateur "${formData.email}" créé avec succès. Vous avez été déconnecté comme demandé.`);
      }

      setFormData({
        email: '',
        password: '',
        nom: '',
        telephone: '',
        role: 'user',
        fermeId: ''
      });
      setIsCreateDialogOpen(false);
      setTimeout(() => {
        alert('Un nouvel utilisateur a été créé. Vous allez être déconnecté et devrez vous reconnecter pour continuer à administrer le système.');
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      let errorMessage = 'Erreur lors de la création de l\'utilisateur';
      
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
  
  const handleEditUser = (userToEdit: any) => {
    setEditingUser(userToEdit);
    setFormData({
      email: userToEdit.email,
      password: '',
      nom: userToEdit.nom,
      telephone: userToEdit.telephone,
      role: userToEdit.role,
      fermeId: userToEdit.fermeId || ''
    });
    setIsUserDialogOpen(true);
  };
  
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const userData: any = {
        nom: formData.nom,
        telephone: formData.telephone,
        role: formData.role,
        updatedAt: new Date()
      };
      
      // Handle fermeId based on role
      if (formData.role === 'admin' && formData.fermeId) {
        userData.fermeId = formData.fermeId;
      } else if (formData.role !== 'admin') {
        // Remove fermeId for non-admin users
        userData.fermeId = null;
      }
      
      await updateDoc(doc(db, 'users', editingUser.id), userData);
      
      setMessage(`Utilisateur mis à jour: ${editingUser.email}`);
      setEditingUser(null);
      setIsUserDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        nom: '',
        telephone: '',
        role: 'user',
        fermeId: ''
      });
      
      refetchUsers();
    } catch (error: any) {
      setError('Erreur lors de la mise à jour: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteUser = async (userToDelete: any) => {
    if (userToDelete.id === user?.uid) {
      setError('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userToDelete.email} ?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setMessage(`Utilisateur supprimé: ${userToDelete.email}`);
      refetchUsers();
    } catch (error: any) {
      setError('Erreur lors de la suppression: ' + error.message);
    }
  };
  
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Administrateur';
      case 'user': return 'Utilisateur';
      default: return role;
    }
  };
  
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFermeName = (fermeId: string) => {
    if (!fermeId) return '-';
    if (!fermes || fermes.length === 0) {
      console.log('Fermes data not loaded yet, showing ID:', fermeId);
      return fermeId; // Still loading or no fermes data
    }
    const ferme = fermes.find(f => f.id === fermeId);
    if (ferme) {
      console.log('Found ferme:', ferme.nom, 'for ID:', fermeId);
      return ferme.nom;
    } else {
      console.log('Ferme not found for ID:', fermeId, 'Available fermes:', fermes.map(f => ({ id: f.id, nom: f.nom })));
      return fermeId; // Fallback to ID if ferme not found
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Settings className="mr-3 h-8 w-8" />
          Outils d'administration
        </h1>
        <p className="text-gray-600 mt-2">
          Gestion des utilisateurs et configuration du système
        </p>
      </div>

      {/* Alert about user creation */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note importante:</strong> Créer un nouvel utilisateur vous déconnectera temporairement. 
          Vous devrez vous reconnecter pour continuer l'administration.
        </AlertDescription>
      </Alert>

      {/* User Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserPlus className="mr-2 h-5 w-5" />
              Créer un nouvel utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nouveau compte utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer un utilisateur</DialogTitle>
                  <DialogDescription>
                    Attention: Vous serez déconnecté après la création
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="utilisateur@exemple.com"
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input
                        id="telephone"
                        value={formData.telephone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                        placeholder="0612345678"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="superadmin">Super Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.role === 'admin' && (
                    <div className="space-y-2">
                      <Label>Ferme assignée</Label>
                      <Select 
                        value={formData.fermeId} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, fermeId: value }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une ferme" />
                        </SelectTrigger>
                        <SelectContent>
                          {fermes.map(ferme => (
                            <SelectItem key={ferme.id} value={ferme.id}>
                              {ferme.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {message && (
                    <Alert>
                      <Users className="h-4 w-4" />
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading} 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {loading ? 'Création en cours...' : 'Créer l\'utilisateur'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Informations système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Total utilisateurs:</span>
                <span className="text-sm font-semibold text-gray-900">{allUsers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Super admins:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {allUsers.filter(u => u.role === 'superadmin').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Administrateurs:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {allUsers.filter(u => u.role === 'admin').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Utilisateurs:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {allUsers.filter(u => u.role === 'user').length}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Connecté en tant que:</span>
                  <Badge className={getRoleBadgeColor(user?.role || '')}>
                    {getRoleLabel(user?.role || '')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Gestion des utilisateurs ({allUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Ferme</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{userItem.nom}</div>
                        <div className="text-sm text-gray-500">{userItem.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(userItem.role)}>
                        {getRoleLabel(userItem.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {getFermeName(userItem.fermeId)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {userItem.telephone || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(userItem)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        {userItem.id !== user?.uid && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteUser(userItem)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations et permissions de l'utilisateur
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nom">Nom complet</Label>
              <Input
                id="edit-nom"
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-telephone">Téléphone</Label>
              <Input
                id="edit-telephone"
                value={formData.telephone}
                onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="superadmin">Super Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'admin' && (
              <div className="space-y-2">
                <Label>Ferme assignée</Label>
                <Select 
                  value={formData.fermeId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fermeId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une ferme" />
                  </SelectTrigger>
                  <SelectContent>
                    {fermes.map(ferme => (
                      <SelectItem key={ferme.id} value={ferme.id}>
                        {ferme.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" type="button" onClick={() => setIsUserDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {loading ? 'Mise à jour...' : 'Mettre à jour'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
