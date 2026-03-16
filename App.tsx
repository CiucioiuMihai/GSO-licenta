import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineProvider } from './src/context/OfflineContext';
import OfflineIndicator from './src/components/OfflineIndicator';
import AuthNavigator from './src/navigation/AuthNavigator';
import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
import {
  registerForPushNotificationsAsync,
  addNotificationResponseListener,
  listenForIncomingMessages,
} from './src/services/notificationService';

const App: React.FC = () => {
  useEffect(() => {
    let unsubscribeIncomingMessages: (() => void) | null = null;

    // Listen for auth state changes and register for notifications
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeIncomingMessages) {
        unsubscribeIncomingMessages();
        unsubscribeIncomingMessages = null;
      }

      if (user) {
        // User is signed in, register for push notifications
        try {
          await registerForPushNotificationsAsync(user.uid);
          unsubscribeIncomingMessages = await listenForIncomingMessages(user.uid);
        } catch (error) {
          console.error('Error registering for push notifications:', error);
        }
      }
    });

    // Listen for notification responses (when user taps on a notification)
    const notificationSubscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      // Handle notification tap - you can add navigation logic here
      console.log('Notification tapped:', data);
      // Example: navigate to DirectMessages screen
      // if (data?.screen === 'DirectMessages') {
      //   // navigation.navigate('DirectMessages', { conversationId: data.conversationId });
      // }
    });

    return () => {
      if (unsubscribeIncomingMessages) {
        unsubscribeIncomingMessages();
      }
      unsubscribeAuth();
      notificationSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <OfflineIndicator />
        <AuthNavigator />
        <StatusBar style="light" />
      </OfflineProvider>
    </SafeAreaProvider>
  );
};

export default App;