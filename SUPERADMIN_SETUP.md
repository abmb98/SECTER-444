# 🔐 Guide de Création d'un Compte Super Administrateur

## Problème Actuel
Vous voyez le message "Accès non autorisé" car vous êtes connecté avec un compte admin normal, mais la page Outils d'Administration nécessite des privilèges de super administrateur.

## 🚀 Solution Rapide

### Option 1: Créer un Super Administrateur dans Firebase Console

1. **Aller dans Firebase Console**
   - Ouvrez: https://console.firebase.google.com/project/timdouin25/authentication/users

2. **Créer un nouvel utilisateur**
   - Cliquez sur "Ajouter un utilisateur"
   - Email: `superadmin@timdouin25.com` (ou votre email)
   - Mot de passe: Choisissez un mot de passe sécurisé
   - Copiez l'UID généré

3. **Créer le document utilisateur dans Firestore**
   - Allez à: https://console.firebase.google.com/project/timdouin25/firestore/data
   - Collection: `users`
   - Document ID: Utilisez l'UID de l'étape 2
   - Données:
   ```json
   {
     "email": "superadmin@timdouin25.com",
     "nom": "Super Administrateur",
     "role": "superadmin",
     "telephone": "0612345678"
   }
   ```

4. **Se connecter**
   - Retournez à l'application
   - Déconnectez-vous
   - Connectez-vous avec le nouveau compte superadmin

### Option 2: Modifier votre compte actuel (plus rapide)

1. **Aller dans Firestore Console**
   - https://console.firebase.google.com/project/timdouin25/firestore/data
   - Collection: `users`
   - Trouvez votre document utilisateur actuel

2. **Modifier le rôle**
   - Changez `"role": "admin"` en `"role": "superadmin"`
   - Supprimez le champ `"fermeId"` s'il existe
   - Sauvegardez

3. **Rafraîchir l'application**
   - Rechargez la page ou déconnectez-vous/reconnectez-vous

## 🎯 Vérification

Une fois connecté en tant que superadmin, vous devriez voir:
- ✅ Le menu "Fermes" dans la navigation
- ✅ Le menu "Administration" accessible
- ✅ Accès à tous les outils d'administration

## 📞 Aide Supplémentaire

Si vous continuez à avoir des problèmes:
1. Vérifiez que le rôle est bien `"superadmin"` dans Firestore
2. Assurez-vous qu'il n'y a pas de champ `fermeId` dans le document utilisateur
3. Essayez de vous déconnecter et reconnecter
4. Vérifiez la console du navigateur pour des erreurs

---

**Note**: Les super administrateurs ont accès à toutes les fonctionnalités, y compris la création d'autres utilisateurs et la gestion de toutes les fermes.
