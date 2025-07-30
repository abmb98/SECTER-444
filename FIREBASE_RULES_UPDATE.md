# 🔧 Firebase Rules Update Required

## Issue Fixed
The Firebase connection errors were caused by missing security rules for stock-related collections.

## ✅ Changes Made
1. **Simplified firebase.ts** - Removed complex retry logic that was causing fetch errors
2. **Updated firestore.rules** - Added missing stock collections permissions
3. **Updated firebase.json** - Added Firestore configuration

## 🚨 Manual Action Required

You need to manually deploy the updated Firestore rules to fix the connection issues:

### Step 1: Open Firebase Console
```
https://console.firebase.google.com/project/secteur-25/firestore/rules
```

### Step 2: Replace Current Rules
Copy and paste this entire rule set (replaces all existing rules):

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

### Step 3: Publish Rules
1. Click **"Publish"** button
2. Confirm the deployment

### Step 4: Verify Fix
1. Refresh the application (F5)
2. Check browser console (F12) - should see no more Firebase errors
3. Test stock functionality

## 🔍 What Was Fixed

### Added Missing Collections:
- `stocks` - For inventory management
- `stock_transfers` - For transfer operations  
- `stock_additions` - For stock addition requests

### Simplified Connection Logic:
- Removed complex retry mechanisms
- Simplified fetch wrapper
- Streamlined connection testing

## ✅ Expected Results

After deploying these rules:
- ✅ No more "Failed to fetch" errors
- ✅ Stock page loads correctly
- ✅ Excel export works
- ✅ All inventory features functional

---

**Note**: This fix is critical for the stock management system to work properly.
