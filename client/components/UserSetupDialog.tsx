import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@shared/types';
import { useFirestore } from '@/hooks/useFirestore';
import { AlertCircle, Settings } from 'lucide-react';

interface UserSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export const UserSetupDialog: React.FC<UserSetupDialogProps> = ({ open, onClose }) => {
  const { user, firebaseUser } = useAuth();
  const { data: fermes } = useFirestore('fermes');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    telephone: user?.telephone || '',
    role: user?.role || 'user' as UserRole,
    fermeId: user?.fermeId || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        ...formData,
        updatedAt: new Date()
      });
      
      // Refresh the page to reload user data
      window.location.reload();
    } catch (error) {
      console.error('Error updating user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Compléter votre profil
          </DialogTitle>
          <DialogDescription>
            Veuillez compléter les informations de votre profil pour accéder au système.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Votre compte a été créé mais nécessite des informations supplémentaires.
            Contactez l'administrateur si vous avez besoin d'un rôle spécifique.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet</Label>
            <Input
              id="nom"
              value={formData.nom}
              onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
              placeholder="Votre nom complet"
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Mise à jour...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
