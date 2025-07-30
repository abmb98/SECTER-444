import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Enhanced sync function that automatically clears inactive workers from rooms
const syncInactiveWorkersFromRooms = async (workers: Worker[], rooms: Room[], updateRoom: any) => {
  console.log('🧹 Cleaning inactive workers from room occupancy...');

  const inactiveWorkers = workers.filter(w => w.statut === 'inactif');
  let updatesNeeded = 0;

  for (const room of rooms) {
    const hasInactiveWorkers = room.listeOccupants.some(occupantId =>
      inactiveWorkers.find(w => w.id === occupantId)
    );

    if (hasInactiveWorkers) {
      // Remove inactive workers from room - also validate gender match
      const activeOccupants = room.listeOccupants.filter(occupantId => {
        const worker = workers.find(w => w.id === occupantId);
        if (!worker || worker.statut !== 'actif') return false;

        // Ensure gender compatibility
        const workerGenderType = worker.sexe === 'homme' ? 'hommes' : 'femmes';
        return room.genre === workerGenderType;
      });

      if (activeOccupants.length !== room.listeOccupants.length) {
        console.log(`🧹 Cleaning room ${room.numero}: ${room.listeOccupants.length} → ${activeOccupants.length} occupants`);

        try {
          await updateRoom(room.id, {
            listeOccupants: activeOccupants,
            occupantsActuels: activeOccupants.length,
            updatedAt: new Date()
          });
          updatesNeeded++;
        } catch (error) {
          console.error(`❌ Failed to clean room ${room.numero}:`, error);
        }
      }
    }
  }

  console.log(`✅ Cleaned ${updatesNeeded} rooms of inactive workers`);
  return updatesNeeded;
};

import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Filter,
  Download,
  Upload,
  Phone,
  Calendar,
  MapPin,
  AlertCircle,
  X,
  Activity,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { Worker, Ferme, Room } from '@shared/types';
import * as XLSX from 'xlsx';
import { doc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import WorkerImport from '@/components/WorkerImport';

export default function Workers() {
  const { user, isSuperAdmin } = useAuth();
  const { data: allWorkers, loading: workersLoading, addDocument, updateDocument, deleteDocument } = useFirestore<Worker>('workers');
  const { data: fermes } = useFirestore<Ferme>('fermes');
  const { data: rooms, updateDocument: updateRoom } = useFirestore<Room>('rooms');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFerme, setSelectedFerme] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedEntryMonth, setSelectedEntryMonth] = useState('all');
  const [selectedEntryYear, setSelectedEntryYear] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isMotifOpen, setIsMotifOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Motif options for searchable select
  const motifOptions = [
    { value: 'all', label: 'Tous les motifs' },
    { value: 'none', label: 'Aucun motif' },
    { value: 'fin_contrat', label: 'Fin de contrat' },
    { value: 'demission', label: 'Démission' },
    { value: 'licenciement', label: 'Licenciement' },
    { value: 'mutation', label: 'Mutation' },
    { value: 'retraite', label: 'Retraite' },
    { value: 'opportunite_salariale', label: 'Opportunité salariale' },
    { value: 'absences_frequentes', label: 'Absences fréquentes' },
    { value: 'comportement', label: 'Comportement' },
    { value: 'salaire', label: 'Raisons salariales' },
    { value: 'depart_volontaire', label: 'Départ volontaire' },
    { value: 'horaires_nocturnes', label: 'Horaires nocturnes' },
    { value: 'adaptation_difficile', label: 'Adaptation difficile' },
    { value: 'etudes', label: 'Étudiant' },
    { value: 'heures_insuffisantes', label: 'Heures insuffisantes' },
    { value: 'distance', label: 'Distance' },
    { value: 'indiscipline', label: 'Indiscipline' },
    { value: 'maladie', label: 'Maladie' },
    { value: 'respect_voisins', label: 'Respect des voisins' },
    { value: 'nature_travail', label: 'Nature du travail' },
    { value: 'sante', label: 'Santé' },
    { value: 'securite', label: 'Sécurité' },
    { value: 'rendement', label: 'Rendement' },
    { value: 'problemes_personnels', label: 'Problèmes personnels' },
    { value: 'caporal', label: 'Raison de caporal' },
    { value: 'refus_poste', label: 'Refus de poste' },
    { value: 'rejet_selection', label: 'Rejet lors de la sélection' },
    { value: 'repos_temporaire', label: 'Repos temporaire' },
    { value: 'secteur_insatisfaisant', label: 'Secteur insatisfaisant' },
    { value: 'pas_reponse', label: 'Pas de réponse' },
    { value: 'conditions_secteur', label: 'Conditions du secteur' },
    { value: 'raisons_personnelles', label: 'Raisons personnelles' },
    { value: 'autre', label: 'Autre' }
  ];

  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'all',
    ageMin: '',
    ageMax: '',
    dateEntreeFrom: '',
    dateEntreeTo: '',
    dateSortieFrom: '',
    dateSortieTo: '',
    chambre: '',
    motif: 'all'
  });

  // Multi-selection state
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [formData, setFormData] = useState({
    nom: '',
    cin: '',
    telephone: '',
    sexe: 'homme' as 'homme' | 'femme',
    age: 25,
    yearOfBirth: new Date().getFullYear() - 25,
    fermeId: user?.fermeId || '',
    chambre: '',
    secteur: '',
    statut: 'actif' as 'actif' | 'inactif',
    dateEntree: new Date().toISOString().split('T')[0],
    dateSortie: '',
    motif: 'none'
  });

  // Calculate age from year of birth
  const calculateAge = (yearOfBirth: number): number => {
    const currentYear = new Date().getFullYear();
    return currentYear - yearOfBirth;
  };

  // Debug: Log room data
  useEffect(() => {
    console.log('Rooms data:', rooms.map(r => ({
      id: r.id,
      numero: r.numero,
      fermeId: r.fermeId,
      genre: r.genre,
      capaciteTotale: r.capaciteTotale,
      occupantsActuels: r.occupantsActuels
    })));
  }, [rooms]);

  // Check and auto-update worker statuses on component load
  useEffect(() => {
    const updateInconsistentStatuses = async () => {
      // Find workers who have exit dates but are still marked as active
      const inconsistentWorkers = allWorkers.filter(worker =>
        worker.dateSortie && worker.statut === 'actif'
      );

      if (inconsistentWorkers.length > 0) {
        console.log(`Found ${inconsistentWorkers.length} workers with exit dates but active status. Auto-updating...`);

        // Update each inconsistent worker
        for (const worker of inconsistentWorkers) {
          try {
            await updateDocument(worker.id, {
              ...worker,
              statut: 'inactif',
              updatedAt: new Date()
            });
            console.log(`Updated worker ${worker.nom} to inactive status`);
          } catch (error) {
            console.error(`Failed to update worker ${worker.nom}:`, error);
          }
        }
      }
    };

    // Only run if we have workers data and user is authenticated
    if (allWorkers.length > 0 && user) {
      updateInconsistentStatuses();
    }
  }, [allWorkers, user, updateDocument]);

  // Filter workers based on user role and filters
  const filteredWorkers = allWorkers.filter(worker => {
    // Role-based filtering
    if (!isSuperAdmin && user?.fermeId) {
      if (worker.fermeId !== user.fermeId) return false;
    }

    // Search filter
    if (searchTerm && !worker.nom.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !worker.cin.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Ferme filter (for superadmin)
    if (selectedFerme !== 'all' && worker.fermeId !== selectedFerme) {
      return false;
    }

    // Gender filter
    if (selectedGender !== 'all' && worker.sexe !== selectedGender) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'all' && worker.statut !== selectedStatus) {
      return false;
    }

    // Entry month filter
    if (selectedEntryMonth !== 'all' && worker.dateEntree) {
      const entryDate = new Date(worker.dateEntree);
      const entryMonth = entryDate.getMonth() + 1; // getMonth() returns 0-11, we want 1-12
      if (entryMonth.toString() !== selectedEntryMonth) {
        return false;
      }
    }

    // Entry year filter
    if (selectedEntryYear !== 'all' && worker.dateEntree) {
      const entryDate = new Date(worker.dateEntree);
      const entryYear = entryDate.getFullYear();
      if (entryYear.toString() !== selectedEntryYear) {
        return false;
      }
    }

    // Advanced filters
    if (advancedFilters.status !== 'all' && worker.statut !== advancedFilters.status) {
      return false;
    }

    if (advancedFilters.ageMin && worker.age < parseInt(advancedFilters.ageMin)) {
      return false;
    }

    if (advancedFilters.ageMax && worker.age > parseInt(advancedFilters.ageMax)) {
      return false;
    }

    if (advancedFilters.dateEntreeFrom && worker.dateEntree) {
      const entryDate = new Date(worker.dateEntree);
      const filterDate = new Date(advancedFilters.dateEntreeFrom);
      if (entryDate < filterDate) return false;
    }

    if (advancedFilters.dateEntreeTo && worker.dateEntree) {
      const entryDate = new Date(worker.dateEntree);
      const filterDate = new Date(advancedFilters.dateEntreeTo);
      if (entryDate > filterDate) return false;
    }

    if (advancedFilters.dateSortieFrom && worker.dateSortie) {
      const exitDate = new Date(worker.dateSortie);
      const filterDate = new Date(advancedFilters.dateSortieFrom);
      if (exitDate < filterDate) return false;
    }

    if (advancedFilters.dateSortieTo && worker.dateSortie) {
      const exitDate = new Date(worker.dateSortie);
      const filterDate = new Date(advancedFilters.dateSortieTo);
      if (exitDate > filterDate) return false;
    }

    if (advancedFilters.chambre && !worker.chambre?.toLowerCase().includes(advancedFilters.chambre.toLowerCase())) {
      return false;
    }

    if (advancedFilters.motif !== 'all' && advancedFilters.motif !== (worker.motif || 'none')) {
      return false;
    }

    return true;
  });

  // Get available entry years from worker data
  const getAvailableEntryYears = () => {
    const years = new Set<number>();
    allWorkers.forEach(worker => {
      if (worker.dateEntree) {
        const year = new Date(worker.dateEntree).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  };

  const availableEntryYears = getAvailableEntryYears();

  // Calculate average ages
  const calculateAverageAges = (workers: Worker[]) => {
    const activeWorkers = workers.filter(w => w.statut === 'actif');
    const menWorkers = activeWorkers.filter(w => w.sexe === 'homme');
    const womenWorkers = activeWorkers.filter(w => w.sexe === 'femme');

    const averageAgeMen = menWorkers.length > 0
      ? Math.round(menWorkers.reduce((sum, w) => sum + w.age, 0) / menWorkers.length)
      : 0;

    const averageAgeWomen = womenWorkers.length > 0
      ? Math.round(womenWorkers.reduce((sum, w) => sum + w.age, 0) / womenWorkers.length)
      : 0;

    return { averageAgeMen, averageAgeWomen };
  };

  const { averageAgeMen, averageAgeWomen } = calculateAverageAges(filteredWorkers);

  // Multi-selection utility functions
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedWorkers(new Set(filteredWorkers.map(w => w.id)));
    } else {
      setSelectedWorkers(new Set());
    }
  };

  const handleSelectWorker = (workerId: string, checked: boolean) => {
    const newSelected = new Set(selectedWorkers);
    if (checked) {
      newSelected.add(workerId);
    } else {
      newSelected.delete(workerId);
    }
    setSelectedWorkers(newSelected);
    setSelectAll(newSelected.size === filteredWorkers.length && filteredWorkers.length > 0);
  };

  const clearSelection = () => {
    setSelectedWorkers(new Set());
    setSelectAll(false);
  };

  // Debug: Log worker data to check what we're getting
  useEffect(() => {
    if (allWorkers.length > 0) {
      console.log('🔍 Workers Debug Info:');
      console.log('Total workers loaded:', allWorkers.length);
      console.log('User fermeId:', user?.fermeId);
      console.log('Is SuperAdmin:', isSuperAdmin);

      // Show all workers with their key details
      allWorkers.forEach((worker, index) => {
        console.log(`Worker ${index + 1}:`, {
          nom: worker.nom,
          sexe: worker.sexe,
          statut: worker.statut,
          fermeId: worker.fermeId,
          cin: worker.cin
        });
      });

      const activeWorkers = allWorkers.filter(w => w.statut === 'actif');
      const maleWorkers = activeWorkers.filter(w => w.sexe === 'homme');
      const femaleWorkers = activeWorkers.filter(w => w.sexe === 'femme');

      console.log('Active workers:', activeWorkers.length);
      console.log('Male active workers:', maleWorkers.length);
      console.log('Female active workers:', femaleWorkers.length);
      console.log('Filtered workers (after role/search filters):', filteredWorkers.length);
    } else {
      console.log('⚠️ No workers data loaded yet');
    }
  }, [allWorkers, user, isSuperAdmin, filteredWorkers]);

  // Helper function to add worker to room
  const addWorkerToRoom = async (workerId: string, workerData: any) => {
    const room = rooms.find(r =>
      r.numero === workerData.chambre &&
      r.fermeId === workerData.fermeId
    );

    if (room) {
      // Validate gender match
      const workerGenderType = workerData.sexe === 'homme' ? 'hommes' : 'femmes';
      if (room.genre !== workerGenderType) {
        console.warn(`⚠️ Gender mismatch: Cannot add ${workerData.sexe} to ${room.genre} room ${room.numero}. Skipping room assignment.`);
        return; // Skip room assignment instead of throwing error
      }

      const batch = writeBatch(db);
      const roomRef = doc(db, 'rooms', room.id);

      // Add worker to room if not already there
      if (!room.listeOccupants.includes(workerId)) {
        batch.update(roomRef, {
          listeOccupants: [...room.listeOccupants, workerId],
          occupantsActuels: room.occupantsActuels + 1,
          updatedAt: new Date()
        });

        await batch.commit();
        console.log(`�� Added worker to room ${room.numero} (${workerGenderType})`);
      }
    }
  };

  // Helper function to update room occupancy when worker changes
  const updateRoomOccupancy = async (oldWorkerData: Worker, newWorkerData: any) => {
    const batch = writeBatch(db);

    // Remove from old room if they were previously active and assigned
    if (oldWorkerData.chambre && oldWorkerData.statut === 'actif') {
      const oldRoom = rooms.find(r =>
        r.numero === oldWorkerData.chambre &&
        r.fermeId === oldWorkerData.fermeId
      );

      if (oldRoom) {
        const roomRef = doc(db, 'rooms', oldRoom.id);
        const updatedOccupants = oldRoom.listeOccupants.filter(id => id !== oldWorkerData.id);

        batch.update(roomRef, {
          listeOccupants: updatedOccupants,
          occupantsActuels: Math.max(0, oldRoom.occupantsActuels - 1),
          updatedAt: new Date()
        });

        console.log(`📤 Removed worker ${oldWorkerData.nom} from room ${oldRoom.numero}`);
      }
    }

    // Add to new room only if:
    // 1. Worker is active (no exit date)
    // 2. Worker is assigned to a room
    // 3. Worker gender matches room gender
    if (newWorkerData.chambre && newWorkerData.statut === 'actif') {
      const newRoom = rooms.find(r =>
        r.numero === newWorkerData.chambre &&
        r.fermeId === newWorkerData.fermeId
      );

      if (newRoom) {
        // Validate gender match
        const workerGenderType = newWorkerData.sexe === 'homme' ? 'hommes' : 'femmes';
        if (newRoom.genre !== workerGenderType) {
          console.warn(`⚠️ Gender mismatch: Worker ${oldWorkerData.nom} (${newWorkerData.sexe}) cannot be assigned to room ${newRoom.numero} (${newRoom.genre}). Clearing room assignment.`);

          // Clear the room assignment in the worker data to prevent the mismatch
          newWorkerData.chambre = '';
          newWorkerData.dortoir = '';

          // Update the worker document to clear the invalid room assignment
          try {
            await updateDocument(oldWorkerData.id, {
              chambre: '',
              secteur: '',
              updatedAt: new Date()
            });
            console.log(`✅ Cleared invalid room assignment for worker ${oldWorkerData.nom}`);
          } catch (clearError) {
            console.error(`���� Failed to clear room assignment:`, clearError);
          }

          // Skip room assignment
          return;
        }

        // Add worker if not already in the room
        if (!newRoom.listeOccupants.includes(oldWorkerData.id)) {
          const roomRef = doc(db, 'rooms', newRoom.id);

          batch.update(roomRef, {
            listeOccupants: [...newRoom.listeOccupants, oldWorkerData.id],
            occupantsActuels: newRoom.occupantsActuels + 1,
            updatedAt: new Date()
          });

          console.log(`📥 Added worker ${oldWorkerData.nom} to room ${newRoom.numero}`);
        }
      }
    } else if (newWorkerData.statut === 'inactif') {
      console.log(`�� Worker ${oldWorkerData.nom} marked as inactive - removed from room`);
    }

    if (batch._mutations.length > 0) {
      await batch.commit();
      console.log(`✅ Updated room occupancy for worker changes`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingWorker) {
        const updateData = {
          ...formData,
          age: calculateAge(formData.yearOfBirth),
          dateEntree: formData.dateEntree || editingWorker.dateEntree
        };

        // Automatically set status to inactif if exit date is provided
        if (formData.dateSortie) {
          updateData.dateSortie = formData.dateSortie;
          updateData.statut = 'inactif'; // Automatically set to inactive when exit date is added
        } else {
          // If no exit date, ensure status remains actif (unless manually changed)
          updateData.statut = formData.statut || 'actif';
        }

        if (formData.motif && formData.motif !== 'none') {
          updateData.motif = formData.motif;
        }

        await updateDocument(editingWorker.id, updateData);

        // Handle room occupancy changes if room assignment changed OR worker became inactive
        const statusChanged = editingWorker.statut !== updateData.statut;
        const roomChanged = editingWorker.chambre !== formData.chambre;
        const gotExitDate = !editingWorker.dateSortie && updateData.dateSortie;

        if (roomChanged || statusChanged || gotExitDate) {
          console.log(`🔄 Room occupancy update needed: room changed: ${roomChanged}, status changed: ${statusChanged}, got exit date: ${gotExitDate}`);

          // Check for gender mismatch before updating
          if (formData.chambre && formData.statut === 'actif') {
            const selectedRoom = rooms.find(r =>
              r.numero === formData.chambre &&
              r.fermeId === formData.fermeId
            );

            if (selectedRoom) {
              const workerGenderType = formData.sexe === 'homme' ? 'hommes' : 'femmes';
              if (selectedRoom.genre !== workerGenderType) {
                setError(`⚠️ Attention: La chambre ${formData.chambre} est réservée aux ${selectedRoom.genre}, mais l'ouvrier est un ${formData.sexe}. L'assignment de chambre a été annulée.`);

                // Clear the room assignment in the form
                setFormData(prev => ({
                  ...prev,
                  chambre: '',
                  dortoir: ''
                }));
              }
            }
          }

          await updateRoomOccupancy(editingWorker, updateData);
        }
      } else {
        const newWorkerId = await addDocument({
          ...formData,
          age: calculateAge(formData.yearOfBirth),
          dateEntree: formData.dateEntree
        });

        // Add worker to room if assigned and active
        if (formData.chambre && formData.statut === 'actif') {
          await addWorkerToRoom(newWorkerId, formData);
        }
      }
      
      // Reset form
      setFormData({
        nom: '',
        cin: '',
        telephone: '',
        sexe: 'homme',
        age: 25,
        yearOfBirth: new Date().getFullYear() - 25,
        fermeId: user?.fermeId || '',
        chambre: '',
        secteur: '',
        statut: 'actif',
        dateEntree: new Date().toISOString().split('T')[0],
        dateSortie: '',
        motif: 'none'
      });
      setEditingWorker(null);
      setIsAddDialogOpen(false);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (worker: Worker) => {
    setFormData({
      nom: worker.nom,
      cin: worker.cin,
      telephone: worker.telephone,
      sexe: worker.sexe,
      age: worker.age,
      yearOfBirth: worker.yearOfBirth || (new Date().getFullYear() - worker.age),
      fermeId: worker.fermeId,
      chambre: worker.chambre,
      secteur: worker.secteur,
      statut: worker.statut,
      dateEntree: worker.dateEntree || new Date().toISOString().split('T')[0],
      dateSortie: worker.dateSortie || '',
      motif: worker.motif || 'none'
    });
    setEditingWorker(worker);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (workerId: string) => {
    if (window.confirm('Êtes-vous s��r de vouloir supprimer cet ouvrier ?')) {
      setLoading(true);
      try {
        // Find the worker to be deleted
        const workerToDelete = allWorkers.find(w => w.id === workerId);
        if (!workerToDelete) {
          throw new Error('Ouvrier non trouvé');
        }

        console.log(`��️ Deleting worker: ${workerToDelete.nom} (CIN: ${workerToDelete.cin})`);

        // Create a batch for atomic updates
        const batch = writeBatch(db);

        // 1. Delete the worker document
        const workerRef = doc(db, 'workers', workerId);
        batch.delete(workerRef);

        // 2. Update room occupancy if worker is assigned to a room
        if (workerToDelete.chambre && workerToDelete.statut === 'actif') {
          const workerRoom = rooms.find(r =>
            r.numero === workerToDelete.chambre &&
            r.fermeId === workerToDelete.fermeId
          );

          if (workerRoom) {
            console.log(`��� Updating room ${workerRoom.numero} occupancy`);
            const roomRef = doc(db, 'rooms', workerRoom.id);

            // Remove worker from occupants list (try both ID and CIN for compatibility)
            const updatedOccupants = workerRoom.listeOccupants.filter(occupantId =>
              occupantId !== workerToDelete.id && occupantId !== workerToDelete.cin
            );
            const newOccupantsCount = Math.max(0, workerRoom.occupantsActuels - 1);

            // Additional validation: ensure count consistency
            const actualOccupantsCount = updatedOccupants.length;
            const finalOccupantsCount = Math.min(newOccupantsCount, actualOccupantsCount);

            batch.update(roomRef, {
              listeOccupants: updatedOccupants,
              occupantsActuels: finalOccupantsCount,
              updatedAt: new Date()
            });

            console.log(`✅ Room ${workerRoom.numero}: ${workerRoom.occupantsActuels} → ${finalOccupantsCount} occupants (list count: ${actualOccupantsCount})`);

            // Log warning if there was a data inconsistency
            if (newOccupantsCount !== actualOccupantsCount) {
              console.log(`⚠️ Data inconsistency detected in room ${workerRoom.numero}. Fixed automatically.`);
            }
          } else {
            console.log(`⚠️ Room not found for worker ${workerToDelete.nom} (room: ${workerToDelete.chambre})`);
          }
        } else if (workerToDelete.chambre && workerToDelete.statut === 'inactif') {
          console.log(`ℹ️ Worker ${workerToDelete.nom} was already inactive, no room update needed`);
        }

        // 3. Update ferme statistics
        const ferme = fermes.find(f => f.id === workerToDelete.fermeId);
        if (ferme && workerToDelete.statut === 'actif') {
          console.log(`📊 Updating ferme ${ferme.nom} statistics`);
          const fermeRef = doc(db, 'fermes', ferme.id);

          // Recalculate total active workers for this ferme
          const activeWorkersInFerme = allWorkers.filter(w =>
            w.fermeId === workerToDelete.fermeId &&
            w.statut === 'actif' &&
            w.id !== workerId // Exclude the worker being deleted
          ).length;

          batch.update(fermeRef, {
            totalOuvriers: activeWorkersInFerme,
            updatedAt: new Date()
          });

          console.log(`✅ Ferme ${ferme.nom}: updated totalOuvriers to ${activeWorkersInFerme}`);
        }

        // Execute all updates atomically
        await batch.commit();
        console.log(`✅ Successfully deleted worker ${workerToDelete.nom} and updated all related data`);

        // Show success message to user
        // Note: In a real app, you might want to use a toast notification library
        setTimeout(() => {
          alert(`✅ Ouvrier ${workerToDelete.nom} supprimé avec succès.\nToutes les données liées (chambres, statistiques) ont été mises à jour.`);
        }, 100);

      } catch (error: any) {
        console.error('❌ Error deleting worker and updating related data:', error);
        setError(error.message || 'Erreur lors de la suppression de l\'ouvrier');

        // Show error to user
        alert(`Erreur lors de la suppression: ${error.message || 'Une erreur inattendue s\'est produite'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedWorkers.size === 0) return;

    const selectedWorkersArray = allWorkers.filter(w => selectedWorkers.has(w.id));
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer ${selectedWorkers.size} ouvrier(s) ?\n\nOuvriers sélectionnés:\n${selectedWorkersArray.map(w => `• ${w.nom} (${w.cin})`).join('\n')}`;

    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        console.log(`🗑️ Starting bulk delete of ${selectedWorkers.size} workers...`);

        // Create a batch for atomic updates
        const batch = writeBatch(db);
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const workerId of selectedWorkers) {
          try {
            const workerToDelete = allWorkers.find(w => w.id === workerId);
            if (!workerToDelete) {
              errors.push(`Ouvrier avec ID ${workerId} non trouvé`);
              errorCount++;
              continue;
            }

            console.log(`🗑️ Processing deletion for: ${workerToDelete.nom} (CIN: ${workerToDelete.cin})`);

            // 1. Delete the worker document
            const workerRef = doc(db, 'workers', workerId);
            batch.delete(workerRef);

            // 2. Update room occupancy if worker is assigned to a room
            if (workerToDelete.chambre && workerToDelete.statut === 'actif') {
              const workerRoom = rooms.find(r =>
                r.numero === workerToDelete.chambre &&
                r.fermeId === workerToDelete.fermeId
              );

              if (workerRoom) {
                const roomRef = doc(db, 'rooms', workerRoom.id);
                const updatedOccupants = workerRoom.listeOccupants.filter(occupantId =>
                  occupantId !== workerToDelete.id && occupantId !== workerToDelete.cin
                );
                const newOccupantsCount = Math.max(0, workerRoom.occupantsActuels - 1);

                batch.update(roomRef, {
                  listeOccupants: updatedOccupants,
                  occupantsActuels: newOccupantsCount,
                  updatedAt: new Date()
                });
              }
            }

            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`${selectedWorkersArray.find(w => w.id === workerId)?.nom || workerId}: ${error.message}`);
            console.error(`❌ Error preparing deletion for worker ${workerId}:`, error);
          }
        }

        // Execute all deletions atomically
        if (successCount > 0) {
          await batch.commit();
          console.log(`✅ Successfully deleted ${successCount} workers`);
        }

        // Update ferme statistics for affected fermes
        const affectedFermes = new Set(selectedWorkersArray.map(w => w.fermeId));
        for (const fermeId of affectedFermes) {
          try {
            const ferme = fermes.find(f => f.id === fermeId);
            if (ferme) {
              const activeWorkersInFerme = allWorkers.filter(w =>
                w.fermeId === fermeId &&
                w.statut === 'actif' &&
                !selectedWorkers.has(w.id) // Exclude deleted workers
              ).length;

              const fermeRef = doc(db, 'fermes', ferme.id);
              await updateDoc(fermeRef, {
                totalOuvriers: activeWorkersInFerme,
                updatedAt: new Date()
              });
            }
          } catch (error) {
            console.error(`❌ Error updating ferme statistics for ${fermeId}:`, error);
          }
        }

        // Clear selection and show results
        clearSelection();

        if (errorCount > 0) {
          console.warn(`⚠️ ${errorCount} workers failed to delete:`, errors);
          alert(`Suppression terminée avec quelques erreurs:\n${successCount} réussis, ${errorCount} échou��s\n\nErreurs:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
        } else {
          alert(`✅ Suppression réussie! ${successCount} ouvrier(s) supprimé(s) avec succès.`);
        }

      } catch (error: any) {
        console.error('❌ Bulk delete failed:', error);
        alert(`Erreur lors de la suppression en masse: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkExport = () => {
    if (selectedWorkers.size === 0) return;

    const selectedWorkersArray = allWorkers.filter(w => selectedWorkers.has(w.id));

    // Prepare data for Excel export
    const exportData = selectedWorkersArray.map(worker => ({
      'Nom': worker.nom,
      'CIN': worker.cin,
      'Téléphone': worker.telephone,
      'Sexe': worker.sexe === 'homme' ? 'Homme' : 'Femme',
      '��ge': worker.age,
      'Année de naissance': worker.yearOfBirth || (new Date().getFullYear() - worker.age),
      'Ferme': getFermeName(worker.fermeId),
      'Chambre': worker.chambre,
      'Secteur': worker.secteur || (worker as any).dortoir?.replace('Dortoir', 'Secteur') || '',
      'Date d\'entrée': new Date(worker.dateEntree).toLocaleDateString('fr-FR'),
      'Date de sortie': worker.dateSortie ? new Date(worker.dateSortie).toLocaleDateString('fr-FR') : '',
      'Motif de sortie': worker.motif && worker.motif !== 'none' ? worker.motif : '',
      'Statut': worker.statut === 'actif' ? 'Actif' : 'Inactif'
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = [
      { wch: 20 }, // Nom
      { wch: 12 }, // CIN
      { wch: 15 }, // Téléphone
      { wch: 8 },  // Sexe
      { wch: 6 },  // Âge
      { wch: 12 }, // Année de naissance
      { wch: 20 }, // Ferme
      { wch: 10 }, // Chambre
      { wch: 15 }, // Dortoir
      { wch: 12 }, // Date d'entrée
      { wch: 12 }, // Date de sortie
      { wch: 20 }, // Motif
      { wch: 8 }   // Statut
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ouvriers Sélectionnés');

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `ouvriers_selection_${today}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);

    // Clear selection after export
    clearSelection();
  };

  const getStatusBadge = (worker: Worker) => {
    if (worker.statut === 'actif') {
      return <Badge className="bg-green-100 text-green-800">Actif</Badge>;
    } else {
      if (worker.dateSortie) {
        return <Badge className="bg-orange-100 text-orange-800">Sorti</Badge>;
      } else {
        return <Badge variant="secondary">Inactif</Badge>;
      }
    }
  };

  const getGenderBadge = (sexe: string) => {
    return sexe === 'homme' 
      ? <Badge className="bg-blue-100 text-blue-800">Homme</Badge>
      : <Badge className="bg-pink-100 text-pink-800">Femme</Badge>;
  };

  const getFermeName = (fermeId: string) => {
    const ferme = fermes.find(f => f.id === fermeId);
    return ferme?.nom || fermeId;
  };

  // Get available chambers for the selected ferme and gender
  const getAvailableChambres = () => {
    if (!formData.fermeId || !formData.sexe) {
      console.log('getAvailableChambres: Missing fermeId or sexe', { fermeId: formData.fermeId, sexe: formData.sexe });
      return [];
    }

    const filtered = rooms.filter(room => {
      const matchesFerme = room.fermeId === formData.fermeId;
      const matchesGender = (formData.sexe === 'homme' && room.genre === 'hommes') ||
                           (formData.sexe === 'femme' && room.genre === 'femmes');

      return matchesFerme && matchesGender;
    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));

    console.log(`getAvailableChambres: Found ${filtered.length} rooms for ferme ${formData.fermeId} and gender ${formData.sexe}`, {
      totalRooms: rooms.length,
      filteredRooms: filtered.map(r => ({ numero: r.numero, genre: r.genre, fermeId: r.fermeId }))
    });

    return filtered;
  };

  const handleBulkImport = async (workersToImport: Omit<Worker, 'id'>[]) => {
    setLoading(true);
    try {
      console.log(`📥 Starting bulk import of ${workersToImport.length} workers...`);

      const batch = writeBatch(db);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const workerData of workersToImport) {
        try {
          // Add each worker to the batch
          const newWorkerRef = doc(collection(db, 'workers'));
          batch.set(newWorkerRef, {
            ...workerData,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Track room updates for later processing (to avoid conflicts in batch)
          if (workerData.statut === 'actif' && workerData.chambre) {
            console.log(`📋 Worker ${workerData.nom} assigned to room ${workerData.chambre}`);
          }

          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`${workerData.nom}: ${error.message}`);
          console.error(`❌ Error preparing worker ${workerData.nom}:`, error);
        }
      }

      // Execute the batch
      await batch.commit();
      console.log(`✅ Successfully imported ${successCount} workers`);

      // Note: Room occupancy will be automatically updated by the room repair system

      if (errorCount > 0) {
        console.warn(`⚠️ ${errorCount} workers failed to import:`, errors);
        alert(`Import terminé avec quelques erreurs:\n${successCount} réussis, ${errorCount} échoués`);
      } else {
        alert(`✅ Import réussi! ${successCount} ouvriers importés avec succès.`);
      }

    } catch (error: any) {
      console.error('❌ Bulk import failed:', error);
      alert(`Erreur lors de l'importation: ${error.message}`);
    } finally {
      setLoading(false);
      setIsImportDialogOpen(false);
    }
  };

  const handleExportToExcel = () => {
    // Prepare data for Excel export
    const exportData = filteredWorkers.map(worker => ({
      'Nom': worker.nom,
      'CIN': worker.cin,
      'Téléphone': worker.telephone,
      'Sexe': worker.sexe === 'homme' ? 'Homme' : 'Femme',
      'Âge': worker.age,
      'Année de naissance': worker.yearOfBirth || (new Date().getFullYear() - worker.age),
      'Ferme': getFermeName(worker.fermeId),
      'Chambre': worker.chambre,
      'Secteur': worker.secteur || (worker as any).dortoir?.replace('Dortoir', 'Secteur') || '',
      'Date d\'entrée': new Date(worker.dateEntree).toLocaleDateString('fr-FR'),
      'Date de sortie': worker.dateSortie ? new Date(worker.dateSortie).toLocaleDateString('fr-FR') : '',
      'Motif de sortie': worker.motif && worker.motif !== 'none' ? worker.motif : '',
      'Statut': worker.statut === 'actif' ? 'Actif' : 'Inactif'
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = [
      { wch: 20 }, // Nom
      { wch: 12 }, // CIN
      { wch: 15 }, // Téléphone
      { wch: 8 },  // Sexe
      { wch: 6 },  // Âge
      { wch: 12 }, // Année de naissance
      { wch: 20 }, // Ferme
      { wch: 10 }, // Chambre
      { wch: 15 }, // Dortoir
      { wch: 12 }, // Date d'entrée
      { wch: 12 }, // Date de sortie
      { wch: 20 }, // Motif
      { wch: 8 }   // Statut
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ouvriers');

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `ouvriers_${today}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  // Automatic cleanup of inactive workers from rooms
  const handleAutoCleanup = async () => {
    setCleanupLoading(true);
    try {
      const updatesNeeded = await syncInactiveWorkersFromRooms(allWorkers, rooms, updateRoom);
      if (updatesNeeded > 0) {
        console.log(`✅ Automatically cleaned ${updatesNeeded} rooms`);
      } else {
        console.log('✅ All rooms are already synchronized');
      }
    } catch (error) {
      console.error('❌ Auto cleanup failed:', error);
    } finally {
      setCleanupLoading(false);
    }
  };

  // Run auto cleanup when component loads or when workers/rooms data changes
  useEffect(() => {
    if (allWorkers.length > 0 && rooms.length > 0 && updateRoom) {
      const timeoutId = setTimeout(() => {
        handleAutoCleanup();
      }, 2000); // Run cleanup after 2 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [allWorkers, rooms, updateRoom]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Users className="mr-2 sm:mr-3 h-6 w-6 sm:h-8 sm:w-8" />
            Gestion des ouvriers
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            {(() => {
              const activeWorkers = filteredWorkers.filter(w => w.statut === 'actif');
              const inactiveWorkers = filteredWorkers.filter(w => w.statut === 'inactif');
              const maleActiveWorkers = activeWorkers.filter(w => w.sexe === 'homme');
              const femaleActiveWorkers = activeWorkers.filter(w => w.sexe === 'femme');

              return (
                <span>
                  {filteredWorkers.length} ouvriers total ({activeWorkers.length} actifs, {inactiveWorkers.length} inactifs)
                  {activeWorkers.length > 0 && (
                    <span className="ml-2">• {maleActiveWorkers.length} hommes, {femaleActiveWorkers.length} femmes actifs</span>
                  )}
                </span>
              );
            })()}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
            <span>Âge moyen hommes actifs: <strong className="text-blue-600">{averageAgeMen} ans</strong></span>
            <span>Âge moyen femmes actives: <strong className="text-pink-600">{averageAgeWomen} ans</strong></span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleAutoCleanup}
            disabled={cleanupLoading || loading}
            className="text-orange-600 hover:text-orange-700 border-orange-200"
          >
            {cleanupLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
            ) : (
              <Activity className="mr-2 h-4 w-4" />
            )}
            Clean Rooms
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
            disabled={loading}
            className="text-green-600 hover:text-green-700 border-green-200"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importer Excel
          </Button>
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => {
                  setEditingWorker(null);
                  setFormData({
                    nom: '',
                    cin: '',
                    telephone: '',
                    sexe: 'homme',
                    age: 25,
                    yearOfBirth: new Date().getFullYear() - 25,
                    fermeId: user?.fermeId || '',
                    chambre: '',
                    secteur: '',
                    statut: 'actif',
                    dateEntree: new Date().toISOString().split('T')[0],
                    dateSortie: '',
                    motif: 'none'
                  });
                  setError('');
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Nouvel ouvrier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>
                  {editingWorker ? 'Modifier l\'ouvrier' : 'Ajouter un ouvrier'}
                </DialogTitle>
                <DialogDescription>
                  {editingWorker ? 'Modifiez les informations de l\'ouvrier' : 'Remplissez les informations de l\'ouvrier'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom complet</Label>
                  <Input 
                    id="nom" 
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    placeholder="Ex: Ahmed Alami" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cin">CIN</Label>
                  <Input 
                    id="cin" 
                    value={formData.cin}
                    onChange={(e) => setFormData(prev => ({ ...prev, cin: e.target.value }))}
                    placeholder="Ex: AA123456" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">T��léphone</Label>
                  <Input 
                    id="telephone" 
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    placeholder="Ex: 0612345678" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexe</Label>
                    <Select
                      value={formData.sexe}
                      onValueChange={(value: 'homme' | 'femme') => {
                        console.log(`Gender changed to: ${value}`);
                        setFormData(prev => ({
                          ...prev,
                          sexe: value,
                          chambre: '', // Clear chamber when gender changes
                          secteur: ''  // Clear secteur when gender changes
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homme">Homme</SelectItem>
                        <SelectItem value="femme">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearOfBirth">Année de naissance</Label>
                    <Input
                      id="yearOfBirth"
                      type="number"
                      value={formData.yearOfBirth}
                      onChange={(e) => {
                        const year = parseInt(e.target.value) || new Date().getFullYear();
                        const age = calculateAge(year);
                        setFormData(prev => ({
                          ...prev,
                          yearOfBirth: year,
                          age: age
                        }));
                      }}
                      placeholder={`${new Date().getFullYear() - 25}`}
                      min="1950"
                      max={new Date().getFullYear() - 16}
                      required
                    />
                    <p className="text-xs text-gray-500">Âge calculé: {formData.age} ans</p>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Ferme</Label>
                    <Select
                      value={formData.fermeId}
                      onValueChange={(value) =>
                        setFormData(prev => ({
                          ...prev,
                          fermeId: value,
                          chambre: '', // Clear chamber when farm changes
                          secteur: ''  // Clear secteur when farm changes
                        }))
                      }
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chambre</Label>
                    <Select
                      value={formData.chambre}
                      onValueChange={(value) => {
                        // Find the selected room from the available chambers (already filtered by ferme and gender)
                        const availableChambres = getAvailableChambres();
                        const selectedRoom = availableChambres.find(room => room.numero === value);
                        setFormData(prev => ({
                          ...prev,
                          chambre: value,
                          secteur: selectedRoom ? (selectedRoom.genre === 'hommes' ? 'Secteur Hommes' : 'Secteur Femmes') : ''
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une chambre" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableChambres().length === 0 ? (
                          <div className="p-2 text-center text-sm text-gray-500">
                            {!formData.fermeId ? 'Sélectionnez d\'abord une ferme' :
                             !formData.sexe ? 'Sélectionnez d\'abord le sexe' :
                             'Aucune chambre disponible pour ce genre'}
                          </div>
                        ) : (
                          getAvailableChambres().map(room => {
                            const isAvailable = room.occupantsActuels < room.capaciteTotale;
                            const availableSpaces = room.capaciteTotale - room.occupantsActuels;
                            return (
                              <SelectItem
                                key={room.id}
                                value={room.numero}
                                disabled={!isAvailable && !editingWorker}
                              >
                                Chambre {room.numero} ({availableSpaces}/{room.capaciteTotale} places) - {room.genre}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {formData.fermeId && formData.sexe && getAvailableChambres().length === 0 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Aucune chambre {formData.sexe === 'homme' ? 'pour hommes' : 'pour femmes'} disponible dans cette ferme.
                          <br />
                          <span className="text-xs text-gray-600">
                            Vérifiez que des chambres ont ét�� créées pour ce genre dans cette ferme.
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secteur">Secteur</Label>
                    <Input
                      id="secteur"
                      value={formData.secteur}
                      onChange={(e) => setFormData(prev => ({ ...prev, secteur: e.target.value }))}
                      placeholder="Sera rempli automatiquement"
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>

                {/* Date d'entrée */}
                <div className="space-y-2">
                  <Label htmlFor="dateEntree">Date d'entrée</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="dateEntree"
                      type="date"
                      value={formData.dateEntree}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateEntree: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Exit fields - only show when editing */}
                {editingWorker && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dateSortie">Date de sortie (optionnel)</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="dateSortie"
                          type="date"
                          value={formData.dateSortie}
                          onChange={(e) => {
                            const newDateSortie = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              dateSortie: newDateSortie,
                              // Automatically set status to inactif when exit date is added
                              statut: newDateSortie ? 'inactif' : 'actif'
                            }));
                          }}
                          className="pl-10"
                          min={formData.dateEntree}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="motif">Motif de sortie (optionnel)</Label>
                        <Select
                          value={formData.motif}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, motif: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un motif" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun motif</SelectItem>
                            <SelectItem value="fin_contrat">Fin de contrat</SelectItem>
                            <SelectItem value="demission">Démission</SelectItem>
                            <SelectItem value="licenciement">Licenciement</SelectItem>
                            <SelectItem value="mutation">Mutation</SelectItem>
                            <SelectItem value="retraite">Retraite</SelectItem>
                            <SelectItem value="opportunite_salariale">Opportunité salariale</SelectItem>
                            <SelectItem value="absences_frequentes">Absences fréquentes</SelectItem>
                            <SelectItem value="comportement">Comportement</SelectItem>
                            <SelectItem value="salaire">Raisons salariales</SelectItem>
                            <SelectItem value="depart_volontaire">Départ volontaire</SelectItem>
                            <SelectItem value="horaires_nocturnes">Horaires nocturnes</SelectItem>
                            <SelectItem value="adaptation_difficile">Adaptation difficile</SelectItem>
                            <SelectItem value="etudes">Étudiant</SelectItem>
                            <SelectItem value="heures_insuffisantes">Heures insuffisantes</SelectItem>
                            <SelectItem value="distance">Distance</SelectItem>
                            <SelectItem value="indiscipline">Indiscipline</SelectItem>
                            <SelectItem value="maladie">Maladie</SelectItem>
                            <SelectItem value="respect_voisins">Respect des voisins</SelectItem>
                            <SelectItem value="nature_travail">Nature du travail</SelectItem>
                            <SelectItem value="sante">Santé</SelectItem>
                            <SelectItem value="securite">Sécurité</SelectItem>
                            <SelectItem value="rendement">Rendement</SelectItem>
                            <SelectItem value="problemes_personnels">Problèmes personnels</SelectItem>
                            <SelectItem value="caporal">Raison de caporal</SelectItem>
                            <SelectItem value="refus_poste">Refus de poste</SelectItem>
                            <SelectItem value="rejet_selection">Rejet lors de la sélection</SelectItem>
                            <SelectItem value="repos_temporaire">Repos temporaire</SelectItem>
                            <SelectItem value="secteur_insatisfaisant">Secteur insatisfaisant</SelectItem>
                            <SelectItem value="pas_reponse">Pas de réponse</SelectItem>
                            <SelectItem value="conditions_secteur">Conditions du secteur</SelectItem>
                            <SelectItem value="raisons_personnelles">Raisons personnelles</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="statut">Statut</Label>
                        <Select
                          value={formData.statut}
                          onValueChange={(value: 'actif' | 'inactif') => setFormData(prev => ({ ...prev, statut: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="inactif">Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.dateSortie && formData.statut === 'actif' && (
                          <p className="text-xs text-orange-600">
                            ⚠️ Statut actif avec date de sortie - vérifiez si c'est correct
                          </p>
                        )}
                        {formData.dateSortie && formData.statut === 'inactif' && (
                          <p className="text-xs text-green-600">
                            ✅ Statut automatiquement défini comme inactif
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
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
                    {loading ? 'Sauvegarde...' : (editingWorker ? 'Modifier' : 'Ajouter')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom ou CIN..."
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
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sexe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="homme">Hommes</SelectItem>
                <SelectItem value="femme">Femmes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="actif">Actifs</SelectItem>
                <SelectItem value="inactif">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedEntryMonth} onValueChange={setSelectedEntryMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Mois d'entrée" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                <SelectItem value="1">Janvier</SelectItem>
                <SelectItem value="2">Février</SelectItem>
                <SelectItem value="3">Mars</SelectItem>
                <SelectItem value="4">Avril</SelectItem>
                <SelectItem value="5">Mai</SelectItem>
                <SelectItem value="6">Juin</SelectItem>
                <SelectItem value="7">Juillet</SelectItem>
                <SelectItem value="8">Août</SelectItem>
                <SelectItem value="9">Septembre</SelectItem>
                <SelectItem value="10">Octobre</SelectItem>
                <SelectItem value="11">Novembre</SelectItem>
                <SelectItem value="12">Décembre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedEntryYear} onValueChange={setSelectedEntryYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {availableEntryYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Liste des ouvriers ({filteredWorkers.length})</span>
            <div className="flex items-center space-x-2">
              {selectedWorkers.size > 0 && (
                <>
                  <Badge variant="secondary" className="px-2 py-1">
                    {selectedWorkers.size} sélectionné(s)
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    className="text-blue-600 hover:text-blue-700 border-blue-200"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Exporter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 border-red-200"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></div>
                    ) : (
                      <Trash2 className="mr-2 h-3 w-3" />
                    )}
                    Supprimer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAdvancedFiltersOpen(true)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filtres avancés
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Chargement des ouvriers...</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        aria-label="S��lectionner tous les ouvriers"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Nom</TableHead>
                    <TableHead className="whitespace-nowrap">CIN</TableHead>
                    {isSuperAdmin && <TableHead className="whitespace-nowrap">Ferme</TableHead>}
                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                    <TableHead className="whitespace-nowrap">Sexe</TableHead>
                    <TableHead className="whitespace-nowrap">Âge</TableHead>
                    <TableHead className="whitespace-nowrap">Logement</TableHead>
                    <TableHead className="whitespace-nowrap">Date d'entrée</TableHead>
                    <TableHead className="whitespace-nowrap">Date de sortie</TableHead>
                    <TableHead className="whitespace-nowrap">Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedWorkers.has(worker.id)}
                          onCheckedChange={(checked) => handleSelectWorker(worker.id, !!checked)}
                          aria-label={`Sélectionner ${worker.nom}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{worker.nom}</TableCell>
                      <TableCell>{worker.cin}</TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {getFermeName(worker.fermeId)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="mr-1 h-3 w-3" />
                          {worker.telephone}
                        </div>
                      </TableCell>
                      <TableCell>{getGenderBadge(worker.sexe)}</TableCell>
                      <TableCell>{worker.age} ans</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">Chambre {worker.chambre}</div>
                          <div className="text-gray-500 flex items-center">
                            <MapPin className="mr-1 h-3 w-3" />
                            {worker.secteur}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(worker.dateEntree).toLocaleDateString('fr-FR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {worker.dateSortie ? (
                          <div className="text-sm">
                            <div className="flex items-center text-gray-600">
                              <Calendar className="mr-1 h-3 w-3" />
                              {new Date(worker.dateSortie).toLocaleDateString('fr-FR')}
                            </div>
                            {worker.motif && worker.motif !== 'none' && (
                              <div className="text-xs text-gray-500 mt-1">
                                {worker.motif.replace('_', ' ').charAt(0).toUpperCase() + worker.motif.replace('_', ' ').slice(1)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(worker)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(worker)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(worker.id)}
                            disabled={loading}
                          >
                            {loading ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters Dialog */}
      <Dialog open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtres avancés</DialogTitle>
            <DialogDescription>
              Affinez votre recherche avec des critères spécifiques
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={advancedFilters.status}
                onValueChange={(value) => setAdvancedFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ageMin">Âge minimum</Label>
                <Input
                  id="ageMin"
                  type="number"
                  placeholder="16"
                  value={advancedFilters.ageMin}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, ageMin: e.target.value }))}
                  min="16"
                  max="70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageMax">Âge maximum</Label>
                <Input
                  id="ageMax"
                  type="number"
                  placeholder="70"
                  value={advancedFilters.ageMax}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, ageMax: e.target.value }))}
                  min="16"
                  max="70"
                />
              </div>
            </div>

            {/* Entry Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateEntreeFrom">Date d'entrée de</Label>
                <Input
                  id="dateEntreeFrom"
                  type="date"
                  value={advancedFilters.dateEntreeFrom}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateEntreeFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateEntreeTo">Date d'entrée à</Label>
                <Input
                  id="dateEntreeTo"
                  type="date"
                  value={advancedFilters.dateEntreeTo}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateEntreeTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Exit Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateSortieFrom">Date de sortie de</Label>
                <Input
                  id="dateSortieFrom"
                  type="date"
                  value={advancedFilters.dateSortieFrom}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateSortieFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateSortieTo">Date de sortie à</Label>
                <Input
                  id="dateSortieTo"
                  type="date"
                  value={advancedFilters.dateSortieTo}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateSortieTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Room Filter */}
            <div className="space-y-2">
              <Label htmlFor="chambre">Numéro de chambre</Label>
              <Input
                id="chambre"
                placeholder="Ex: 101"
                value={advancedFilters.chambre}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, chambre: e.target.value }))}
              />
            </div>

            {/* Exit Reason */}
            <div className="space-y-2">
              <Label>Motif de sortie</Label>
              <Popover open={isMotifOpen} onOpenChange={setIsMotifOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isMotifOpen}
                    className="w-full justify-between"
                  >
                    {advancedFilters.motif !== 'all'
                      ? motifOptions.find((motif) => motif.value === advancedFilters.motif)?.label
                      : "Tous les motifs"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un motif..." />
                    <CommandList>
                      <CommandEmpty>Aucun motif trouvé.</CommandEmpty>
                      <CommandGroup>
                        {motifOptions.map((motif) => (
                          <CommandItem
                            key={motif.value}
                            value={motif.value}
                            onSelect={(currentValue) => {
                              setAdvancedFilters(prev => ({
                                ...prev,
                                motif: currentValue === advancedFilters.motif ? 'all' : currentValue
                              }));
                              setIsMotifOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                advancedFilters.motif === motif.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {motif.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAdvancedFilters({
                  status: 'all',
                  ageMin: '',
                  ageMax: '',
                  dateEntreeFrom: '',
                  dateEntreeTo: '',
                  dateSortieFrom: '',
                  dateSortieTo: '',
                  chambre: '',
                  motif: 'all'
                });
              }}
            >
              Réinitialiser
            </Button>
            <Button onClick={() => setIsAdvancedFiltersOpen(false)}>
              Appliquer les filtres
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Worker Import Dialog */}
      <WorkerImport
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleBulkImport}
        fermes={fermes}
        rooms={rooms}
        userFermeId={user?.fermeId}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
