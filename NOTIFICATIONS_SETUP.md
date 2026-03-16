# Push Notifications Setup Guide

This guide explains how to set up and use push notifications for messages on web, Android, and iOS.

## ✅ What's Already Implemented

1. **Notification Service** (`src/services/notificationService.ts`)
   - Platform detection (web vs mobile)
   - Web notifications using browser Notification API
   - Mobile push notifications using Expo Notifications
   - Automatic notification registration on user login

2. **Message Notifications**
   - Notifications are automatically sent when users receive messages
   - Bot responses also trigger notifications
   - Notifications include sender name and message preview

3. **Firestore Integration**
   - User notification settings stored in Firestore
   - Push tokens stored securely
   - In-app notifications created for history

4. **Firestore Rules**
   - Updated to allow notification-related fields
   - Secure access to notification data

## 🔧 Setup Steps

### Step 1: Get Your Expo Project ID

1. Create an Expo account at https://expo.dev
2. Run `npx expo login` to log in
3. Run `eas init` to initialize EAS (Expo Application Services)
4. Your project ID will be shown - copy it
5. Update `src/services/notificationService.ts` line 52:
   ```typescript
   projectId: 'your-actual-expo-project-id', // Replace this
   ```

### Step 2: Configure Android (FCM)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings > Cloud Messaging
4. Under "Cloud Messaging API (Legacy)", enable it
5. Copy the Server Key
6. Go to [Expo Dashboard](https://expo.dev) > Your Project > Credentials
7. Add FCM Server Key under Android credentials

### Step 3: Configure iOS (APNs)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/)
2. Create an App ID with Push Notifications capability
3. Generate APNs Key:
   - Go to Certificates, Identifiers & Profiles
   - Keys > Create a new key
   - Enable Apple Push Notifications service (APNs)
   - Download the .p8 key file
4. In Expo Dashboard > Your Project > Credentials:
   - Add iOS credentials
   - Upload your APNs key

### Step 4: Set Up Firebase Cloud Functions (for Push Delivery)

Create a Cloud Function to send push notifications when documents are added to `pushNotifications` collection:

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushNotification = functions.firestore
  .document('pushNotifications/{pushId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    if (data.sent) return; // Already sent
    
    try {
      // Send push notification using Expo's Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: data.to,
          title: data.title,
          body: data.body,
          data: data.data,
          sound: data.sound || 'default',
          priority: data.priority || 'high',
          channelId: data.channelId || 'default',
        }),
      });
      
      // Mark as sent
      await snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      
      console.log('Push notification sent successfully');
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  });
```

Deploy Cloud Functions:
```bash
npm install -g firebase-tools
firebase login
firebase init functions
firebase deploy --only functions
```

### Step 5: Test Notifications

#### Testing Web Notifications:
1. Run `npm run web`
2. When prompted, click "Allow" for notifications
3. Open two browser windows with different accounts
4. Send a message from one to the other
5. You should see a desktop notification

#### Testing Mobile Notifications:
1. **Must use a physical device** (emulators don't support push notifications)
2. Run `npx expo start`
3. Scan QR code with Expo Go app
4. Log in and grant notification permissions
5. Send a message from another device
6. You should receive a push notification

## 🎯 How It Works

### Web Notifications
1. User logs in → Browser requests notification permission
2. Permission granted → Flag set in Firestore
3. Message received → Local notification displayed via Notification API
4. User gets instant desktop notification

### Mobile Push Notifications
1. User logs in → App requests notification permission
2. Permission granted → Expo generates push token
3. Push token stored in user's Firestore document
4. Message received → Push notification document created
5. Cloud Function triggered → Sends push via Expo Push API
6. User receives notification on device

## 📱 Notification Types

Currently implemented:
- ✅ **Message notifications** - When receiving direct messages
- ✅ **Bot response notifications** - When bot replies

Can be extended to include:
- Friend requests
- Post likes/comments
- Achievement unlocks
- Follower notifications

## 🔒 Privacy & Settings

Users can control notifications:
- Notifications automatically enabled on first login
- Stored in Firestore: `users/{userId}/notificationsEnabled`
- Can be toggled in app settings (implement UI as needed)

## 🐛 Troubleshooting

### "Must use physical device for Push Notifications"
- Emulators/simulators don't support push notifications
- Use a real Android or iOS device with Expo Go

### Web notifications not appearing
- Check browser notification permissions
- Make sure you're on HTTPS (localhost is OK for testing)
- Check browser console for errors

### Mobile push not received
- Verify Expo project ID is correct
- Check Cloud Function logs in Firebase Console
- Ensure push token is stored in Firestore
- Verify FCM/APNs credentials in Expo Dashboard

### Notifications work but don't navigate
- Implement navigation logic in `App.tsx` notification response listener
- Use the `screen` and `conversationId` data from notification

## 🚀 Next Steps

1. **Add notification settings UI**
   - Toggle notifications on/off
   - Choose notification types
   - Quiet hours

2. **Enhance notification content**
   - Add user avatars
   - Include message images/attachments
   - Action buttons (reply, mark as read)

3. **Notification history**
   - Display in-app notification center
   - Mark as read functionality
   - Clear all

4. **Advanced features**
   - Notification batching (group multiple messages)
   - Smart notification timing
   - Do Not Disturb mode
   - Notification sounds per user/conversation

## 📚 Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Expo Push Notification Tool](https://expo.dev/notifications)
