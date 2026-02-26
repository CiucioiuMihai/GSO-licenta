import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  User, 
  AchievementDefinition, 
  LevelDefinition, 
  AchievementProgress,
  ACHIEVEMENT_DEFINITIONS,
  LEVEL_DEFINITIONS
} from '@/types';
import { 
  calculateLevel,
  getLevelProgress,
  getLevelDefinition
} from '@/utils/gamification';
import { getUserDataWithCounts } from '@/services/postsService';
import { applyRetroactiveXP } from '@/services/levelService';
import { db } from '@/services/firebase';
import { doc } from 'firebase/firestore';

interface AchievementsScreenProps {
  user: FirebaseUser | null;
  onBack: () => void;
}

type TabType = 'all' | 'social' | 'content' | 'engagement' | 'special';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

const AchievementsScreen: React.FC<AchievementsScreenProps> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [scaleAnim] = useState(new Animated.Value(1));
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingRetroactiveXP, setApplyingRetroactiveXP] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      if (user?.uid) {
        try {
          const userDataWithCounts = await getUserDataWithCounts(user.uid);
          console.log('AchievementsScreen - User data loaded:', {
            xp: userDataWithCounts?.xp,
            level: userDataWithCounts?.level,
            totalPosts: userDataWithCounts?.totalPosts,
            totalFriends: userDataWithCounts?.totalFriends,
            totalLikes: userDataWithCounts?.totalLikes
          });
          setUserData(userDataWithCounts);
          
          // Always check and apply retroactive XP when visiting achievements page
          const hasActivity = userDataWithCounts && 
            ((userDataWithCounts.totalPosts || 0) > 0 || 
             (userDataWithCounts.totalFriends || 0) > 0 ||
             (userDataWithCounts.totalLikes || 0) > 0);
             
          console.log('AchievementsScreen - Checking retroactive XP:', {
            hasActivity,
            totalPosts: userDataWithCounts?.totalPosts,
            totalFriends: userDataWithCounts?.totalFriends,
            totalLikes: userDataWithCounts?.totalLikes,
            currentXP: userDataWithCounts?.xp,
            currentLevel: userDataWithCounts?.level
          });
          
          if (hasActivity) {
            console.log('AchievementsScreen - Starting automatic retroactive XP check...');
            setApplyingRetroactiveXP(true);
            try {
              const retroResult = await applyRetroactiveXP(user.uid);
              console.log('AchievementsScreen - Retroactive XP result:', retroResult);
              if (retroResult.retroactiveXP > 0 || retroResult.leveledUp) {
                console.log('AchievementsScreen - Refreshing user data after XP application...');
                // Refresh user data to show updated XP and level
                const updatedUserData = await getUserDataWithCounts(user.uid);
                console.log('AchievementsScreen - Updated user data:', {
                  xp: updatedUserData?.xp,
                  level: updatedUserData?.level,
                  previousLevel: retroResult.previousLevel,
                  newLevel: retroResult.newLevel
                });
                setUserData(updatedUserData);
              }
            } catch (error) {
              console.error('Error applying retroactive XP:', error);
            } finally {
              setApplyingRetroactiveXP(false);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadUserData();
  }, [user?.uid]);

  if (loading || !userData) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Achievements</Text>
              <View style={styles.headerStats} />
            </View>
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {applyingRetroactiveXP ? 'Calculating your XP...' : 'Loading achievements...'}
              </Text>
              {applyingRetroactiveXP && (
                <Text style={styles.loadingSubtext}>
                  Awarding XP for your past activity! 🎉
                </Text>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  const levelProgress = getLevelProgress(userData.xp || 0);
  const currentLevelDef = getLevelDefinition(levelProgress.currentLevel);
  
  // Get user's achievement IDs
  const userAchievementIds = userData.achievements?.map((a: any) => a.id) || [];

  // Calculate achievement progress for each achievement
  const getAchievementProgress = (achievement: AchievementDefinition): AchievementProgress => {
    const isUnlocked = userAchievementIds.includes(achievement.id);
    let current = 0;
    
    switch (achievement.requirement.type) {
      case 'friends':
        current = userData.totalFriends || userData.friends?.length || 0;
        break;
      case 'posts':
        current = userData.totalPosts || 0;
        break;
      case 'likes':
        current = userData.totalLikes || 0;
        break;
      case 'comments':
        current = userData.totalComments || 0;
        break;
      case 'followers':
        current = userData.totalFollowers || userData.followers?.length || 0;
        break;
      case 'streak':
        current = userData.dailyStreak || 0;
        break;
    }

    const required = achievement.requirement.count;
    const percentage = Math.min((current / required) * 100, 100);

    return {
      current,
      required,
      percentage,
      completed: isUnlocked
    };
  };

  // Filter achievements by category
  const getFilteredAchievements = () => {
    if (activeTab === 'all') return ACHIEVEMENT_DEFINITIONS;
    return ACHIEVEMENT_DEFINITIONS.filter(ach => ach.category === activeTab);
  };

  // Sort achievements: completed first, then by progress
  const getSortedAchievements = () => {
    const filtered = getFilteredAchievements();
    return filtered.sort((a, b) => {
      const progressA = getAchievementProgress(a);
      const progressB = getAchievementProgress(b);
      
      if (progressA.completed && !progressB.completed) return -1;
      if (!progressA.completed && progressB.completed) return 1;
      
      return progressB.percentage - progressA.percentage;
    });
  };

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
    Animated.sequence([
      Animated.timing(scaleAnim, { duration: 100, toValue: 0.95, useNativeDriver: true }),
      Animated.timing(scaleAnim, { duration: 100, toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const renderLevelCard = () => (
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
            <Text style={styles.xpText}>{userData.xp || 0} XP</Text>
          </View>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${levelProgress.progressPercentage}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {levelProgress.progressPercentage}% to Level {levelProgress.currentLevel + 1}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

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
              {progress.completed ? item.icon : isLocked ? '🔒' : item.icon}
            </Text>
            <View style={styles.achievementInfo}>
              <Text style={[styles.achievementTitle, isLocked && styles.lockedText]}>
                {item.title}
              </Text>
              <Text style={[styles.achievementDescription, isLocked && styles.lockedText]}>
                {item.description}
              </Text>
              <Text style={[styles.xpReward, isLocked && styles.lockedText]}>
                +{item.xpReward} XP
              </Text>
            </View>
          </View>
          
          {!progress.completed && (
            <View style={styles.achievementProgressContainer}>
              <View style={styles.achievementProgressBar}>
                <View 
                  style={[
                    styles.achievementProgressFill,
                    { width: `${progress.percentage}%` }
                  ]}
                />
              </View>
              <Text style={[styles.achievementProgressText, isLocked && styles.lockedText]}>
                {progress.current} / {progress.required}
              </Text>
            </View>
          )}
          
          {progress.completed && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓ Completed</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const renderTabButton = (tab: TabType, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => handleTabPress(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'social', label: 'Social' },
    { key: 'content', label: 'Content' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'special', label: 'Special' },
  ];

  const sortedAchievements = getSortedAchievements();
  const completedCount = sortedAchievements.filter(ach => 
    userAchievementIds.includes(ach.id)
  ).length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Achievements</Text>
            <View style={styles.headerStats}>
              <Text style={styles.statsText}>
                {completedCount} / {ACHIEVEMENT_DEFINITIONS.length}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Level Progress Card */}
            {renderLevelCard()}

            {/* Achievement Stats */}
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

            {/* Category Tabs */}
            <Animated.View style={[styles.tabContainer, { transform: [{ scale: scaleAnim }] }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {tabs.map(tab => renderTabButton(tab.key as TabType, tab.label))}
              </ScrollView>
            </Animated.View>

            {/* Achievements List */}
            <View style={styles.achievementsContainer}>
              <FlatList
                data={sortedAchievements}
                renderItem={renderAchievementCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  statsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  levelCard: {
    marginBottom: 20,
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
    marginBottom: 15,
  },
  levelEmoji: {
    fontSize: 48,
    marginRight: 15,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  levelName: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  xpText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  tabContainer: {
    marginBottom: 20,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeTabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  tabText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#667eea',
  },
  achievementsContainer: {
    paddingBottom: 20,
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
    opacity: 0.7,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  xpReward: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  lockedText: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  achievementProgressContainer: {
    marginTop: 12,
  },
  achievementProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  achievementProgressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
    fontWeight: '600',
  },
  completedBadge: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  completedText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AchievementsScreen;
