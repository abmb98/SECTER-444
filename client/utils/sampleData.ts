import { Ferme, Worker, Room } from '@shared/types';

export const createSampleFerme = (): Omit<Ferme, 'id'> => ({
  nom: 'Ferme Atlas Test',
  totalChambres: 20,
  totalOuvriers: 80,
  admins: []
});

export const createSampleRooms = (fermeId: string): Omit<Room, 'id'>[] => {
  const rooms: Omit<Room, 'id'>[] = [];
  
  // Create 10 rooms for men (101-110)
  for (let i = 0; i < 10; i++) {
    rooms.push({
      numero: (101 + i).toString(),
      fermeId,
      genre: 'hommes',
      capaciteTotale: 4,
      occupantsActuels: 0,
      listeOccupants: []
    });
  }
  
  // Create 10 rooms for women (201-210)
  for (let i = 0; i < 10; i++) {
    rooms.push({
      numero: (201 + i).toString(),
      fermeId,
      genre: 'femmes',
      capaciteTotale: 4,
      occupantsActuels: 0,
      listeOccupants: []
    });
  }
  
  return rooms;
};

export const createSampleWorkers = (fermeId: string): Omit<Worker, 'id'>[] => [
  {
    nom: 'Ahmed Alami',
    cin: 'AA123456',
    fermeId,
    telephone: '0612345678',
    sexe: 'homme',
    age: 28,
    chambre: '101',
    secteur: 'Bloc A',
    dateEntree: new Date().toISOString().split('T')[0],
    statut: 'actif'
  },
  {
    nom: 'Fatima Benali',
    cin: 'BB123456',
    fermeId,
    telephone: '0612345679',
    sexe: 'femme',
    age: 25,
    chambre: '201',
    secteur: 'Secteur Femmes',
    dateEntree: new Date().toISOString().split('T')[0],
    statut: 'actif'
  },
  {
    nom: 'Omar Idrissi',
    cin: 'CC123456',
    fermeId,
    telephone: '0612345680',
    sexe: 'homme',
    age: 32,
    chambre: '102',
    secteur: 'Bloc A',
    dateEntree: new Date().toISOString().split('T')[0],
    statut: 'actif'
  }
];
