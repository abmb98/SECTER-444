# 🏢 Gestion des Secteurs - Worker Management System

A comprehensive worker management system for agricultural facilities with dormitory management, built with React, TypeScript, and Firebase.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running on Localhost](#running-on-localhost)
- [Deployment to Firebase Hosting](#deployment-to-firebase-hosting)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🌟 Overview

This application manages workers, dormitories, and farms with features including:
- Worker registration and management
- Room assignment and occupancy tracking
- Excel import/export functionality
- Real-time statistics and analytics
- Multi-tenant support for different farms
- Role-based access control

## ✨ Features

- **Worker Management**: Add, edit, delete workers with comprehensive profiles
- **Room Management**: Track room occupancy, capacity, and assignments
- **Statistics Dashboard**: Real-time analytics with modern responsive design
- **Excel Integration**: Import workers from Excel files with validation
- **Multi-selection Operations**: Bulk delete and export functionality
- **Firebase Integration**: Real-time database with authentication
- **Responsive Design**: Mobile-first design with modern UI components
- **Role-based Access**: Different permissions for admins and super-admins

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Firebase CLI** (for deployment)
- **Git** (for version control)

### Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd gestion-secteurs
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyDDO_7qvJvngCnJDopqfZEqTCsW39YqCFs
VITE_FIREBASE_AUTH_DOMAIN=secteur-e639e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=secteur-e639e
VITE_FIREBASE_STORAGE_BUCKET=secteur-e639e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=834372572362
VITE_FIREBASE_APP_ID=1:834372572362:web:f866cdd9d1519a2ec65033

# Development Configuration
VITE_APP_URL=http://localhost:8080
```

### 4. Firebase Setup
Ensure your Firebase project is configured with:
- **Authentication**: Email/Password enabled
- **Firestore Database**: Security rules configured
- **Hosting**: Enabled for deployment

## 💻 Running on Localhost

### Start Development Server
```bash
npm run dev
```

This will start the development server on `http://localhost:8080` with:
- ✅ Hot module replacement (HMR)
- ✅ TypeScript compilation
- ✅ Real-time Firebase connection
- ✅ Express server integration

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:client` | Build client only |
| `npm run build:server` | Build server only |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run typecheck` | Type checking |
| `npm run format.fix` | Format code |

### Development Features
- **Live Reload**: Automatic browser refresh on file changes
- **Error Overlay**: Real-time error display in development
- **TypeScript Support**: Full type checking and IntelliSense
- **Firebase Emulator**: Optional local Firebase emulation

## 🌐 Deployment to Firebase Hosting

### Prerequisites for Deployment
1. **Firebase CLI** installed and logged in:
```bash
firebase login
```

2. **Build the application** first:
```bash
npm run build:client
```

### Quick Deployment
```bash
npm run deploy
```

### Manual Deployment Steps

#### 1. Build the Application
```bash
npm run build:client
```

#### 2. Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

#### 3. Deploy to Preview Channel (Optional)
```bash
npm run deploy:preview
```

### Deployment Configuration

The project includes pre-configured Firebase settings:

**`firebase.json`**:
```json
{
  "hosting": {
    "public": "dist/spa",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

**`.firebaserc`**:
```json
{
  "projects": {
    "default": "secteur-e639e"
  }
}
```

### Post-Deployment

After successful deployment, your app will be available at:
- **Live URL**: `https://secteur-e639e.web.app`
- **Custom Domain**: Configure in Firebase Console if needed

## 🔐 Environment Variables

### Development (`.env`)
```env
VITE_FIREBASE_API_KEY=your_dev_api_key
VITE_FIREBASE_AUTH_DOMAIN=secteur-e639e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=secteur-e639e
VITE_APP_URL=http://localhost:8080
```

### Production (`.env.production`)
```env
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=secteur-e639e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=secteur-e639e
VITE_APP_URL=https://secteur-e639e.web.app
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `your-project-id` |
| `VITE_APP_URL` | Application URL | `http://localhost:8080` |

## 📁 Project Structure

```
├── client/                 # Frontend React application
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Shadcn/ui components
│   │   └── ...            # Custom components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries (Firebase, utils)
│   ├── pages/             # Page components
│   └── utils/             # Utility functions
├── server/                # Backend Express server
├── shared/                # Shared types and utilities
├── dist/                  # Build output
│   └── spa/              # Static files for hosting
├── firebase.json          # Firebase configuration
├── .firebaserc           # Firebase project settings
├── vite.config.ts        # Vite configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. **Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
npm run dev -- --force
```

#### 2. **Firebase Connection Issues**
- Verify Firebase configuration in `.env`
- Check Firebase project settings
- Ensure Firestore rules allow read/write access
- Check network connectivity

#### 3. **Deployment Failures**
```bash
# Re-authenticate with Firebase
firebase logout
firebase login

# Verify project configuration
firebase projects:list
firebase use secteur-e639e
```

#### 4. **Port Already in Use**
```bash
# Kill process using port 8080
npx kill-port 8080

# Or use different port
npm run dev -- --port 3000
```

### Debug Commands

```bash
# Check Firebase project status
firebase projects:list

# Verify Firebase configuration
firebase use --add

# Test local build
npm run build:client && npx serve dist/spa

# Check for TypeScript errors
npm run typecheck
```

### Firebase Console Links

- **Hosting**: https://console.firebase.google.com/project/secteur-e639e/hosting
- **Authentication**: https://console.firebase.google.com/project/secteur-e639e/authentication
- **Firestore**: https://console.firebase.google.com/project/secteur-e639e/firestore
- **Project Settings**: https://console.firebase.google.com/project/secteur-e639e/settings

## 🚨 Important Notes

### Security Considerations
- **Never commit** `.env` files with real API keys
- Use **Firebase Security Rules** to protect your database
- Implement **proper authentication** before production
- **Review permissions** for different user roles

### Performance Tips
- The build includes **code splitting** for better performance
- **Images and assets** are optimized during build
- **Firebase CDN** provides global distribution
- Use **lazy loading** for large components

### Database Rules
Ensure your Firestore security rules are properly configured:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Add your security rules here
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📞 Support

If you encounter any issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Firebase Console for errors
3. Check browser developer tools for JavaScript errors
4. Verify all environment variables are set correctly

---

## 🎉 Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build:client

# 4. Deploy to Firebase
npm run deploy
```

**Your app will be live at**: `https://secteur-e639e.web.app` 🚀

---

**Built with ❤️ using React, TypeScript, Firebase, and modern web technologies.**
