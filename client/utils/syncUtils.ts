import { Worker, Room } from '@shared/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SyncResult {
  totalRoomsChecked: number;
  roomsUpdated: number;
  inconsistenciesFound: {
    roomId: string;
    roomNumber: string;
    oldOccupants: number;
    newOccupants: number;
    workerNames: string[];
  }[];
}

export const forceSyncRoomOccupancy = async (
  workers: Worker[], 
  rooms: Room[]
): Promise<SyncResult> => {
  console.log('🔄 Starting forced room occupancy synchronization...');
  
  const result: SyncResult = {
    totalRoomsChecked: rooms.length,
    roomsUpdated: 0,
    inconsistenciesFound: []
  };

  // Group active workers by room (fermeId + room number + gender)
  const activeWorkersByRoom = workers
    .filter(worker => worker.statut === 'actif' && worker.chambre && worker.fermeId)
    .reduce((acc, worker) => {
      const workerGenderType = worker.sexe === 'homme' ? 'hommes' : 'femmes';
      const roomKey = `${worker.fermeId}-${worker.chambre}-${workerGenderType}`;
      if (!acc[roomKey]) {
        acc[roomKey] = [];
      }
      acc[roomKey].push(worker);
      return acc;
    }, {} as Record<string, Worker[]>);

  console.log('📊 Active workers grouped by room:', Object.keys(activeWorkersByRoom).length, 'rooms have workers');

  // Update each room's occupancy
  for (const room of rooms) {
    const roomKey = `${room.fermeId}-${room.numero}-${room.genre}`;
    const workersInRoom = activeWorkersByRoom[roomKey] || [];
    const actualOccupants = workersInRoom.length;
    const actualOccupantIds = workersInRoom.map(w => w.id);

    // Check if there's a discrepancy (be more thorough)
    const hasDiscrepancy =
      room.occupantsActuels !== actualOccupants ||
      room.listeOccupants.length !== actualOccupants ||
      !actualOccupantIds.every(id => room.listeOccupants.includes(id)) ||
      !room.listeOccupants.every(id => actualOccupantIds.includes(id));

    if (hasDiscrepancy) {
      console.log(`🔧 Inconsistency found in room ${room.numero}:`);
      console.log(`   Old occupants: ${room.occupantsActuels}, New: ${actualOccupants}`);
      console.log(`   Old list length: ${room.listeOccupants.length}, New list length: ${actualOccupantIds.length}`);
      console.log(`   Workers: ${workersInRoom.map(w => w.nom).join(', ')}`);

      result.inconsistenciesFound.push({
        roomId: room.id,
        roomNumber: room.numero,
        oldOccupants: room.occupantsActuels,
        newOccupants: actualOccupants,
        workerNames: workersInRoom.map(w => w.nom)
      });

      try {
        // Update the room in Firebase
        const roomRef = doc(db, 'rooms', room.id);
        await updateDoc(roomRef, {
          occupantsActuels: actualOccupants,
          listeOccupants: actualOccupantIds,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        });

        result.roomsUpdated++;
        console.log(`✅ Successfully updated room ${room.numero}`);
      } catch (error) {
        console.error(`❌ Failed to update room ${room.numero}:`, error);
      }
    }
  }

  console.log(`🎯 Synchronization completed:`);
  console.log(`   Total rooms checked: ${result.totalRoomsChecked}`);
  console.log(`   Rooms updated: ${result.roomsUpdated}`);
  console.log(`   Inconsistencies found: ${result.inconsistenciesFound.length}`);

  return result;
};

export const getOccupancySummary = (workers: Worker[], rooms: Room[]) => {
  const activeWorkers = workers.filter(w => w.statut === 'actif');
  const totalCapacity = rooms.reduce((sum, room) => sum + room.capaciteTotale, 0);
  const currentOccupiedFromRooms = rooms.reduce((sum, room) => sum + room.occupantsActuels, 0);

  // Calculate actual occupancy based on worker assignments (gender-aware)
  const workersWithRooms = activeWorkers.filter(w => w.chambre && w.chambre !== '');
  const workersWithoutRooms = activeWorkers.filter(w => !w.chambre || w.chambre === '');

  // Calculate actual room occupancy from workers (gender-aware)
  const actualOccupiedPlaces = (() => {
    const workerRoomMap = new Map<string, number>();

    workersWithRooms.forEach(worker => {
      const workerGenderType = worker.sexe === 'homme' ? 'hommes' : 'femmes';
      const roomKey = `${worker.fermeId}-${worker.chambre}-${workerGenderType}`;
      workerRoomMap.set(roomKey, (workerRoomMap.get(roomKey) || 0) + 1);
    });

    return Array.from(workerRoomMap.values()).reduce((sum, count) => sum + count, 0);
  })();

  return {
    totalActiveWorkers: activeWorkers.length,
    totalCapacity,
    currentOccupiedFromRooms,
    workersWithRooms: workersWithRooms.length,
    workersWithoutRooms: workersWithoutRooms.length,
    roomsData: rooms.length,
    actualOccupiedPlaces,
    discrepancy: Math.abs(currentOccupiedFromRooms - actualOccupiedPlaces),
    hasDiscrepancy: currentOccupiedFromRooms !== actualOccupiedPlaces
  };
};
