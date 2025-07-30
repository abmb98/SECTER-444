# 🔧 Configuration Firebase Complète

## Problèmes Actuels Détectés
- ❌ Erreurs de permissions sur les collections (rooms, workers, users)
- ❌ Test de connexion échoue (collection réservée)
- ❌ Règles de sécurité Firestore manquantes ou incorrectes

## 🚀 Solution Rapide

### Étape 1: Déployer les Règles de Sécurité

1. **Ouvrir Firebase Console**
   ```
   https://console.firebase.google.com/project/secteur-25/firestore/rules
   ```

2. **Remplacer les règles actuelles** par le contenu du fichier `firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow super admins full access to everything
    match /{document=**} {
      allow read, write: if isSuperAdmin();
    }
    
    // Users collection - users can read/write their own data, admins can read all
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      (request.auth.uid == userId || isAdmin() || isSuperAdmin());
    }
    
    // Fermes collection - authenticated users can read, admins can write
    match /fermes/{fermeId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || isSuperAdmin();
    }
    
    // Workers collection - authenticated users can read/write
    match /workers/{workerId} {
      allow read, write: if request.auth != null;
    }
    
    // Rooms collection - authenticated users can read/write
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    // App config collection - allow reading for connection tests
    match /app_config/{configId} {
      allow read: if true; // Allow anonymous reads for connection testing
      allow write: if isSuperAdmin();
    }
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return isAuthenticated() ? 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role : 
        null;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && getUserRole() == "superadmin";
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             (getUserRole() == "admin" || getUserRole() == "superadmin");
    }
    
    function isUser() {
      return isAuthenticated() && 
             (getUserRole() == "user" || getUserRole() == "admin" || getUserRole() == "superadmin");
    }
  }
}
```

3. **Cliquer sur "Publier"** pour déployer les nouvelles règles

### Étape 2: Activer l'Authentification Email/Mot de passe

1. **Aller dans Authentication**
   ```
   https://console.firebase.google.com/project/secteur-25/authentication/providers
   ```

2. **Activer Email/Password**
   - Cliquez sur "Email/Password"
   - Activez "Email/Password" 
   - Cliquez "Enregistrer"

### Étape 3: Vérifier la Configuration

1. **Retourner à l'application**
2. **Recharger la page** (F5)
3. **Tester la création du super admin**

## 🔍 Vérification Post-Installation

### Tests de Connexion
- ✅ Firebase connection status: "Connected"
- ✅ Super admin creation: Disponible
- ✅ Accès aux collections: Sans erreurs de permission

### Indicateurs de Succès
- 🟢 **Connexion Firebase**: Indicateur vert sur la page de connexion
- 🟢 **Super Admin**: Bouton de création visible
- 🟢 **Collections**: Pas d'erreurs de permission dans la console

## 🚨 Dépannage

### Si les erreurs persistent:

#### 1. **Vérifier les règles déployées**
```
https://console.firebase.google.com/project/secteur-25/firestore/rules
```
- Vérifiez que les nouvelles règles sont actives
- Date de publication récente visible

#### 2. **Vérifier l'authentification**
```
https://console.firebase.google.com/project/secteur-25/authentication/providers
```
- Email/Password doit être "Activé"

#### 3. **Nettoyer le cache**
- Ctrl + Shift + R (actualisation forcée)
- Mode navigation privée pour tester

#### 4. **Vérifier la console du navigateur**
- F12 → Console
- Rechercher les erreurs Firebase
- Vérifier les messages de succès/échec

## 📋 Règles de Sécurité Expliquées

### Niveaux d'Accès:
- **Super Admin**: Accès total à tout
- **Admin**: Lecture de tout, écriture des fermes
- **User**: Lecture/écriture des données courantes

### Collections:
- **users**: Utilisateurs peuvent lire/modifier leur profil
- **fermes**: Lecture libre, écriture admin seulement
- **workers/rooms**: Lecture/écriture pour utilisateurs connectés
- **app_config**: Test de connexion (lecture libre)

## ✅ Validation Finale

Une fois les règles déployées, vous devriez voir:
1. ✅ **Page de connexion**: Statut Firebase "connecté"
2. ✅ **Super admin**: Création possible sans erreurs
3. ✅ **Application**: Fonctionnement normal des collections
4. ✅ **Console**: Pas d'erreurs de permission

---

**Important**: Ces règles de sécurité sont conçues pour un environnement de production sécurisé tout en permettant le fonctionnement normal de l'application.
