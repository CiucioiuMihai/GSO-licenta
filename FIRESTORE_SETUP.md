# Firestore Setup Instructions

## To deploy the Firestore security rules:

1. Install Firebase CLI if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project directory:
   ```bash
   firebase init firestore
   ```

4. When prompted, select your existing Firebase project (gso-gamified-social)

5. The firestore.rules file is already created in this directory

6. Deploy the rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Alternative: Manual Setup

1. Go to https://console.firebase.google.com
2. Select your project: gso-gamified-social  
3. Go to Firestore Database
4. Click on "Rules" tab
5. Copy and paste the content from firestore.rules file
6. Click "Publish"

## Test Data (Optional)

You can create some test users in the Firebase console to test the friend system:
1. Go to Firestore Database > Data
2. Create collection: users
3. Add documents with structure matching your User interface

The current rules allow:
- Users to read/write their own data
- Users to read other users (for search)
- Friend requests between authenticated users
- Messages between participants only