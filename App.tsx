import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineProvider } from './src/context/OfflineContext';
import OfflineIndicator from './src/components/OfflineIndicator';
import AuthNavigator from './src/navigation/AuthNavigator';
import React from 'react';

const App: React.FC = () => {
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