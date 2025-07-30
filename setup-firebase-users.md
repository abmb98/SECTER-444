# Firebase Setup Instructions

## 1. Create Users in Firebase Authentication Console

Go to your Firebase Console: https://console.firebase.google.com/project/timdouin25/authentication/users

### Create these users:

#### Superadmin User:
- **Email**: `superadmin@timdouin25.com`
- **Password**: Choose a secure password
- **UID**: (Firebase will auto-generate)

#### Admin Ferme User:
- **Email**: `admin@ferme01.com`
- **Password**: Choose a secure password
- **UID**: (Firebase will auto-generate)

## 2. Create User Documents in Firestore

Go to Firestore Console: https://console.firebase.google.com/project/timdouin25/firestore/data

### Create Collection: `users`

#### Document 1 (Superadmin):
Document ID: Use the UID from Firebase Auth
```json
{
  "email": "superadmin@timdouin25.com",
  "nom": "Mohamed Admin",
  "role": "superadmin",
  "telephone": "0612345678"
}
```

#### Document 2 (Admin Ferme):
Document ID: Use the UID from Firebase Auth
```json
{
  "email": "admin@ferme01.com",
  "fermeId": "ferme01",
  "nom": "Yassine Benali",
  "role": "admin",
  "telephone": "0612345679"
}
```

## 3. Create Sample Data Collections

### Collection: `fermes`

#### Document ID: `ferme01`
```json
{
  "adresse": "Route Nationale 9, Berrechid",
  "admins": ["admin-uid-here"],
  "nom": "Ferme Atlas 01",
  "totalChambres": 30,
  "totalOuvriers": 120
}
```

### Collection: `workers`

#### Document 1:
```json
{
  "age": 27,
  "chambre": "101",
  "cin": "AA998877",
  "dateEntree": "2024-07-15",
  "secteur": "Bloc A",
  "fermeId": "ferme01",
  "nom": "Khalid Amrani",
  "sexe": "homme",
  "statut": "actif",
  "telephone": "0612345678"
}
```

#### Document 2:
```json
{
  "age": 24,
  "chambre": "201",
  "cin": "BB123456",
  "dateEntree": "2024-08-01",
  "secteur": "Bloc B",
  "fermeId": "ferme01",
  "nom": "Fatima Zahra",
  "sexe": "femme",
  "statut": "actif",
  "telephone": "0612345679"
}
```

### Collection: `rooms`

#### Document 1:
```json
{
  "capaciteTotale": 4,
  "fermeId": "ferme01",
  "genre": "hommes",
  "listeOccupants": ["AA998877"],
  "numero": "101",
  "occupantsActuels": 1
}
```

#### Document 2:
```json
{
  "capaciteTotale": 4,
  "fermeId": "ferme01",
  "genre": "femmes",
  "listeOccupants": ["BB123456"],
  "numero": "201",
  "occupantsActuels": 1
}
```

## 4. Security Rules (Optional)

Update your Firestore security rules to match the role-based access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    match /fermes/{fermeId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

    match /workers/{workerId} {
      allow read, write: if isSuperAdmin() || isAdminOfFerme(resource.data.fermeId);
    }

    match /rooms/{roomId} {
      allow read, write: if isSuperAdmin() || isAdminOfFerme(resource.data.fermeId);
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
    }

    function isAdminOfFerme(fermeId) {
      let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
      return userData.fermeId == fermeId && userData.role == "admin";
    }
  }
}
```

## 5. Test the Application

After creating the users and data:
1. Try logging in with `superadmin@timdouin25.com`
2. Try logging in with `admin@ferme01.com`
3. Verify that role-based access works correctly

The application is now fully connected to Firebase and ready for production use!
