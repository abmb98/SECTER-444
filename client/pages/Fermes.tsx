import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  MapPin,
  Users,
  BedDouble,
  TrendingUp,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import { Ferme, Worker, Room } from '@shared/types';
import { forceSyncRoomOccupancy, getOccupancySummary } from '@/utils/syncUtils';

export default function Fermes() {
  const { user, isSuperAdmin } = useAuth();
  const { data: fermes, addDocument, updateDocument, deleteDocument } = useFirestore<Ferme>('fermes', true, true);
  const { data: workers } = useFirestore<Worker>('workers', true, true);
  const { data: rooms, updateDocument: updateRoom, addDocument: addRoom } = useFirestore<Room>('rooms', true, true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFerme, setEditingFerme] = useState<Ferme | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    totalChambres: 0,
    totalOuvriers: 0,
    admins: [] as string[]
  });

  const [chamberConfig, setChamberConfig] = useState({
    createChambers: true,
    chambresHommes: 10,
    chambresFemmes: 10,
    capaciteHommes: 4,
    capaciteFemmes: 4,
    startNumberHommes: 101,
    startNumberFemmes: 201
  });

  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Only superadmins can access this page
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
                Seuls les super administrateurs peuvent g��rer les fermes.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Conseil:</strong> Demandez à un super administrateur de vous donner les permissions nécessaires ou consultez le guide SUPERADMIN_SETUP.md
                </p>
              </div>
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

  // Sync room occupancy with worker assignments
  const syncRoomOccupancy = async () => {
    // Don't run if updateRoom function is not available
    if (!updateRoom) {
      console.log('updateRoom function not available yet, skipping sync');
      return;
    }

    try {
      console.log('Starting room occupancy sync...');
      // Group workers by room using gender-aware keys
      const workersByRoom = workers.reduce((acc, worker) => {
        if (worker.statut === 'actif' && worker.chambre && worker.fermeId) {
          const workerGender = worker.sexe === 'homme' ? 'hommes' : 'femmes';
          const key = `${worker.fermeId}-${worker.chambre}-${workerGender}`;
          acc[key] = (acc[key] || []).concat(worker);
        }
        return acc;
      }, {} as Record<string, Worker[]>);

      // Update room occupancy counts using gender-aware matching
      for (const room of rooms) {
        const roomKey = `${room.fermeId}-${room.numero}-${room.genre}`;
        const workersInRoom = workersByRoom[roomKey] || [];
        const actualOccupants = workersInRoom.length;

        // Only update if there's a discrepancy
        if (room.occupantsActuels !== actualOccupants) {
          console.log(`Updating room ${room.numero} occupancy: ${room.occupantsActuels} -> ${actualOccupants}`);
          try {
            await updateRoom(room.id, {
              occupantsActuels: actualOccupants,
              listeOccupants: workersInRoom.map(w => w.id),
              updatedAt: new Date()
            });
          } catch (error) {
            console.error(`Failed to update room ${room.numero}:`, error);
          }
        }
      }
      console.log('Room occupancy sync completed successfully');
    } catch (error) {
      console.error('Error syncing room occupancy:', error);
      // Don't let sync errors break the app
    }
  };

  // Run sync when component loads and when workers/rooms change (debounced)
  React.useEffect(() => {
    if (workers.length > 0 && rooms.length > 0 && updateRoom) {
      // Debounce the sync to avoid excessive API calls
      const timeoutId = setTimeout(() => {
        syncRoomOccupancy();
      }, 1000); // Wait 1 second after last change

      return () => clearTimeout(timeoutId);
    }
  }, [workers, rooms, updateRoom]);

  const filteredFermes = fermes.filter(ferme =>
    ferme.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFermeStats = (fermeId: string) => {
    const fermeWorkers = workers.filter(w => w.fermeId === fermeId && w.statut === 'actif');
    const fermeRooms = rooms.filter(r => r.fermeId === fermeId);

    // Calculate worker distribution by room - properly handle gender-specific rooms
    const workersByRoom = fermeWorkers.reduce((acc, worker) => {
      if (worker.chambre) {
        // Create a unique key that includes gender to avoid conflicts
        const workerGenderType = worker.sexe === 'homme' ? 'hommes' : 'femmes';
        const roomKey = `${worker.chambre}-${workerGenderType}`;
        acc[roomKey] = (acc[roomKey] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate room-based statistics
    const roomStats = fermeRooms.map(room => {
      // Use the same key format: roomNumber-gender
      const roomKey = `${room.numero}-${room.genre}`;
      const workersInRoom = workersByRoom[roomKey] || 0;
      const isOccupied = workersInRoom > 0;
      const capacityUsed = Math.min(workersInRoom, room.capaciteTotale);
      const utilizationRate = room.capaciteTotale > 0 ? (capacityUsed / room.capaciteTotale) * 100 : 0;

      return {
        room,
        workersCount: workersInRoom,
        isOccupied,
        capacityUsed,
        utilizationRate,
        isOvercapacity: workersInRoom > room.capaciteTotale
      };
    });

    // Aggregate statistics
    const occupiedRooms = roomStats.filter(stat => stat.isOccupied).length;
    const totalCapacity = fermeRooms.reduce((sum, room) => sum + room.capaciteTotale, 0);
    const totalOccupied = roomStats.reduce((sum, stat) => sum + stat.capacityUsed, 0);
    const averageUtilization = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

    // Gender distribution
    const maleWorkers = fermeWorkers.filter(w => w.sexe === 'homme').length;
    const femaleWorkers = fermeWorkers.filter(w => w.sexe === 'femme').length;

    // Room distribution by gender
    const maleRooms = fermeRooms.filter(r => r.genre === 'hommes').length;
    const femaleRooms = fermeRooms.filter(r => r.genre === 'femmes').length;

    // Workers without rooms (problematic cases)
    const workersWithoutRooms = fermeWorkers.filter(w => !w.chambre || w.chambre === '').length;

    // Overcapacity warnings
    const overcapacityRooms = roomStats.filter(stat => stat.isOvercapacity).length;

    return {
      // Basic counts
      totalOuvriers: fermeWorkers.length,
      totalChambres: fermeRooms.length,
      chambresOccupees: occupiedRooms,
      chambresVides: fermeRooms.length - occupiedRooms,

      // Capacity metrics
      totalCapacity,
      totalOccupied,
      placesDisponibles: totalCapacity - totalOccupied,
      tauxOccupation: Math.round(averageUtilization),

      // Gender distribution
      maleWorkers,
      femaleWorkers,
      maleRooms,
      femaleRooms,

      // Detailed room stats
      roomStats,
      workersByRoom,

      // Issues and warnings
      workersWithoutRooms,
      overcapacityRooms,
      hasIssues: workersWithoutRooms > 0 || overcapacityRooms > 0,

      // Performance indicators
      efficiencyScore: Math.round((averageUtilization + (occupiedRooms / fermeRooms.length * 100)) / 2),
      isWellUtilized: averageUtilization >= 60 && averageUtilization <= 90,
      needsAttention: workersWithoutRooms > 0 || overcapacityRooms > 0 || averageUtilization > 95
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let fermeId: string;

      if (editingFerme) {
        await updateDocument(editingFerme.id, formData);
        fermeId = editingFerme.id;
      } else {
        // Validation for chamber creation
        if (chamberConfig.createChambers) {
          const totalChambersCreated = chamberConfig.chambresHommes + chamberConfig.chambresFemmes;

          if (totalChambersCreated === 0) {
            alert('Veuillez spécifier au moins une chambre (hommes ou femmes).');
            setLoading(false);
            return;
          }

          // Validation for chamber capacity when chambers are specified
          if (chamberConfig.chambresHommes > 0 && chamberConfig.capaciteHommes <= 0) {
            alert('Veuillez spécifier une capacité valide pour les chambres hommes.');
            setLoading(false);
            return;
          }

          if (chamberConfig.chambresFemmes > 0 && chamberConfig.capaciteFemmes <= 0) {
            alert('Veuillez spécifier une capacité valide pour les chambres femmes.');
            setLoading(false);
            return;
          }
        }

        // Calculate total chambers if creating chambers automatically
        const totalChambres = chamberConfig.createChambers
          ? chamberConfig.chambresHommes + chamberConfig.chambresFemmes
          : formData.totalChambres;

        const totalCapacity = chamberConfig.createChambers
          ? (chamberConfig.chambresHommes * chamberConfig.capaciteHommes) +
            (chamberConfig.chambresFemmes * chamberConfig.capaciteFemmes)
          : formData.totalOuvriers;

        const fermeData = {
          ...formData,
          totalChambres,
          totalOuvriers: totalCapacity
        };

        fermeId = await addDocument(fermeData);

        // Create chambers automatically if enabled
        if (chamberConfig.createChambers && fermeId) {
          await createChambers(fermeId);
        }
      }

      // Reset form
      setFormData({
        nom: '',
        totalChambres: 0,
        totalOuvriers: 0,
        admins: []
      });
      setChamberConfig({
        createChambers: true,
        chambresHommes: 10,
        chambresFemmes: 10,
        capaciteHommes: 4,
        capaciteFemmes: 4,
        startNumberHommes: 101,
        startNumberFemmes: 201
      });
      setEditingFerme(null);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error saving ferme:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChambers = async (fermeId: string) => {
    const chambers: Omit<Room, 'id'>[] = [];

    // Create chambers for men (only if chambresHommes > 0)
    if (chamberConfig.chambresHommes > 0) {
      for (let i = 0; i < chamberConfig.chambresHommes; i++) {
        const chamberNumber = (chamberConfig.startNumberHommes + i).toString();
        chambers.push({
          numero: chamberNumber,
          fermeId,
          genre: 'hommes',
          capaciteTotale: chamberConfig.capaciteHommes,
          occupantsActuels: 0,
          listeOccupants: []
        });
      }
    }

    // Create chambers for women (only if chambresFemmes > 0)
    if (chamberConfig.chambresFemmes > 0) {
      for (let i = 0; i < chamberConfig.chambresFemmes; i++) {
        const chamberNumber = (chamberConfig.startNumberFemmes + i).toString();
        chambers.push({
          numero: chamberNumber,
          fermeId,
          genre: 'femmes',
          capaciteTotale: chamberConfig.capaciteFemmes,
          occupantsActuels: 0,
          listeOccupants: []
        });
      }
    }

    // Add all chambers to Firebase (if any were created)
    if (chambers.length > 0) {
      await Promise.all(chambers.map(chamber => addRoom(chamber)));
    }
  };

  const handleEdit = (ferme: Ferme) => {
    setFormData({
      nom: ferme.nom,
      totalChambres: ferme.totalChambres,
      totalOuvriers: ferme.totalOuvriers,
      admins: ferme.admins
    });
    setEditingFerme(ferme);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (fermeId: string, fermeName: string) => {
    // Get rooms count for this ferme
    const fermeRooms = rooms.filter(r => r.fermeId === fermeId);
    const roomsCount = fermeRooms.length;

    const confirmMessage = roomsCount > 0
      ? `Êtes-vous sûr de vouloir supprimer la ferme "${fermeName}" ?\n\nCETTE ACTION VA ÉGALEMENT SUPPRIMER ${roomsCount} CHAMBRE(S) ASSOCIÉE(S).\n\nCette action est irréversible.`
      : `Êtes-vous sûr de vouloir supprimer la ferme "${fermeName}" ?`;

    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        console.log(`Starting cascading delete for ferme: ${fermeName} (${fermeId})`);
        console.log(`Found ${roomsCount} rooms to delete`);

        // First, delete all rooms belonging to this ferme
        if (roomsCount > 0) {
          console.log('Deleting rooms...');
          for (const room of fermeRooms) {
            await deleteDoc(doc(db, 'rooms', room.id));
            console.log(`Deleted room: ${room.numero} (${room.id})`);
          }
          console.log(`Successfully deleted ${roomsCount} rooms`);
        }

        // Then delete the ferme itself
        console.log('Deleting ferme...');
        await deleteDocument(fermeId);
        console.log(`Successfully deleted ferme: ${fermeName}`);

        // Show success message
        alert(`Ferme "${fermeName}" et ses ${roomsCount} chambres ont été supprimées avec succès.`);

      } catch (error) {
        console.error('Error in cascading delete:', error);
        alert(`Erreur lors de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSyncOccupancy = async () => {
    setSyncLoading(true);
    try {
      await forceSyncRoomOccupancy(workers, rooms);
      console.log('✅ Room occupancy synchronized from Fermes page');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Building2 className="mr-2 sm:mr-3 h-6 w-6 sm:h-8 sm:w-8" />
            Gestion des fermes
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncOccupancy}
            disabled={syncLoading || loading}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full sm:w-auto"
          >
            <Activity className="mr-2 h-4 w-4" />
            {syncLoading ? 'Sync...' : 'Sync Occupancy'}
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full sm:w-auto"
              onClick={() => {
                setEditingFerme(null);
                setFormData({
                  nom: '',
                  totalChambres: 0,
                  totalOuvriers: 0,
                  admins: []
                });
                setChamberConfig({
                  createChambers: true,
                  chambresHommes: 10,
                  chambresFemmes: 10,
                  capaciteHommes: 4,
                  capaciteFemmes: 4,
                  startNumberHommes: 101,
                  startNumberFemmes: 201
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle ferme
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle>
                {editingFerme ? 'Modifier la ferme' : 'Ajouter une ferme'}
              </DialogTitle>
              <DialogDescription>
                {editingFerme ? 'Modifiez les informations de la ferme' : 'Créez une nouvelle ferme dans le système'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de la ferme</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Ex: Ferme Atlas 01"
                  required
                />
              </div>

              {!editingFerme && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="createChambers"
                      checked={chamberConfig.createChambers}
                      onChange={(e) => setChamberConfig(prev => ({ ...prev, createChambers: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="createChambers" className="font-medium">
                      Créer automatiquement les chambres
                    </Label>
                  </div>

                  {chamberConfig.createChambers ? (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 flex items-center">
                        <BedDouble className="mr-2 h-4 w-4" />
                        Configuration des chambres
                      </h4>
                      <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded border border-blue-200">
                        <p><strong>Note:</strong> Vous pouvez créer une ferme spécialisée en mettant 0 pour un genre.</p>
                        <p>• <strong>Résidence femmes uniquement:</strong> Mettez 0 chambres hommes</p>
                        <p>• <strong>Résidence hommes uniquement:</strong> Mettez 0 chambres femmes</p>
                        <p>• <strong>Résidence mixte:</strong> Spécifiez des chambres pour les deux genres</p>
                      </div>

                      {/* Men's chambers configuration */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800">Chambres Hommes</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="chambresHommes" className="text-sm">Nombre</Label>
                            <Input
                              id="chambresHommes"
                              type="number"
                              value={chamberConfig.chambresHommes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, chambresHommes: parseInt(e.target.value) || 0 }))}
                              placeholder="10 (0 pour aucune)"
                              min="0"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="capaciteHommes" className="text-sm">Capacité</Label>
                            <Input
                              id="capaciteHommes"
                              type="number"
                              value={chamberConfig.capaciteHommes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, capaciteHommes: parseInt(e.target.value) || 0 }))}
                              placeholder="4"
                              min="1"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="startNumberHommes" className="text-sm">N° départ</Label>
                            <Input
                              id="startNumberHommes"
                              type="number"
                              value={chamberConfig.startNumberHommes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, startNumberHommes: parseInt(e.target.value) || 0 }))}
                              placeholder="101"
                              min="1"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Women's chambers configuration */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-pink-800">Chambres Femmes</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="chambresFemmes" className="text-sm">Nombre</Label>
                            <Input
                              id="chambresFemmes"
                              type="number"
                              value={chamberConfig.chambresFemmes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, chambresFemmes: parseInt(e.target.value) || 0 }))}
                              placeholder="10 (0 pour aucune)"
                              min="0"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="capaciteFemmes" className="text-sm">Capacité</Label>
                            <Input
                              id="capaciteFemmes"
                              type="number"
                              value={chamberConfig.capaciteFemmes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, capaciteFemmes: parseInt(e.target.value) || 0 }))}
                              placeholder="4"
                              min="1"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="startNumberFemmes" className="text-sm">N° départ</Label>
                            <Input
                              id="startNumberFemmes"
                              type="number"
                              value={chamberConfig.startNumberFemmes}
                              onChange={(e) => setChamberConfig(prev => ({ ...prev, startNumberFemmes: parseInt(e.target.value) || 0 }))}
                              placeholder="201"
                              min="1"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-white p-3 rounded border">
                        <h6 className="font-medium text-gray-900 mb-2">Résumé</h6>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>Total chambres:</strong> {chamberConfig.chambresHommes + chamberConfig.chambresFemmes}</p>
                            <p><strong>Capacité totale:</strong> {(chamberConfig.chambresHommes * chamberConfig.capaciteHommes) + (chamberConfig.chambresFemmes * chamberConfig.capaciteFemmes)} ouvriers</p>
                          </div>
                          <div>
                            <p><strong>Hommes:</strong> {chamberConfig.startNumberHommes} - {chamberConfig.startNumberHommes + chamberConfig.chambresHommes - 1}</p>
                            <p><strong>Femmes:</strong> {chamberConfig.startNumberFemmes} - {chamberConfig.startNumberFemmes + chamberConfig.chambresFemmes - 1}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="totalChambres">Total chambres</Label>
                        <Input
                          id="totalChambres"
                          type="number"
                          value={formData.totalChambres}
                          onChange={(e) => setFormData(prev => ({ ...prev, totalChambres: parseInt(e.target.value) || 0 }))}
                          placeholder="30"
                          min="1"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="totalOuvriers">Capacité ouvriers</Label>
                        <Input
                          id="totalOuvriers"
                          type="number"
                          value={formData.totalOuvriers}
                          onChange={(e) => setFormData(prev => ({ ...prev, totalOuvriers: parseInt(e.target.value) || 0 }))}
                          placeholder="120"
                          min="1"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editingFerme && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalChambres">Total chambres</Label>
                    <Input
                      id="totalChambres"
                      type="number"
                      value={formData.totalChambres}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalChambres: parseInt(e.target.value) || 0 }))}
                      placeholder="30"
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalOuvriers">Capacité ouvriers</Label>
                    <Input
                      id="totalOuvriers"
                      type="number"
                      value={formData.totalOuvriers}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalOuvriers: parseInt(e.target.value) || 0 }))}
                      placeholder="120"
                      min="1"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsAddDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {loading ? 'Création...' : (editingFerme ? 'Modifier' : 'Créer')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom de ferme..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fermes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredFermes.map((ferme) => {
          const stats = getFermeStats(ferme.id);
          
          return (
            <Card key={ferme.id} className="transition-all duration-200 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {ferme.nom}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(ferme)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(ferme.id, ferme.nom)}
                      disabled={loading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Warning alerts for issues */}
                {stats.hasIssues && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Attention requise</span>
                    </div>
                    <div className="mt-1 text-xs text-orange-700">
                      {stats.workersWithoutRooms > 0 && (
                        <div>• {stats.workersWithoutRooms} ouvrier(s) sans chambre assignée</div>
                      )}
                      {stats.overcapacityRooms > 0 && (
                        <div>• {stats.overcapacityRooms} chambre(s) en surcapacité</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Main Statistics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{stats.totalOuvriers}</p>
                      <p className="text-xs text-gray-500">
                        {stats.maleWorkers}H • {stats.femaleWorkers}F
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BedDouble className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{stats.totalChambres}</p>
                      <p className="text-xs text-gray-500">
                        {stats.maleRooms}H • {stats.femaleRooms}F
                      </p>
                    </div>
                  </div>
                </div>

                {/* Occupancy Statistics */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taux d'occupation</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant={stats.tauxOccupation > 90 ? "destructive" : stats.tauxOccupation > 70 ? "default" : "secondary"}>
                        {stats.tauxOccupation}%
                      </Badge>
                      {stats.needsAttention && (
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                      )}
                      {stats.isWellUtilized && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        stats.tauxOccupation > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        stats.tauxOccupation > 70 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                        'bg-gradient-to-r from-green-500 to-green-600'
                      }`}
                      style={{ width: `${Math.min(stats.tauxOccupation, 100)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">{stats.chambresOccupees}</span> occupées
                    </div>
                    <div>
                      <span className="font-medium">{stats.chambresVides}</span> libres
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Places: {stats.totalOccupied}/{stats.totalCapacity}</span>
                      <span>Score: {stats.efficiencyScore}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredFermes.length === 0 && searchTerm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune ferme trouvée
              </h3>
              <p className="text-gray-600">
                Aucune ferme ne correspond à votre recherche "{searchTerm}"
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {fermes.length === 0 && !searchTerm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune ferme configurée
              </h3>
              <p className="text-gray-600 mb-4">
                Commencez par créer votre première ferme pour gérer les secteurs.
              </p>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer ma première ferme
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
