import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import Navbar from '../components/Navbar';

interface HomeScreenProps {
  user: FirebaseUser | null;
  onNavigateToFriends: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ user, onNavigateToFriends }) => {
  const [activeTab, setActiveTab] = useState('home');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'Logged out successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Logout failed');
    }
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'explore') {
      // Navigate to friends when explore is pressed for now
      onNavigateToFriends();
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Main Content */}
          <ScrollView 
            style={[styles.scrollView, isWeb ? styles.scrollViewWeb : styles.scrollViewMobile]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                {!isWeb && (
                  <>
                    <Text style={styles.logo}>🎮 GSO</Text>
                    <Text style={styles.subtitle}>Gamified Social Media</Text>
                  </>
                )}
                <Text style={styles.welcome}>
                  Welcome back, {user?.displayName || 'User'}!
                </Text>
                <Text style={styles.description}>
                  Level 1 • 0 XP • Ready to earn some points?
                </Text>
              </View>

              {/* Stats Cards */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>0</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>0</Text>
                  <Text style={styles.statLabel}>Friends</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>1</Text>
                  <Text style={styles.statLabel}>Level</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>0</Text>
                  <Text style={styles.statLabel}>Achievements</Text>
                </View>
              </View>

              {/* Recent Activity */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Quick Actions</Text>
                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => Alert.alert('Coming Soon', 'Create your first post!')}>
                    <Text style={styles.actionIcon}>📝</Text>
                    <Text style={styles.actionTitle}>Create Post</Text>
                    <Text style={styles.actionSubtitle}>Share your thoughts</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={onNavigateToFriends}>
                    <Text style={styles.actionIcon}>👥</Text>
                    <Text style={styles.actionTitle}>Find Friends</Text>
                    <Text style={styles.actionSubtitle}>Connect with others</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={() => Alert.alert('Coming Soon', 'Complete challenges!')}>
                    <Text style={styles.actionIcon}>🎮</Text>
                    <Text style={styles.actionTitle}>Challenges</Text>
                    <Text style={styles.actionSubtitle}>Earn XP and rewards</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={() => Alert.alert('Coming Soon', 'View your achievements!')}>
                    <Text style={styles.actionIcon}>🏆</Text>
                    <Text style={styles.actionTitle}>Achievements</Text>
                    <Text style={styles.actionSubtitle}>Track progress</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Feed Placeholder */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 Your Feed</Text>
                <View style={styles.feedPlaceholder}>
                  <Text style={styles.placeholderIcon}>🎉</Text>
                  <Text style={styles.placeholderTitle}>Welcome to GSO!</Text>
                  <Text style={styles.placeholderText}>
                    Start by creating your first post or connecting with friends. 
                    Your personalized feed will appear here.
                  </Text>
                  <TouchableOpacity style={styles.placeholderButton} onPress={() => Alert.alert('Coming Soon', 'Create your first post!')}>
                    <Text style={styles.placeholderButtonText}>Create First Post</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Logout Button */}
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          {/* Navbar */}
          <Navbar activeTab={activeTab} onTabPress={handleTabPress} user={user} />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewWeb: {
    marginTop: 70, // Account for top navbar
  },
  scrollViewMobile: {
    marginBottom: 80, // Account for bottom navbar
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: Platform.OS === 'web' ? 20 : 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 20,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    width: '48%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
  },
  feedPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 280,
  },
  placeholderButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  placeholderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
});

export default HomeScreen;