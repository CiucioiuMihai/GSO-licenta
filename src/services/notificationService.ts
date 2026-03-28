import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

let activeConversationId: string | null = null;

export const setActiveConversationForNotifications = (conversationId: string | null) => {
  activeConversationId = conversationId;
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Store push token in Firestore
export const registerForPushNotificationsAsync = async (userId: string): Promise<string | null> => {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    // Web notifications using browser API
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Web notification permission granted');
        // Store a web flag in Firestore
        await updateUserNotificationSettings(userId, { webNotificationsEnabled: true });
      }
    }
    return null;
  }

  // Mobile push notifications
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    try {
      // Expo Go cannot fetch remote push tokens on Android (SDK 53+).
      if (Constants.appOwnership === 'expo') {
        console.log('Running in Expo Go: skipping remote push token registration');
        await updateUserNotificationSettings(userId, { notificationsEnabled: true });
        return null;
      }

      if (Platform.OS === 'android') {
        const hasGoogleServicesFile = Boolean(
          (Constants.expoConfig as { android?: { googleServicesFile?: string } } | null)?.android
            ?.googleServicesFile
        );

        if (!hasGoogleServicesFile) {
          console.log(
            'Android push disabled: missing expo.android.googleServicesFile in app config. Add google-services.json and rebuild the dev client.'
          );
          await updateUserNotificationSettings(userId, { notificationsEnabled: true });
          return null;
        }
      }

      const projectId =
        Constants.easConfig?.projectId ||
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

      if (!projectId) {
        console.log('No EAS projectId found; skipping remote push token registration');
        await updateUserNotificationSettings(userId, { notificationsEnabled: true });
        return null;
      }

      const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = pushTokenData.data;

      // Store token in Firestore
      await updateUserNotificationSettings(userId, { 
        pushToken: token,
        notificationsEnabled: true 
      });
    } catch (error) {
      console.error('Error getting push token:', error);
      // Continue anyway - notifications will still work locally
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  // Android specific channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
};

// Update user notification settings in Firestore
const updateUserNotificationSettings = async (
  userId: string, 
  settings: { pushToken?: string; notificationsEnabled?: boolean; webNotificationsEnabled?: boolean }
) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, settings);
};

// Send local notification (appears on user's device)
export const sendLocalNotification = async (title: string, body: string, data?: any) => {
  if (Platform.OS === 'web') {
    // Web notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon.png', // Add your app icon path
        badge: '/badge.png',
        tag: data?.conversationId || 'message',
        requireInteraction: false,
      });
    }
  } else {
    // Mobile notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
  }
};

// Send push notification to another user (requires backend implementation)
// This creates a Firestore notification that should trigger a Cloud Function to send push
export const sendPushNotificationToUser = async (
  toUserId: string,
  title: string,
  body: string,
  data?: any
) => {
  try {
    // Check if user has push notifications enabled
    const userRef = doc(db, 'users', toUserId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const pushToken = userData?.pushToken;
    const notificationsEnabled = userData?.notificationsEnabled;
    const webNotificationsEnabled = userData?.webNotificationsEnabled;

    // For web users with notifications enabled
    if (webNotificationsEnabled && !pushToken) {
      // Create Firestore notification that the web app will display
      await createInAppNotification(toUserId, {
        type: 'message',
        message: body,
        fromUserId: data?.fromUserId,
        data,
      });
      return;
    }

    // For mobile users with push tokens
    if (pushToken && notificationsEnabled) {
      // Store notification request in Firestore
      // A Cloud Function would listen to this collection and send actual push notifications
      await setDoc(doc(db, 'pushNotifications', `${Date.now()}_${toUserId}`), {
        to: pushToken,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: data?.type === 'message' ? 'messages' : 'default',
        createdAt: new Date(),
        sent: false,
      });

      // Also create in-app notification for when they open the app
      await createInAppNotification(toUserId, {
        type: 'message',
        message: body,
        fromUserId: data?.fromUserId,
        data,
      });
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

// Create in-app notification (stored in Firestore)
const createInAppNotification = async (
  userId: string,
  notificationData: {
    type: string;
    message: string;
    fromUserId?: string;
    data?: any;
  }
) => {
  const { createNotification } = await import('./firestore');
  await createNotification(userId, {
    type: notificationData.type as any,
    message: notificationData.message,
    fromUserId: notificationData.fromUserId,
    data: notificationData.data,
  });
};

// Send message notification (combines local and push)
export const sendMessageNotification = async (
  toUserId: string,
  fromUserId: string,
  fromUserName: string,
  messagePreview: string,
  conversationId: string
) => {
  const title = fromUserName;
  const body = messagePreview.length > 100 
    ? messagePreview.substring(0, 97) + '...' 
    : messagePreview;

  // Send push notification to recipient
  await sendPushNotificationToUser(toUserId, title, body, {
    type: 'message',
    fromUserId,
    conversationId,
    screen: 'DirectMessages',
  });
};

// Listen to incoming direct messages and show local notifications on this device/browser.
export const listenForIncomingMessages = (userId: string) => {
  let initialized = false;

  return import('firebase/firestore').then(({ collection, onSnapshot, query, where }) => {
    const q = query(collection(db, 'directMessages'), where('toUserId', '==', userId));

    return onSnapshot(q, async (snapshot) => {
      if (!initialized) {
        initialized = true;
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;

        const msg = change.doc.data() as {
          fromUserId?: string;
          message?: string;
          conversationId?: string;
        };

        if (!msg.fromUserId || !msg.message) continue;

        if (msg.conversationId && activeConversationId && msg.conversationId === activeConversationId) {
          continue;
        }

        try {
          const senderDoc = await getDoc(doc(db, 'users', msg.fromUserId));
          const senderName = senderDoc.exists()
            ? (senderDoc.data()?.displayName as string | undefined) || 'New message'
            : 'New message';

          await sendLocalNotification(senderName, msg.message, {
            type: 'message',
            fromUserId: msg.fromUserId,
            conversationId: msg.conversationId,
            screen: 'DirectMessages',
          });
        } catch (error) {
          console.error('Error showing incoming message notification:', error);
        }
      }
    });
  });
};

// Listen for notification responses (when user taps notification)
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// Get badge count (unread notifications)
export const getBadgeCount = async (): Promise<number> => {
  if (Platform.OS === 'web') return 0;
  return await Notifications.getBadgeCountAsync();
};

// Set badge count
export const setBadgeCount = async (count: number) => {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count);
};

// Clear all notifications
export const clearAllNotifications = async () => {
  if (Platform.OS === 'web') return;
  await Notifications.dismissAllNotificationsAsync();
};
