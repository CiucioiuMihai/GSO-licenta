import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { getUserDataWithCounts } from '@/services/postsService';
import { handleDailyLogin } from '@/services/levelService';
import { User } from '@/types';
import Navbar from '../components/Navbar';

interface HomeScreenProps {
  user: FirebaseUser | null;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
  user, 
  onNavigateToFriends, 
  onNavigateToPostsFeed, 
  onNavigateToCreatePost,
  onNavigateToAchievements 
}) => {
  const [activeTab, setActiveTab] = useState('home');
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (user?.uid) {
      try {
        const userDataWithCounts = await getUserDataWithCounts(user.uid);
        setUserData(userDataWithCounts);
        
        // Track daily login and update streak
        if (userDataWithCounts) {
          await handleDailyLogin(user.uid, userDataWithCounts);
          // Refresh user data to get updated streak and XP
          const updatedUserData = await getUserDataWithCounts(user.uid);
          setUserData(updatedUserData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchUserData();
      setLoading(false);
    };

    loadData();
  }, [fetchUserData]);

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, [fetchUserData]);

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
    } else if (tab === 'home') {
      // Refresh data when user returns to home tab
      onRefresh();
    }
  };

  const handleCreatePost = () => {
    onNavigateToCreatePost();
    // Refresh data after a short delay to account for navigation
    setTimeout(() => {
      onRefresh();
    }, 1000);
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#667eea', '#764ba2']}
                tintColor="#667eea"
                title="Pull to refresh"
                titleColor="#667eea"
              />
            }
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
                  {loading ? 'Loading...' : `Level ${userData?.level || 1} • ${userData?.xp || 0} XP • Ready to earn some points?`}
                </Text>
              </View>

              {/* Stats Cards */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{loading ? '--' : userData?.totalPosts || 0}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{loading ? '--' : userData?.totalFriends || 0}</Text>
                  <Text style={styles.statLabel}>Friends</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{loading ? '--' : userData?.level || 1}</Text>
                  <Text style={styles.statLabel}>Level</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{loading ? '--' : userData?.achievements?.length || 0}</Text>
                  <Text style={styles.statLabel}>Achievements</Text>
                </View>
              </View>

              {/* Recent Activity */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Quick Actions</Text>
                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.actionCard} onPress={handleCreatePost}>
                    <Text style={styles.actionIcon}>📝</Text>
                    <Text style={styles.actionTitle}>Create Post</Text>
                    <Text style={styles.actionSubtitle}>Share your thoughts</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={onNavigateToPostsFeed}>
                    <Text style={styles.actionIcon}>📱</Text>
                    <Text style={styles.actionTitle}>View Posts</Text>
                    <Text style={styles.actionSubtitle}>Browse the feed</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={onNavigateToFriends}>
                    <Text style={styles.actionIcon}>�</Text>
                    <Text style={styles.actionTitle}>Messages</Text>
                    <Text style={styles.actionSubtitle}>Chat & friends</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={onNavigateToAchievements}>
                    <Text style={styles.actionIcon}>🏆</Text>
                    <Text style={styles.actionTitle}>Achievements</Text>
                    <Text style={styles.actionSubtitle}>View your progress</Text>
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
                  <View style={styles.placeholderButtons}>
                    <TouchableOpacity style={styles.placeholderButton} onPress={handleCreatePost}>
                      <Text style={styles.placeholderButtonText}>Create Post</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.placeholderButton, styles.secondaryButton]} onPress={onNavigateToPostsFeed}>
                      <Text style={styles.placeholderButtonText}>View Feed</Text>
                    </TouchableOpacity>
                  </View>
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
  placeholderButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  placeholderButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeholderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    textAlign: 'center',
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