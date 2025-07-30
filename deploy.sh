#!/bin/bash

# Deployment script for Firebase Hosting
echo "🚀 Starting deployment process..."

echo "📦 Building application..."
npm run build:client

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🚀 Deploying to Firebase Hosting..."
    firebase deploy --only hosting
    
    if [ $? -eq 0 ]; then
        echo "✅ Deployment successful!"
        echo "🌐 Your app is now live!"
        firebase hosting:channel:list
    else
        echo "❌ Deployment failed!"
        exit 1
    fi
else
    echo "❌ Build failed!"
    exit 1
fi
