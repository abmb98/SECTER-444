# 🔧 Guide de Dépannage Firebase

## Erreur "TypeError: Failed to fetch"

Cette erreur indique un problème de connexion entre l'application et les services Firebase. Voici les solutions par ordre de priorité :

## 🔍 Diagnostic Rapide

### 1. **Vérification de Base**
```bash
# Dans la console du navigateur, vérifiez :
- État de la connexion internet
- Messages d'erreur détaillés
- Configuration Firebase
```

### 2. **Tests de Connectivité**
- ✅ Testez votre connexion internet
- ✅ Vérifiez que Firebase n'est pas bloqué par un firewall
- ✅ Essayez depuis un autre réseau (mobile/WiFi)

## 🛠️ Solutions par Ordre de Priorité

### **Solution 1: Problème de Réseau (Plus Courant)**

#### **Symptômes:**
- Erreur "Failed to fetch"
- Perte de connexion intermittente
- Timeout lors des opérations

#### **Actions:**
1. **Vérifiez votre connexion internet**
2. **Rechargez la page** (F5 ou Ctrl+R)
3. **Videz le cache du navigateur** (Ctrl+Shift+R)
4. **Essayez un autre navigateur**
5. **Redémarrez votre routeur/modem**

### **Solution 2: Configuration Firebase**

#### **Vérification de la Configuration:**
```javascript
// Dans client/lib/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyCpSifW0WN1PuTuHPwsjCpxvQZFnPA7660",
  authDomain: "timdouin25.firebaseapp.com",
  projectId: "timdouin25",
  storageBucket: "timdouin25.firebasestorage.app",
  messagingSenderId: "967661678985",
  appId: "1:967661678985:web:99b31a326903f70776b158"
};
```

#### **Points à Vérifier:**
- ✅ Tous les champs sont présents
- ✅ ProjectId correspond au projet Firebase
- ✅ Aucun caractère manquant ou en trop

### **Solution 3: Règles de Sécurité Firestore**

#### **Problème Possible:**
Les règles Firestore bloquent l'accès aux données.

#### **Vérification:**
1. Allez dans [Firestore Console](https://console.firebase.google.com/project/timdouin25/firestore/rules)
2. Vérifiez les règles actuelles

#### **Règles Recommandées:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permettre la lecture des collections de base
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    
    match /fermes/{fermeId} {
      allow read: if request.auth != null;
      allow write: if isSuperAdmin();
    }
    
    match /workers/{workerId} {
      allow read, write: if request.auth != null;
    }
    
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
    
    function isSuperAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
    }
  }
}
```

### **Solution 4: État du Projet Firebase**

#### **Vérifications:**
1. **Projet actif**: Assurez-vous que le projet Firebase est actif
2. **Quota**: Vérifiez que vous n'avez pas dépassé les limites
3. **Facturation**: Vérifiez l'état de facturation si applicable

## 🚨 Erreurs Spécifiques et Solutions

### **Erreur: "permission-denied"**
```
Cause: Règles Firestore trop restrictives
Solution: Modifiez les règles de sécurité (voir ci-dessus)
```

### **Erreur: "unavailable"**
```
Cause: Service Firebase temporairement indisponible
Solution: Attendez quelques minutes et réessayez
```

### **Erreur: "failed-precondition"**
```
Cause: Configuration Firebase incorrecte
Solution: Vérifiez la configuration dans firebase.ts
```

### **Erreur: "deadline-exceeded"**
```
Cause: Timeout de connexion
Solution: Vérifiez votre connexion internet
```

## 🔧 Actions de Dépannage Avancées

### **1. Nettoyage Complet du Navigateur**
```bash
1. Ouvrez les outils de développement (F12)
2. Clic droit sur le bouton de rechargement
3. Sélectionnez "Vider le cache et effectuer une actualisation forcée"
```

### **2. Test en Mode Incognito**
```bash
1. Ouvrez une fenêtre de navigation privée
2. Testez l'application
3. Si ça fonctionne = problème de cache/cookies
```

### **3. Vérification Console Navigateur**
```bash
1. Ouvrez les outils de développement (F12)
2. Onglet "Console"
3. Recherchez les erreurs rouges
4. Notez les messages d'erreur détaillés
```

### **4. Test de Connectivité Firebase**
```bash
1. Ouvrez la console navigateur
2. Tapez: fetch('https://firestore.googleapis.com/')
3. Si erreur = problème de connectivité
```

## 📊 Monitoring et Logs

### **Logs Améliorés (Déjà Intégrés)**
L'application affiche maintenant :
- ✅ Messages d'erreur détaillés
- ✅ Statut de connexion en temps réel
- ✅ Boutons de reconnexion
- ✅ Suggestions de solutions

### **Messages Utilisateur**
- 🔴 **Erreur Rouge**: Problème critique nécessitant une action
- 🟡 **Alerte Jaune**: Avertissement ou problème mineur
- 🔵 **Info Bleue**: Information ou conseil

## 🔄 Procédure de Récupération

### **En Cas de Panne Complète:**
1. **Rechargez la page** (F5)
2. **Vérifiez la connexion internet**
3. **Attendez 2-3 minutes** (possible surcharge temporaire)
4. **Essayez un autre navigateur**
5. **Contactez l'administrateur** si le problème persiste

### **Prevention Future:**
- 📱 **Connexion stable**: Utilisez une connexion internet fiable
- 💾 **Cache régulier**: Videz le cache périodiquement
- 🔄 **Mise à jour navigateur**: Gardez votre navigateur à jour
- 📊 **Surveillance**: Surveillez les messages d'état de l'application

## 📞 Support et Escalade

### **Auto-Diagnostic**
L'application inclut maintenant :
- ✅ **Détection automatique** des problèmes de connexion
- ✅ **Messages explicites** avec solutions suggérées
- ✅ **Boutons de récupération** pour reconnecter
- ✅ **Indicateurs visuels** d'état de connexion

### **Quand Contacter l'Administrateur**
- 🚨 Erreur persistante après toutes les solutions
- 🚨 Problème affectant plusieurs utilisateurs
- 🚨 Messages d'erreur non documentés
- 🚨 Perte de données

---

**Note**: L'application a été considérablement améliorée avec des systèmes de détection et récupération automatique des erreurs Firebase. La plupart des problèmes se résolvent automatiquement ou avec les solutions suggérées dans l'interface.
