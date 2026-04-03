import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { getUserDataWithCounts } from '@/services/postsService';
import { claimDailyQuestXP, ensureDailyQuestForToday, handleDailyLogin, syncUserXP } from '@/services/levelService';
import { User } from '@/types';
import Navbar from '../components/Navbar';

interface HomeScreenProps {
  user: FirebaseUser | null;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ 
  user, 
  onNavigateToFriends, 
  onNavigateToPostsFeed, 
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToLeaderboard,
  onNavigateToProfile,
}) => {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 900;

  const [activeTab, setActiveTab] = useState('home');
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyLoginChecked, setDailyLoginChecked] = useState(false);
  const [dailyQuestLoading, setDailyQuestLoading] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('');
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; kind: 'success' | 'info' | 'error' }>({
    visible: false,
    message: '',
    kind: 'info',
  });
  const snackbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasClaimedDailyQuestToday = useCallback((lastClaim?: Date) => {
    if (!lastClaim) {
      return false;
    }

    let claimDate: Date;
    if (typeof lastClaim === 'object' && 'toDate' in (lastClaim as any)) {
      claimDate = (lastClaim as any).toDate();
    } else if (lastClaim instanceof Date) {
      claimDate = lastClaim;
    } else {
      claimDate = new Date(lastClaim as any);
    }

    if (Number.isNaN(claimDate.getTime())) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    claimDate.setHours(0, 0, 0, 0);
    return claimDate.toDateString() === today.toDateString();
  }, []);

  const getDailyResetCountdown = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msLeft = tomorrow.getTime() - now.getTime();
    const totalMinutes = Math.max(0, Math.floor(msLeft / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `Resets in ${hours}h ${minutes}m`;
  }, []);

  const showSnackbar = useCallback((message: string, kind: 'success' | 'info' | 'error' = 'info') => {
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
      snackbarTimeoutRef.current = null;
    }

    setSnackbar({ visible: true, message, kind });
    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbar(prev => ({ ...prev, visible: false }));
      snackbarTimeoutRef.current = null;
    }, 2400);
  }, []);

  const fetchUserData = useCallback(async (checkDailyLogin: boolean = false) => {
    if (user?.uid) {
      try {
        const userDataWithCounts = await getUserDataWithCounts(user.uid);

        if (!userDataWithCounts) {
          setUserData(null);
          return;
        }

        setUserData(userDataWithCounts);
        
        // Always sync XP to ensure it matches actual user stats
        console.log('HomeScreen - Syncing user XP with actual stats');
        await syncUserXP(user.uid, userDataWithCounts);
        
        // Track daily login only on initial load, not on refresh
        if (checkDailyLogin && !dailyLoginChecked && userDataWithCounts) {
          console.log('HomeScreen - Checking daily login for first time');
          await handleDailyLogin(user.uid, userDataWithCounts);
          setDailyLoginChecked(true);
        }

        await ensureDailyQuestForToday(user.uid);
        
        // Refresh user data to get updated XP, level, and streak
        const updatedUserData = await getUserDataWithCounts(user.uid);
        setUserData(updatedUserData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
  }, [user?.uid, dailyLoginChecked]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchUserData(true); // Check daily login on initial load
      setLoading(false);
    };

    loadData();
  }, [user?.uid]); // Remove fetchUserData from dependencies to prevent loops

  useEffect(() => {
    setResetCountdown(getDailyResetCountdown());
    const interval = setInterval(() => {
      setResetCountdown(getDailyResetCountdown());
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [getDailyResetCountdown]);

  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
      }
    };
  }, []);

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData(false); // Don't check daily login on refresh
    setRefreshing(false);
  }, [fetchUserData]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showSnackbar('Logged out successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.message || 'Logout failed', 'error');
    }
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'explore') {
      // Navigate to friends when explore is pressed for now
      onNavigateToFriends();
    } else if (tab === 'posts') {
      onNavigateToPostsFeed();
    } else if (tab === 'home') {
      // Refresh data when user returns to home tab
      onRefresh();
    } else if (tab === 'create') {
      // Navigate to create post
      onNavigateToCreatePost();
    } else if (tab === 'profile') {
      // Navigate to profile
      onNavigateToProfile();
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  const handleCreatePost = () => {
    onNavigateToCreatePost();
    // Refresh data after a short delay to account for navigation
    setTimeout(() => {
      onRefresh();
    }, 1000);
  };

  const handleClaimDailyQuest = async () => {
    if (!user?.uid || !userData || dailyQuestLoading) {
      return;
    }

    const alreadyClaimed = hasClaimedDailyQuestToday(userData.lastDailyQuestDate);
    if (alreadyClaimed) {
      showSnackbar('Daily quest already claimed. Come back tomorrow.', 'info');
      return;
    }

    if (!userData.activeDailyQuest?.completed) {
      showSnackbar('Complete the daily quest first, then claim your XP.', 'info');
      return;
    }

    try {
      setDailyQuestLoading(true);
      const result = await claimDailyQuestXP(user.uid);

      if (result.alreadyClaimed) {
        showSnackbar('Daily quest already claimed for today.', 'info');
      } else if (result.notCompleted) {
        showSnackbar('Daily quest is not completed yet.', 'info');
      } else {
        const levelUpMessage = result.leveledUp && result.newLevel
          ? ` You reached level ${result.newLevel}!`
          : '';
        showSnackbar(`Quest completed! +${result.xpAwarded} XP.${levelUpMessage}`, 'success');
      }

      await fetchUserData(false);
    } catch (error) {
      console.error('Error claiming daily quest:', error);
      showSnackbar('Could not claim daily quest right now. Try again.', 'error');
    } finally {
      setDailyQuestLoading(false);
    }
  };

  const dailyQuestClaimedToday = hasClaimedDailyQuestToday(userData?.lastDailyQuestDate);
  const activeQuest = userData?.activeDailyQuest;
  const questProgressText = activeQuest ? `${activeQuest.progress}/${activeQuest.target}` : '--/--';
  const canClaimQuest = !!activeQuest?.completed && !dailyQuestClaimedToday;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Main Content */}
          <ScrollView 
            style={[styles.scrollView, isDesktopWeb ? styles.scrollViewWeb : styles.scrollViewMobile]}
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
              <View style={[styles.header, isDesktopWeb && styles.headerDesktopWeb]}>
                {!isDesktopWeb && (
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
                    <Text style={styles.actionIcon}>💬</Text>
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

              {/* Activity Snapshot */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Activity Snapshot</Text>
                <View style={styles.snapshotCard}>
                  <View style={styles.snapshotRow}>
                    <View style={styles.snapshotItem}>
                      <Text style={styles.snapshotValue}>{loading ? '--' : userData?.dailyStreak || 0}</Text>
                      <Text style={styles.snapshotLabel}>Day Streak</Text>
                    </View>
                    <View style={styles.snapshotDivider} />
                    <View style={styles.snapshotItem}>
                      <Text style={styles.snapshotValue}>{loading ? '--' : userData?.totalFollowers || 0}</Text>
                      <Text style={styles.snapshotLabel}>Followers</Text>
                    </View>
                    <View style={styles.snapshotDivider} />
                    <View style={styles.snapshotItem}>
                      <Text style={styles.snapshotValue}>{loading ? '--' : userData?.totalFollowing || 0}</Text>
                      <Text style={styles.snapshotLabel}>Following</Text>
                    </View>
                  </View>

                  <View style={styles.snapshotActions}>
                    <TouchableOpacity style={styles.snapshotButton} onPress={onNavigateToPostsFeed}>
                      <Text style={styles.snapshotButtonText}>📱 Open Feed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.snapshotButton, styles.snapshotButtonAlt]} onPress={onNavigateToFriends}>
                      <Text style={styles.snapshotButtonText}>💬 Open Messages</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dailyQuestCard}>
                    <Text style={styles.dailyQuestTitle}>⚔️ {activeQuest?.title || 'Daily Quest'}</Text>
                    <Text style={styles.dailyQuestSubtitle}>
                      {activeQuest?.description || 'Preparing your quest...'}
                    </Text>
                    <View style={styles.dailyQuestMetaRow}>
                      <Text style={styles.dailyQuestProgress}>Progress: {questProgressText}</Text>
                      <Text style={styles.dailyQuestStatus}>
                        {dailyQuestClaimedToday
                          ? 'Reward claimed'
                          : activeQuest?.completed
                          ? 'Completed'
                          : 'In progress'}
                      </Text>
                    </View>
                    <Text style={styles.dailyQuestResetText}>{resetCountdown}</Text>
                    <TouchableOpacity
                      style={[
                        styles.dailyQuestButton,
                        (!canClaimQuest || dailyQuestLoading) && styles.dailyQuestButtonDisabled,
                      ]}
                      onPress={handleClaimDailyQuest}
                      disabled={!canClaimQuest || dailyQuestLoading || loading}
                    >
                      <Text style={styles.dailyQuestButtonText}>
                        {dailyQuestLoading
                          ? 'Claiming...'
                          : dailyQuestClaimedToday
                          ? 'Claimed Today'
                          : activeQuest?.completed
                          ? 'Claim +15 XP'
                          : 'Complete Quest First'}
                      </Text>
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
          <Navbar activeTab={activeTab} onTabPress={handleTabPress} user={userData} />

          {snackbar.visible && (
            <View
              style={[
                styles.snackbar,
                isDesktopWeb && styles.snackbarDesktopWeb,
                snackbar.kind === 'success' && styles.snackbarSuccess,
                snackbar.kind === 'error' && styles.snackbarError,
                snackbar.kind === 'info' && styles.snackbarInfo,
              ]}
            >
              <Text style={styles.snackbarText}>{snackbar.message}</Text>
            </View>
          )}
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
    marginTop: 40,
  },
  headerDesktopWeb: {
    marginTop: 20,
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
    borderWidth: Platform.OS === 'android' ? 0 : 1,
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
    borderWidth: Platform.OS === 'android' ? 0 : 1,
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
  snapshotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 18,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snapshotItem: {
    flex: 1,
    alignItems: 'center',
  },
  snapshotValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  snapshotLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.75,
  },
  snapshotDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  snapshotActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  snapshotButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  snapshotButtonAlt: {
    backgroundColor: 'rgba(102, 126, 234, 0.35)',
  },
  snapshotButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  dailyQuestCard: {
    marginTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 10,
    padding: 14,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dailyQuestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  dailyQuestSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.85,
    marginBottom: 6,
  },
  dailyQuestMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dailyQuestProgress: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.85,
    fontWeight: '600',
  },
  dailyQuestStatus: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  dailyQuestResetText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.75,
    marginBottom: 12,
  },
  dailyQuestButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.35)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  dailyQuestButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dailyQuestButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    zIndex: 20,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  snackbarDesktopWeb: {
    bottom: 24,
  },
  snackbarSuccess: {
    backgroundColor: 'rgba(46, 125, 50, 0.92)',
  },
  snackbarInfo: {
    backgroundColor: 'rgba(30, 136, 229, 0.92)',
  },
  snackbarError: {
    backgroundColor: 'rgba(198, 40, 40, 0.92)',
  },
  snackbarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HomeScreen;