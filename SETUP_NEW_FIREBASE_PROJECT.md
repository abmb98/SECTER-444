# 🚀 Setup Instructions for New Firebase Project (secteur-25)

## ❌ Current Error
**Error**: "Missing or insufficient permissions"

**Cause**: The new Firebase project `secteur-25` needs to be properly configured.

## ✅ Required Setup Steps

### Step 1: Deploy Firestore Security Rules

1. **Open Firebase Console**:
   ```
   https://console.firebase.google.com/project/secteur-25/firestore/rules
   ```

2. **Replace the default rules** with these complete rules:

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
    
    // Stock collection - authenticated users can read/write
    match /stocks/{stockId} {
      allow read, write: if request.auth != null;
    }
    
    // Stock transfers collection - authenticated users can read/write
    match /stock_transfers/{transferId} {
      allow read, write: if request.auth != null;
    }
    
    // Stock additions collection - authenticated users can read/write
    match /stock_additions/{additionId} {
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

3. **Click "Publish"** to deploy the rules.

### Step 2: Enable Authentication

1. **Go to Authentication**:
   ```
   https://console.firebase.google.com/project/secteur-25/authentication/providers
   ```

2. **Enable Email/Password**:
   - Click on "Email/Password"
   - Enable "Email/Password" 
   - Click "Save"

### Step 3: Initialize Firestore Database

1. **Go to Firestore Database**:
   ```
   https://console.firebase.google.com/project/secteur-25/firestore
   ```

2. **Create Database**:
   - Click "Create database"
   - Choose "Start in production mode"
   - Select a location (choose closest to your users)

### Step 4: Verify Setup

After completing the above steps:

1. **Refresh the application** (F5)
2. **Check for connection success**
3. **Test super admin creation**

## 🔧 Quick Fix Option

If you want to temporarily allow all access for testing, you can use these **TEMPORARY** rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ WARNING**: Only use these temporary rules for initial setup, then replace with the secure rules above!

## ✅ Expected Results

After proper setup:
- ✅ No more "Missing or insufficient permissions" errors
- ✅ Firebase connection tests pass
- ✅ Super admin creation available
- ✅ All app features functional

---

**Need Help?**: If you continue having issues, the problem might be that the Firestore database itself hasn't been created yet in the new project.
