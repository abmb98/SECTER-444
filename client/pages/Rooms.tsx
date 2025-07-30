import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  BedDouble,
  Plus,
  Search,
  Edit,
  Users,
  Home,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  RotateCcw,
  Clock,
  UserCheck,
  UserX,
  Eye,
  Calendar
} from 'lucide-react';
import { useFirestore } from '@/hooks/useFirestore';
import { Room, Ferme, Worker } from '@shared/types';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FirebaseConnectionTest from '@/components/FirebaseConnectionTest';

export default function Rooms() {
  const { user, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFerme, setSelectedFerme] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRoomDetailsOpen, setIsRoomDetailsOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Fetch data from Firebase with real-time updates
  const { data: allRooms, loading: roomsLoading, error: roomsError, addDocument, updateDocument, deleteDocument, refetch: refetchRooms } = useFirestore<Room>('rooms', true, true);
  const { data: fermes, error: fermesError, refetch: refetchFermes } = useFirestore<Ferme>('fermes', true, true);
  const { data: workers, error: workersError, refetch: refetchWorkers } = useFirestore<Worker>('workers', true, true);

  // Combine all errors
  const error = roomsError || fermesError || workersError;
  const loading = roomsLoading;

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [recalculatingFerme, setRecalculatingFerme] = useState(false);
  const [formData, setFormData] = useState({
    numero: '',
    fermeId: user?.fermeId || '',
    genre: 'hommes' as 'hommes' | 'femmes',
    capaciteTotale: 4,
    occupantsActuels: 0,
    listeOccupants: [] as string[]
  });

  const [addFormData, setAddFormData] = useState({
    numero: '',
    fermeId: user?.fermeId || '',
    genre: 'hommes' as 'hommes' | 'femmes',
    capaciteTotale: 4
  });

  // Filter rooms based on user role and filters
  const filteredRooms = allRooms.filter(room => {
    // Role-based filtering
    if (!isSuperAdmin && user?.fermeId) {
      if (room.fermeId !== user.fermeId) return false;
    }
    
    // Search filter
    if (searchTerm && !room.numero.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Ferme filter (for superadmin)
    if (selectedFerme !== 'all' && room.fermeId !== selectedFerme) {
      return false;
    }
    
    // Genre filter
    if (selectedGenre !== 'all' && room.genre !== selectedGenre) {
      return false;
    }
    
    return true;
  });

  const getOccupancyStatus = (room: Room) => {
    const percentage = (room.occupantsActuels / room.capaciteTotale) * 100;
    if (percentage === 0) return { label: 'Libre', variant: 'secondary' as const, color: 'gray' };
    if (percentage < 100) return { label: 'Partiellement occupée', variant: 'default' as const, color: 'blue' };
    return { label: 'Complète', variant: 'destructive' as const, color: 'red' };
  };

  const getGenreBadge = (genre: string) => {
    return genre === 'hommes' 
      ? <Badge className="bg-blue-100 text-blue-800">Hommes</Badge>
      : <Badge className="bg-pink-100 text-pink-800">Femmes</Badge>;
  };

  const getFermeName = (fermeId: string) => {
    const ferme = fermes.find(f => f.id === fermeId);
    return ferme?.nom || fermeId;
  };

  const getOccupantNames = (room: Room) => {
    return room.listeOccupants.map(occupantId => {
      // Try to find worker by ID first, then by CIN as fallback
      const worker = workers.find(w => w.id === occupantId) || workers.find(w => w.cin === occupantId);

      // Debug: Log if we can't find a worker for an occupant
      if (!worker) {
        console.log(`⚠️ Could not find worker for occupant ID: ${occupantId} in room ${room.numero}`);
      }

      return worker?.nom || `Unknown (${occupantId.slice(0, 8)}...)`;
    });
  };

  // Get all workers who have been in this room (both active and inactive)
  const getRoomWorkerHistory = (room: Room) => {
    if (!room) return { activeWorkers: [], inactiveWorkers: [] };

    // Find all workers who have been assigned to this room
    const roomWorkers = workers.filter(worker => 
      worker.chambre === room.numero && 
      worker.fermeId === room.fermeId &&
      // Match gender with room type
      ((worker.sexe === 'homme' && room.genre === 'hommes') ||
       (worker.sexe === 'femme' && room.genre === 'femmes'))
    );

    // Calculate stay duration for each worker
    const workersWithDuration = roomWorkers.map(worker => {
      let stayDuration = 0;
      
      if (worker.dateEntree) {
        const entryDate = new Date(worker.dateEntree);
        const exitDate = worker.dateSortie ? new Date(worker.dateSortie) : new Date();
        stayDuration = Math.floor((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        ...worker,
        stayDuration
      };
    });

    // Separate active and inactive workers
    const activeWorkers = workersWithDuration
      .filter(w => w.statut === 'actif')
      .sort((a, b) => new Date(b.dateEntree).getTime() - new Date(a.dateEntree).getTime());
    
    const inactiveWorkers = workersWithDuration
      .filter(w => w.statut === 'inactif')
      .sort((a, b) => {
        // Sort by exit date (most recent first), then by entry date
        if (a.dateSortie && b.dateSortie) {
          return new Date(b.dateSortie).getTime() - new Date(a.dateSortie).getTime();
        }
        return new Date(b.dateEntree).getTime() - new Date(a.dateEntree).getTime();
      });

    return { activeWorkers, inactiveWorkers };
  };

  // Handle room card click to show details
  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setIsRoomDetailsOpen(true);
  };

  // Function to repair room occupancy data
  const repairRoomOccupancy = async () => {
    setRecalculatingFerme(true);
    try {
      console.log('🔧 Starting room occupancy repair...');

      const batch = writeBatch(db);
      let repairsNeeded = 0;

      for (const room of allRooms) {
        // Find workers actually assigned to this room that are active
        const actualOccupants = workers.filter(worker =>
          worker.chambre === room.numero &&
          worker.fermeId === room.fermeId &&
          worker.statut === 'actif' &&
          // Only count workers whose gender matches the room
          ((worker.sexe === 'homme' && room.genre === 'hommes') ||
           (worker.sexe === 'femme' && room.genre === 'femmes'))
        );

        const actualOccupantIds = actualOccupants.map(w => w.id);
        const actualCount = actualOccupants.length;

        // Check if repair is needed
        const needsRepair =
          room.occupantsActuels !== actualCount ||
          room.listeOccupants.length !== actualCount ||
          !actualOccupantIds.every(id => room.listeOccupants.includes(id));

        if (needsRepair) {
          console.log(`🔧 Repairing room ${room.numero}: ${room.occupantsActuels} → ${actualCount} occupants`);
          console.log(`  Gender: ${room.genre}, Actual occupants:`, actualOccupants.map(w => `${w.nom}(${w.sexe})`));

          const roomRef = doc(db, 'rooms', room.id);
          batch.update(roomRef, {
            listeOccupants: actualOccupantIds,
            occupantsActuels: actualCount,
            updatedAt: new Date()
          });

          repairsNeeded++;
        }
      }

      if (repairsNeeded > 0) {
        await batch.commit();
        console.log(`✅ Repaired ${repairsNeeded} rooms`);
      } else {
        console.log('✅ No room repairs needed');
      }

    } catch (error) {
      console.error('❌ Error during room repair:', error);
    } finally {
      setRecalculatingFerme(false);
    }
  };

  const recalculateFermeCapacity = async (fermeId: string) => {
    setRecalculatingFerme(true);
    try {
      console.log(`🔄 Recalculating capacity for ferme: ${fermeId}`);

      // Get all rooms for this ferme
      const fermeRooms = allRooms.filter(r => r.fermeId === fermeId);

      // Calculate total capacity and total chambers
      const totalCapacity = fermeRooms.reduce((total, room) => total + room.capaciteTotale, 0);
      const totalChambres = fermeRooms.length;

      console.log(`📊 Ferme ${fermeId} - Total capacity: ${totalCapacity}, Total chambers: ${totalChambres}`);

      // Update the ferme document
      const fermeRef = doc(db, 'fermes', fermeId);
      await updateDoc(fermeRef, {
        totalOuvriers: totalCapacity,
        totalChambres: totalChambres,
        updatedAt: new Date()
      });

      console.log(`✅ Successfully updated ferme ${fermeId} capacity to ${totalCapacity}`);
    } catch (error) {
      console.error('❌ Error recalculating ferme capacity:', error);
      throw error;
    } finally {
      setRecalculatingFerme(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError('');

    try {
      // Validate required fields
      if (!addFormData.numero.trim()) {
        setSaveError('Le numéro de chambre est requis');
        return;
      }

      if (!addFormData.fermeId) {
        setSaveError('La ferme est requise');
        return;
      }

      if (addFormData.capaciteTotale < 1) {
        setSaveError('La capacité doit être d\'au moins 1');
        return;
      }

      // Check if room number already exists in this ferme
      const existingRoom = allRooms.find(r =>
        r.numero === addFormData.numero && r.fermeId === addFormData.fermeId
      );
      if (existingRoom) {
        setSaveError('Une chambre avec ce numéro existe déjà dans cette ferme');
        return;
      }

      // Create new room data
      const newRoomData = {
        numero: addFormData.numero.trim(),
        fermeId: addFormData.fermeId,
        genre: addFormData.genre,
        capaciteTotale: addFormData.capaciteTotale,
        occupantsActuels: 0,
        listeOccupants: []
      };

      console.log('🏠 Creating new room:', newRoomData);

      // Add room to database
      await addDocument(newRoomData);

      // Recalculate ferme capacity
      try {
        await recalculateFermeCapacity(addFormData.fermeId);
        console.log('✅ Ferme capacity updated after room creation');
      } catch (fermeError) {
        console.error('❌ Failed to update ferme capacity after room creation:', fermeError);
        // Room was created but ferme capacity update failed - show warning
        setSaveError('Chambre créée, mais erreur lors du recalcul de la capacité totale de la ferme');
      }

      // Reset form and close dialog
      setAddFormData({
        numero: '',
        fermeId: user?.fermeId || '',
        genre: 'hommes',
        capaciteTotale: 4
      });
      setIsAddDialogOpen(false);

      console.log('✅ Room created successfully');
    } catch (error) {
      console.error('❌ Error creating room:', error);
      setSaveError('Erreur lors de la création de la chambre');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      numero: room.numero,
      fermeId: room.fermeId,
      genre: room.genre,
      capaciteTotale: room.capaciteTotale,
      occupantsActuels: room.occupantsActuels,
      listeOccupants: room.listeOccupants
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    setSaveLoading(true);
    setSaveError('');

    try {
      // Validate capacity
      if (formData.capaciteTotale < formData.occupantsActuels) {
        setSaveError('La nouvelle capacité ne peut pas être inférieure au nombre d\'occupants actuels');
        return;
      }

      // Update room data
      const updatedData = {
        numero: formData.numero,
        genre: formData.genre,
        capaciteTotale: formData.capaciteTotale,
        // Keep existing occupants data
        occupantsActuels: editingRoom.occupantsActuels,
        listeOccupants: editingRoom.listeOccupants
      };

      await updateDocument(editingRoom.id, updatedData);

      // Recalculate ferme capacity if the room capacity changed
      if (editingRoom.capaciteTotale !== formData.capaciteTotale) {
        console.log(`Room capacity changed from ${editingRoom.capaciteTotale} to ${formData.capaciteTotale}`);
        try {
          await recalculateFermeCapacity(editingRoom.fermeId);
          console.log('✅ Ferme capacity updated successfully');
        } catch (fermeError) {
          console.error('❌ Failed to update ferme capacity:', fermeError);
          // Room was updated but ferme capacity failed - show warning
          setSaveError('Chambre mise à jour, mais erreur lors du recalcul de la capacité totale de la ferme');
        }
      }

      setIsEditDialogOpen(false);
      setEditingRoom(null);
      setFormData({
        numero: '',
        fermeId: user?.fermeId || '',
        genre: 'hommes',
        capaciteTotale: 4,
        occupantsActuels: 0,
        listeOccupants: []
      });
    } catch (error) {
      console.error('Error updating room:', error);
      setSaveError('Erreur lors de la mise à jour de la chambre');
    } finally {
      setSaveLoading(false);
    }
  };

  // Manual retry function
  const handleRetryData = async () => {
    console.log('🔄 Manual data retry triggered');
    try {
      await Promise.all([
        refetchRooms(),
        refetchFermes(),
        refetchWorkers()
      ]);
      console.log('✅ Data refetch completed');
    } catch (error) {
      console.error('❌ Data refetch failed:', error);
    }
  };

  // Auto-repair room occupancy when data is loaded
  React.useEffect(() => {
    if (allRooms.length > 0 && workers.length > 0 && (isSuperAdmin || user?.role === 'admin')) {
      // Auto-repair after a short delay to ensure all data is loaded
      const timer = setTimeout(() => {
        repairRoomOccupancy();
      }, 3000); // 3 second delay

      return () => clearTimeout(timer);
    }
  }, [allRooms.length, workers.length, isSuperAdmin, user?.role]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BedDouble className="mr-3 h-8 w-8" />
            Gestion des chambres
          </h1>
          <div className="flex items-center space-x-3 mt-2">
            <p className="text-gray-600">
              {isSuperAdmin
                ? `${filteredRooms.length} chambres dans toutes les fermes`
                : `${filteredRooms.length} chambres dans votre ferme`
              }
            </p>
            <div className="flex items-center space-x-3">
              <div className={`flex items-center text-sm ${
                error ? 'text-red-600' :
                loading ? 'text-blue-600' :
                'text-green-600'
              }`}>
                {error ? (
                  <WifiOff className="h-4 w-4 mr-1" />
                ) : loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                ) : (
                  <Wifi className="h-4 w-4 mr-1" />
                )}
                <span>
                  {error ? 'Connexion échouée' :
                   loading ? 'Connexion...' :
                   'Temps réel actif'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle chambre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter une chambre</DialogTitle>
              <DialogDescription>
                Créez une nouvelle chambre dans le système
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddRoom} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-numero">Numéro de chambre</Label>
                <Input
                  id="add-numero"
                  placeholder="Ex: 301"
                  value={addFormData.numero}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, numero: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select
                  value={addFormData.genre}
                  onValueChange={(value: 'hommes' | 'femmes') => setAddFormData(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hommes">Hommes</SelectItem>
                    <SelectItem value="femmes">Femmes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-capacite">Capacité maximale</Label>
                <Input
                  id="add-capacite"
                  type="number"
                  placeholder="4"
                  value={addFormData.capaciteTotale}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, capaciteTotale: parseInt(e.target.value) || 1 }))}
                  min="1"
                  required
                />
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Ferme</Label>
                  <Select
                    value={addFormData.fermeId}
                    onValueChange={(value) => setAddFormData(prev => ({ ...prev, fermeId: value }))}
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

              {saveError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {saveError}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setSaveError('');
                    setAddFormData({
                      numero: '',
                      fermeId: user?.fermeId || '',
                      genre: 'hommes',
                      capaciteTotale: 4
                    });
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saveLoading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {saveLoading ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connection Status & Error Display */}
      {(error || loading) && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <h3 className="font-medium text-red-800">Erreur de connexion détectée</h3>
              </div>
              <p className="text-red-700 mb-3">{error}</p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <FirebaseConnectionTest />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleRetryData}
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 border-blue-200"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Réessayer le chargement
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-blue-700">Chargement des données des chambres...</p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par numéro de chambre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {isSuperAdmin && (
              <Select value={selectedFerme} onValueChange={setSelectedFerme}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Toutes les fermes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les fermes</SelectItem>
                  {fermes.map(ferme => (
                    <SelectItem key={ferme.id} value={ferme.id}>
                      {ferme.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="hommes">Hommes</SelectItem>
                <SelectItem value="femmes">Femmes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => {
          const occupancyStatus = getOccupancyStatus(room);
          const occupancyPercentage = (room.occupantsActuels / room.capaciteTotale) * 100;
          const occupantNames = getOccupantNames(room);
          
          return (
            <Card 
              key={room.id} 
              className="transition-all duration-200 hover:shadow-lg cursor-pointer"
              onClick={() => handleRoomClick(room)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      occupancyPercentage === 0 ? 'bg-gray-100' :
                      occupancyPercentage < 100 ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      <BedDouble className={`h-5 w-5 ${
                        occupancyPercentage === 0 ? 'text-gray-600' :
                        occupancyPercentage < 100 ? 'text-blue-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        Chambre {room.numero}
                      </CardTitle>
                      {isSuperAdmin && (
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                          <Home className="mr-1 h-3 w-3" />
                          {getFermeName(room.fermeId)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getGenreBadge(room.genre)}
                    <Badge variant={occupancyStatus.variant}>
                      {occupancyStatus.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Occupancy */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Occupation</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {room.occupantsActuels}/{room.capaciteTotale}
                      </span>
                    </div>
                    <Progress value={occupancyPercentage} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{room.occupantsActuels} occupants</span>
                      <span>{room.capaciteTotale - room.occupantsActuels} places libres</span>
                    </div>
                  </div>

                  {/* Occupants */}
                  {occupantNames.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        Occupants actuels
                      </h4>
                      <div className="space-y-1">
                        {occupantNames.map((name, index) => (
                          <div key={index} className="text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center text-sm">
                      {occupancyPercentage === 0 ? (
                        <CheckCircle className="mr-1 h-4 w-4 text-green-600" />
                      ) : occupancyPercentage < 100 ? (
                        <AlertCircle className="mr-1 h-4 w-4 text-blue-600" />
                      ) : (
                        <AlertCircle className="mr-1 h-4 w-4 text-red-600" />
                      )}
                      <span className="text-gray-600">
                        {occupancyPercentage === 0 ? 'Disponible' :
                         occupancyPercentage < 100 ? 'Partiellement occupée' : 'Complète'}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditRoom(room);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Modifier
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Room Details Modal */}
      <Dialog open={isRoomDetailsOpen} onOpenChange={setIsRoomDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Eye className="mr-2 h-5 w-5" />
              Chambre {selectedRoom?.numero} - Historique des occupants
            </DialogTitle>
            <DialogDescription>
              Liste de tous les ouvriers qui ont séjourné dans cette chambre
            </DialogDescription>
          </DialogHeader>

          {selectedRoom && (() => {
            const { activeWorkers, inactiveWorkers } = getRoomWorkerHistory(selectedRoom);
            const totalWorkers = activeWorkers.length + inactiveWorkers.length;
            
            return (
              <div className="space-y-6">
                {/* Room Summary */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Capacité</p>
                      <p className="font-semibold">{selectedRoom.capaciteTotale} places</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Occupation actuelle</p>
                      <p className="font-semibold">{selectedRoom.occupantsActuels}/{selectedRoom.capaciteTotale}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Genre</p>
                      <p className="font-semibold capitalize">{selectedRoom.genre}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total ouvriers</p>
                      <p className="font-semibold">{totalWorkers} personnes</p>
                    </div>
                  </div>
                </div>

                {/* Active Workers */}
                {activeWorkers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center">
                      <UserCheck className="mr-2 h-5 w-5" />
                      Occupants actuels ({activeWorkers.length})
                    </h3>
                    <div className="grid gap-3">
                      {activeWorkers.map((worker) => (
                        <Card key={worker.id} className="border-green-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <UserCheck className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{worker.nom}</h4>
                                  <p className="text-sm text-gray-600">CIN: {worker.cin}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center text-sm text-gray-600 mb-1">
                                  <Calendar className="mr-1 h-3 w-3" />
                                  Arrivé le {new Date(worker.dateEntree).toLocaleDateString('fr-FR')}
                                </div>
                                <div className="flex items-center text-sm text-green-600">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {worker.stayDuration} jours de séjour
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inactive Workers */}
                {inactiveWorkers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                      <UserX className="mr-2 h-5 w-5" />
                      Anciens occupants ({inactiveWorkers.length})
                    </h3>
                    <div className="grid gap-3">
                      {inactiveWorkers.map((worker) => (
                        <Card key={worker.id} className="border-gray-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                  <UserX className="h-5 w-5 text-gray-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{worker.nom}</h4>
                                  <p className="text-sm text-gray-600">CIN: {worker.cin}</p>
                                  {worker.motif && (
                                    <p className="text-xs text-gray-500">Motif: {worker.motif}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center text-sm text-gray-600 mb-1">
                                  <Calendar className="mr-1 h-3 w-3" />
                                  {new Date(worker.dateEntree).toLocaleDateString('fr-FR')} - {worker.dateSortie ? new Date(worker.dateSortie).toLocaleDateString('fr-FR') : 'N/A'}
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {worker.stayDuration} jours de séjour
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* No workers message */}
                {totalWorkers === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun occupant</h3>
                    <p className="text-gray-600">Cette chambre n'a pas encore eu d'occupants.</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsRoomDetailsOpen(false)}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la chambre</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la chambre {editingRoom?.numero}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-numero">Numéro de chambre</Label>
              <Input
                id="edit-numero"
                value={formData.numero}
                onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                placeholder="Ex: 301"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={formData.genre}
                onValueChange={(value: 'hommes' | 'femmes') => setFormData(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hommes">Hommes</SelectItem>
                  <SelectItem value="femmes">Femmes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-capacite">Capacité maximale</Label>
              <Input
                id="edit-capacite"
                type="number"
                value={formData.capaciteTotale}
                onChange={(e) => setFormData(prev => ({ ...prev, capaciteTotale: parseInt(e.target.value) || 0 }))}
                placeholder="4"
                min="1"
                required
              />
              {editingRoom && formData.capaciteTotale < editingRoom.occupantsActuels && (
                <p className="text-sm text-red-600">
                  ⚠️ La capacité ne peut pas être inférieure au nombre d'occupants actuels ({editingRoom.occupantsActuels})
                </p>
              )}
              {editingRoom && formData.capaciteTotale !== editingRoom.capaciteTotale && (
                <p className="text-sm text-blue-600">
                  ℹ️ La capacité totale de la ferme sera automatiquement recalculée
                </p>
              )}
            </div>

            {editingRoom && editingRoom.occupantsActuels > 0 && (
              <div className="space-y-2">
                <Label>Occupants actuels</Label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{editingRoom.occupantsActuels} occupant(s) dans cette chambre</p>
                  <p className="text-xs mt-1">
                    Ces occupants seront conservés après la modification
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {saveError}
              </div>
            )}

            {recalculatingFerme && (
              <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Recalcul de la capacité totale de la ferme en cours...
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSaveError('');
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saveLoading || recalculatingFerme || (editingRoom && formData.capaciteTotale < editingRoom.occupantsActuels)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {saveLoading ? 'Sauvegarde...' : recalculatingFerme ? 'Recalcul...' : 'Sauvegarder'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
