import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  RefreshControl,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@/services/firebase';
import { getLeaderboard, LeaderboardEntry } from '@/services/leaderboardService';
import { getUserDataWithCounts } from '@/services/postsService';
import { checkAndUnlockAchievements } from '@/services/levelService';
import {
  User,
  AchievementDefinition,
  AchievementProgress,
  ACHIEVEMENT_DEFINITIONS,
} from '@/types';
import { getLevelProgress, getLevelDefinition } from '@/utils/gamification';
import Navbar from '@/components/Navbar';

interface LeaderboardScreenProps {
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

type MainTab = 'leaderboard' | 'my-achievements';
type AchievementCategory = 'all' | 'social' | 'content' | 'engagement' | 'special';

const MEDALS: Record<number, string> = { 1: '#1', 2: '#2', 3: '#3' };

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToLeaderboard,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [navbarTab, setNavbarTab] = useState('leaderboard');
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('leaderboard');
  const [activeAchievementCategory, setActiveAchievementCategory] = useState<AchievementCategory>('all');
  const [categoryScaleAnim] = useState(new Animated.Value(1));
  const currentUser = auth.currentUser;

  const fetchData = useCallback(async () => {
    try {
      const boardPromise = getLeaderboard(50);
      let loadedUser: User | null = null;

      if (currentUser?.uid) {
        loadedUser = await getUserDataWithCounts(currentUser.uid);

        if (loadedUser) {
          const newlyUnlocked = await checkAndUnlockAchievements(currentUser.uid, loadedUser);
          if (newlyUnlocked.length > 0) {
            loadedUser = await getUserDataWithCounts(currentUser.uid);
          }
        }
      }

      const board = await boardPromise;
      setEntries(board);
      setUserData(loadedUser);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleNavbarTabPress = (tab: string) => {
    setNavbarTab(tab);
    if (tab === 'home') onNavigateToHome();
    else if (tab === 'explore') onNavigateToFriends();
    else if (tab === 'posts') onNavigateToPostsFeed();
    else if (tab === 'create') onNavigateToCreatePost();
    else if (tab === 'profile') onNavigateToProfile();
    else if (tab === 'leaderboard') {
      setActiveMainTab('leaderboard');
    }
  };

  const handleMainTabPress = (tab: MainTab) => {
    setActiveMainTab(tab);
  };

  const handleAchievementCategoryPress = (tab: AchievementCategory) => {
    setActiveAchievementCategory(tab);
    Animated.sequence([
      Animated.timing(categoryScaleAnim, { duration: 100, toValue: 0.97, useNativeDriver: true }),
      Animated.timing(categoryScaleAnim, { duration: 100, toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const currentUserRank = entries.findIndex(e => e.id === currentUser?.uid);

  const userAchievementIdSet = new Set((userData?.achievements || []).map((a: any) => a.id));
  const userAchievementIds = Array.from(userAchievementIdSet);

  const getAchievementProgress = (achievement: AchievementDefinition): AchievementProgress => {
    const isUnlocked = userAchievementIds.includes(achievement.id);
    let current = 0;

    switch (achievement.requirement.type) {
      case 'friends':
        current = userData?.totalFriends || userData?.friends?.length || 0;
        break;
      case 'posts':
        current = userData?.totalPosts || 0;
        break;
      case 'likes':
        current = userData?.totalLikes || 0;
        break;
      case 'comments':
        current = userData?.totalComments || 0;
        break;
      case 'followers':
        current = userData?.totalFollowers || userData?.followers?.length || 0;
        break;
      case 'streak':
        current = userData?.dailyStreak || 0;
        break;
    }

    const required = achievement.requirement.count;
    const percentage = Math.min((current / required) * 100, 100);

    return {
      current,
      required,
      percentage,
      completed: isUnlocked,
    };
  };

  const getSortedAchievements = () => {
    const filtered = activeAchievementCategory === 'all'
      ? ACHIEVEMENT_DEFINITIONS
      : ACHIEVEMENT_DEFINITIONS.filter(ach => ach.category === activeAchievementCategory);

    return [...filtered].sort((a, b) => {
      const progressA = getAchievementProgress(a);
      const progressB = getAchievementProgress(b);

      if (progressA.completed && !progressB.completed) return -1;
      if (!progressA.completed && progressB.completed) return 1;

      return progressB.percentage - progressA.percentage;
    });
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.id === currentUser?.uid;
    const medal = MEDALS[item.rank];

    return (
      <TouchableOpacity
        style={[styles.row, isCurrentUser && styles.rowHighlight]}
        onPress={() => onNavigateToProfile(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.rankContainer}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={[styles.rankText, isCurrentUser && styles.rankTextHighlight]}>
              {item.rank}
            </Text>
          )}
        </View>

        {item.profilePicture ? (
          <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.nameContainer}>
          <Text style={[styles.displayName, isCurrentUser && styles.displayNameHighlight]} numberOfLines={1}>
            {item.displayName}{isCurrentUser ? ' (You)' : ''}
          </Text>
          <Text style={styles.levelText}>Level {item.level}</Text>
        </View>

        <View style={styles.xpContainer}>
          <Text style={[styles.xpValue, isCurrentUser && styles.xpValueHighlight]}>
            {item.xp.toLocaleString()}
          </Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAchievementCard = ({ item }: { item: AchievementDefinition }) => {
    const progress = getAchievementProgress(item);
    const isLocked = !progress.completed && progress.percentage < 100;

    return (
      <View style={[styles.achievementCard, isLocked && styles.lockedCard]}>
        <LinearGradient
          colors={progress.completed ? ['#4CAF50', '#45a049'] : isLocked ? ['#E0E0E0', '#BDBDBD'] : ['#2196F3', '#1976D2']}
          style={styles.achievementGradient}
        >
          <View style={styles.achievementHeader}>
            <Text style={[styles.achievementEmoji, isLocked && styles.lockedEmoji]}>
              {progress.completed ? item.icon : isLocked ? 'LOCKED' : item.icon}
            </Text>
            <View style={styles.achievementInfo}>
              <Text style={[styles.achievementTitle, isLocked && styles.lockedText]}>{item.title}</Text>
              <Text style={[styles.achievementDescription, isLocked && styles.lockedText]}>{item.description}</Text>
              <Text style={[styles.xpReward, isLocked && styles.lockedText]}>+{item.xpReward} XP</Text>
            </View>
          </View>

          {!progress.completed && (
            <View style={styles.achievementProgressContainer}>
              <View style={styles.achievementProgressBar}>
                <View style={[styles.achievementProgressFill, { width: `${progress.percentage}%` }]} />
              </View>
              <Text style={[styles.achievementProgressText, isLocked && styles.lockedText]}>
                {progress.current} / {progress.required}
              </Text>
            </View>
          )}

          {progress.completed && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderMainTabSwitcher = () => (
    <View style={styles.mainTabsContainer}>
      <TouchableOpacity
        style={[styles.mainTabButton, activeMainTab === 'leaderboard' && styles.mainTabButtonActive]}
        onPress={() => handleMainTabPress('leaderboard')}
      >
        <Text style={[styles.mainTabText, activeMainTab === 'leaderboard' && styles.mainTabTextActive]}>
          Leaderboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.mainTabButton, activeMainTab === 'my-achievements' && styles.mainTabButtonActive]}
        onPress={() => handleMainTabPress('my-achievements')}
      >
        <Text style={[styles.mainTabText, activeMainTab === 'my-achievements' && styles.mainTabTextActive]}>
          My Achievements
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAchievementsView = () => {
    if (!userData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Sign in to view your achievements</Text>
        </View>
      );
    }

    const levelProgress = getLevelProgress(userData.xp || 0);
    const currentLevelDef = getLevelDefinition(levelProgress.currentLevel);
    const completedCount = ACHIEVEMENT_DEFINITIONS.filter(ach => userAchievementIdSet.has(ach.id)).length;
    const sortedAchievements = getSortedAchievements();

    const categoryTabs: Array<{ key: AchievementCategory; label: string }> = [
      { key: 'all', label: 'All' },
      { key: 'social', label: 'Social' },
      { key: 'content', label: 'Content' },
      { key: 'engagement', label: 'Engagement' },
      { key: 'special', label: 'Special' },
    ];

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFD700"
            colors={['#FFD700']}
          />
        }
      >
        <View style={styles.levelCard}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.levelGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.levelContent}>
              <Text style={styles.levelEmoji}>{currentLevelDef.icon}</Text>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>Level {levelProgress.currentLevel}</Text>
                <Text style={styles.levelName}>{currentLevelDef.title}</Text>
                <Text style={styles.levelXpText}>{userData.xp || 0} XP</Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${levelProgress.progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {levelProgress.progressPercentage}% to Level {levelProgress.currentLevel + 1}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userData.xp || 0}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{levelProgress.currentLevel}</Text>
            <Text style={styles.statLabel}>Current Level</Text>
          </View>
        </View>

        <Animated.View style={[styles.categoryTabsContainer, { transform: [{ scale: categoryScaleAnim }] }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categoryTabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.categoryTabButton,
                  activeAchievementCategory === tab.key && styles.categoryTabButtonActive,
                ]}
                onPress={() => handleAchievementCategoryPress(tab.key)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeAchievementCategory === tab.key && styles.categoryTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        <View style={styles.achievementsContainer}>
          <FlatList
            data={sortedAchievements}
            renderItem={renderAchievementCard}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading progress...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && styles.safeAreaWeb]} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress</Text>
          <Text style={styles.headerSub}>
            {activeMainTab === 'leaderboard' ? 'Top 50 by XP' : 'Track and unlock achievements'}
          </Text>
        </View>

        {renderMainTabSwitcher()}

        {activeMainTab === 'leaderboard' ? (
          <>
            {currentUserRank === -1 && userData && (
              <View style={styles.myRankBanner}>
                <Text style={styles.myRankText}>
                  You are not in the top 50 yet. Keep earning XP.
                </Text>
              </View>
            )}

            <FlatList
              data={entries}
              keyExtractor={item => item.id}
              renderItem={renderLeaderboardItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#FFD700"
                  colors={['#FFD700']}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No data yet</Text>
                </View>
              }
            />
          </>
        ) : (
          renderAchievementsView()
        )}

        <Navbar activeTab={navbarTab} onTabPress={handleNavbarTabPress} user={userData} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  safeAreaWeb: { paddingTop: 70 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },

  mainTabsContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 10,
  },
  mainTabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mainTabButtonActive: {
    backgroundColor: '#FFD700',
  },
  mainTabText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  mainTabTextActive: {
    color: '#1a1a2e',
  },

  myRankBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  myRankText: {
    color: '#FFD700',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowHighlight: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  medal: {
    fontSize: 22,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },
  rankTextHighlight: {
    color: '#FFD700',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginHorizontal: 10,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  displayName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  displayNameHighlight: {
    color: '#FFD700',
  },
  levelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  xpValueHighlight: {
    color: '#FFD700',
  },
  xpLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  levelCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  levelGradient: {
    padding: 20,
  },
  levelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelEmoji: {
    fontSize: 44,
    marginRight: 14,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  levelName: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  levelXpText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  categoryTabsContainer: {
    marginBottom: 14,
  },
  categoryTabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  categoryTabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  categoryTabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#0f3460',
  },

  achievementsContainer: {
    paddingBottom: 8,
  },
  achievementCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  lockedCard: {
    opacity: 0.72,
  },
  achievementGradient: {
    padding: 16,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  lockedEmoji: {
    opacity: 0.5,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 4,
  },
  xpReward: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
  },
  lockedText: {
    color: 'rgba(0,0,0,0.52)',
  },
  achievementProgressContainer: {
    marginTop: 12,
  },
  achievementProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  achievementProgressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'right',
    fontWeight: '600',
  },
  completedBadge: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  completedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
});

export default LeaderboardScreen;
