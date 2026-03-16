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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@/services/firebase';
import { getLeaderboard, LeaderboardEntry } from '@/services/leaderboardService';
import { getUserDataWithCounts } from '@/services/postsService';
import { User } from '@/types';
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

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

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
  const currentUser = auth.currentUser;

  const fetchData = useCallback(async () => {
    try {
      const [board, user] = await Promise.all([
        getLeaderboard(50),
        currentUser ? getUserDataWithCounts(currentUser.uid) : Promise.resolve(null),
      ]);
      setEntries(board);
      setUserData(user);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
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
    else if (tab === 'create') onNavigateToCreatePost();
    else if (tab === 'achievements') onNavigateToAchievements();
    else if (tab === 'profile') onNavigateToProfile();
    else if (tab === 'leaderboard') { /* already here */ }
  };

  const currentUserRank = entries.findIndex(e => e.id === currentUser?.uid);

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.id === currentUser?.uid;
    const medal = MEDALS[item.rank];

    return (
      <TouchableOpacity
        style={[styles.row, isCurrentUser && styles.rowHighlight]}
        onPress={() => onNavigateToProfile(item.id)}
        activeOpacity={0.75}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={[styles.rankText, isCurrentUser && styles.rankTextHighlight]}>
              {item.rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {item.profilePicture ? (
          <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Name + level */}
        <View style={styles.nameContainer}>
          <Text style={[styles.displayName, isCurrentUser && styles.displayNameHighlight]} numberOfLines={1}>
            {item.displayName}{isCurrentUser ? ' (You)' : ''}
          </Text>
          <Text style={styles.levelText}>Level {item.level}</Text>
        </View>

        {/* XP */}
        <View style={styles.xpContainer}>
          <Text style={[styles.xpValue, isCurrentUser && styles.xpValueHighlight]}>
            {item.xp.toLocaleString()}
          </Text>
          <Text style={styles.xpLabel}>XP</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={[styles.safeArea, Platform.OS === 'web' && styles.safeAreaWeb]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
          <Text style={styles.headerSub}>Top 50 by XP</Text>
        </View>

        {/* Current user rank banner (if not in top list) */}
        {currentUserRank === -1 && userData && (
          <View style={styles.myRankBanner}>
            <Text style={styles.myRankText}>
              You're not in the top 50 yet — keep earning XP!
            </Text>
          </View>
        )}

        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderItem}
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
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
});

export default LeaderboardScreen;
