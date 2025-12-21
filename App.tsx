import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OfflineProvider } from './src/context/OfflineContext';
import OfflineIndicator from './src/components/OfflineIndicator';
import React from 'react';

const App: React.FC = () => {
  return (
    <OfflineProvider>
      <SafeAreaView style={styles.container}>
        <OfflineIndicator />
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={styles.title}>🎮 GSO</Text>
            <Text style={styles.subtitle}>Gamified Social Media</Text>
            <Text style={styles.description}>
              Welcome to your new gamified social experience!
            </Text>
            <Text style={styles.offlineInfo}>
              📱 Works offline! Your actions sync when connected.
            </Text>
          </View>
        </LinearGradient>
        <StatusBar style="light" />
      </SafeAreaView>
    </OfflineProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
    opacity: 0.9,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
    maxWidth: 300,
    lineHeight: 22,
  },
  offlineInfo: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 20,
    fontStyle: 'italic',
  },
});

export default App;