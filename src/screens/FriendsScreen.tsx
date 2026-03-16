import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, FriendRequest, Conversation } from '@/types';
import { 
  getUserFriends, 
  getPendingFriendRequests, 
  acceptFriendRequest, 
  rejectFriendRequest,
  sendFriendRequest,
  getUserConversations,
  startBotConversation,
} from '@/services/friendsService';
import { followUser, unfollowUser, getUserDataWithCounts } from '@/services/postsService';
import { BOT_USER_ID } from '@/services/chatbotService';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import Navbar from '@/components/Navbar';

interface FriendsScreenProps {
  onStartChat: (userId: string, conversationId: string) => void;
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

type TabType = 'friends' | 'requests' | 'search';

interface FriendWithConversation extends User {
  lastMessage?: string;
  lastMessageAt?: Date;
  conversationId?: string;
  unreadCount?: number;
}

const FriendsScreen: React.FC<FriendsScreenProps> = ({ 
  onStartChat, 
  onBack,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToLeaderboard,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [navbarTab, setNavbarTab] = useState('explore');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const currentUser = auth.currentUser;

  // Merge friends with their conversations
  const friendsWithConversations = useMemo<FriendWithConversation[]>(() => {
    if (!currentUser) return [];
    
    return friends.map(friend => {
      // Find conversation with this friend
      const conversation = conversations.find(conv => 
        conv.participants.includes(friend.id)
      );
      
      if (conversation) {
        const unreadKey = `unreadCount_${currentUser.uid}` as const;
        return {
          ...friend,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          conversationId: conversation.id,
          unreadCount: conversation[unreadKey] || 0,
        };
      }
      
      return friend;
    });
  }, [friends, conversations, currentUser]);

  useEffect(() => {
    loadFriends();
    
    // Load current user data for following status
    const loadCurrentUser = async () => {
      if (currentUser) {
        const userData = await getUserDataWithCounts(currentUser.uid);
        setCurrentUserData(userData);
      }
    };
    loadCurrentUser();
    
    // Listen for friend requests
    const unsubscribeRequests = getPendingFriendRequests((requests) => {
      setFriendRequests(requests);
    });

    // Listen for conversations
    const unsubscribeConversations = getUserConversations((convs) => {
      setConversations(convs);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeConversations();
    };
  }, []);

  const loadFriends = async () => {
    try {
      const userFriends = await getUserFriends();
      setFriends(userFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const handleSearchInputChange = async (text: string) => {
    setSearchQuery(text);
    
    // Show suggestions when user types at least 2 characters
    if (text.trim().length >= 2) {
      try {
        const searchLower = text.toLowerCase();
        
        // Search for users with matching display names
        const nameQuery = query(
          collection(db, 'users'),
          where('displayName', '>=', text),
          where('displayName', '<=', text + '\uf8ff')
        );
        
        const snapshot = await getDocs(nameQuery);
        const suggestions: User[] = [];
        
        snapshot.docs.forEach(doc => {
          if (doc.id !== auth.currentUser?.uid) {
            suggestions.push({ id: doc.id, ...doc.data() } as User);
          }
        });
        
        setSearchSuggestions(suggestions.slice(0, 5)); // Limit to 5 suggestions
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSearchSuggestions([]);
      }
    } else {
      setSearchSuggestions([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    try {
      // Search users by display name (case-insensitive)
      const searchLower = searchQuery.toLowerCase();
      
      // First try exact match
      const exactQuery = query(
        collection(db, 'users'),
        where('email', '==', searchQuery)
      );
      
      // Then try display name prefix match
      const nameQuery = query(
        collection(db, 'users'),
        where('displayName', '>=', searchQuery),
        where('displayName', '<=', searchQuery + '\uf8ff')
      );

      const [exactSnapshot, nameSnapshot] = await Promise.all([
        getDocs(exactQuery),
        getDocs(nameQuery)
      ]);

      const usersMap = new Map<string, User>();
      
      // Add exact email matches
      exactSnapshot.docs.forEach(doc => {
        if (doc.id !== auth.currentUser?.uid) {
          usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
        }
      });
      
      // Add display name matches (will not duplicate if same user)
      nameSnapshot.docs.forEach(doc => {
        if (doc.id !== auth.currentUser?.uid) {
          usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
        }
      });

      // Filter out users who are already friends or have pending requests
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Get current user's friends
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserFriends = currentUserDoc.data()?.friends || [];
        
        // Get pending friend requests to avoid duplicates
        const pendingRequestsSnapshot = await getDocs(
          query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', currentUser.uid),
            where('status', '==', 'pending')
          )
        );
        
        const pendingRequestUserIds = pendingRequestsSnapshot.docs.map(doc => doc.data().toUserId);
        
        // Filter out friends and pending requests
        const filteredUsers = Array.from(usersMap.values()).filter(user => 
          !currentUserFriends.includes(user.id) && 
          !pendingRequestUserIds.includes(user.id)
        );
        
        setSearchResults(filteredUsers);
      } else {
        setSearchResults(Array.from(usersMap.values()));
      }
    } catch (error: any) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    console.log('Attempting to send friend request to:', userId);
    try {
      await sendFriendRequest(userId);
      console.log('Friend request sent successfully');
      Alert.alert('Success', 'Friend request sent!');
      setSearchResults(prev => 
        prev.filter(user => user.id !== userId)
      );
    } catch (error: any) {
      console.error('Friend request error:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    console.log('handleAcceptRequest called with requestId:', requestId);
    try {
      console.log('Calling acceptFriendRequest...');
      await acceptFriendRequest(requestId);
      console.log('Friend request accepted, reloading friends...');
      Alert.alert('Success', 'Friend request accepted!');
      await loadFriends(); // Reload friends list
      console.log('Friends list reloaded');
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      Alert.alert('Success', 'Friend request rejected');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject request');
    }
  };

  const handleFollowUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      await followUser(userId);
      // Refresh current user data
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You are now following this user!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to follow user');
    }
  };

  const handleUnfollowUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      await unfollowUser(userId);
      // Refresh current user data
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You have unfollowed this user');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    }
  };

  const isFollowing = (userId: string): boolean => {
    return currentUserData?.following?.includes(userId) || false;
  };

  const isFriend = (userId: string): boolean => {
    return currentUserData?.friends?.includes(userId) || false;
  };

  const handleStartChat = (friend: User) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;

    // Create conversation ID
    const participantIds = [currentUserId, friend.id].sort();
    const conversationId = participantIds.join('_');
    
    onStartChat(friend.id, conversationId);
  };

  const handleNavbarTabPress = (tab: string) => {
    setNavbarTab(tab);
    if (tab === 'explore') {
      // Already on friends/messages screen
    } else if (tab === 'home') {
      onNavigateToHome();
    } else if (tab === 'create') {
      onNavigateToCreatePost();
    } else if (tab === 'achievements') {
      onNavigateToAchievements();
    } else if (tab === 'profile') {
      onNavigateToProfile();
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  const handleStartBotChat = async () => {
    try {
      const conversationId = await startBotConversation(currentUserData);
      onStartChat(BOT_USER_ID, conversationId);
    } catch (error) {
      console.error('Error starting bot conversation:', error);
      Alert.alert('Error', 'Failed to start bot conversation');
    }
  };

  const renderFriend = ({ item }: { item: FriendWithConversation }) => {
    const userIsFollowed = isFollowing(item.id);
    
    return (
      <View style={styles.friendItem}>
        <TouchableOpacity 
          style={styles.friendInfo}
          onPress={() => onNavigateToProfile(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <View style={styles.friendNameRow}>
              <Text style={styles.friendName}>{item.displayName}</Text>
              <Text style={styles.friendStatus}>
                {item.isOnline ? '🟢 Online' : '⚪ Offline'}
              </Text>
            </View>
            {item.lastMessage && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={[styles.followButtonSmall, userIsFollowed && styles.followingButtonSmall]}
            onPress={() => userIsFollowed ? handleUnfollowUser(item.id) : handleFollowUser(item.id)}
          >
            <Text style={[styles.followButtonTextSmall, userIsFollowed && styles.followingButtonTextSmall]}>
              {userIsFollowed ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleStartChat(item)}
          >
            <Text style={styles.chatButtonText}>💬</Text>
          </TouchableOpacity>
          {(item.unreadCount ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestItem}>
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <Text style={styles.friendAvatarText}>?</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>Friend Request</Text>
          <Text style={styles.friendStatus}>
            {item.createdAt.toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.requestButtons}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Text style={styles.rejectButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: User }) => {
    const userIsFollowed = isFollowing(item.id);
    
    return (
      <View style={styles.friendItem}>
        <TouchableOpacity 
          style={styles.friendInfo}
          onPress={() => onNavigateToProfile(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.displayName}</Text>
            <Text style={styles.friendStatus}>{item.email}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={[styles.followButtonSmall, userIsFollowed && styles.followingButtonSmall]}
            onPress={() => userIsFollowed ? handleUnfollowUser(item.id) : handleFollowUser(item.id)}
          >
            <Text style={[styles.followButtonTextSmall, userIsFollowed && styles.followingButtonTextSmall]}>
              {userIsFollowed ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleSendFriendRequest(item.id)}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const tabs = [
    { id: 'friends' as TabType, label: 'Friends & Messages', count: friendsWithConversations.length },
    { id: 'requests' as TabType, label: 'Requests', count: friendRequests.length },
    { id: 'search' as TabType, label: 'Search', count: 0 },
  ];

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      {Platform.OS === 'android' && (
        <StatusBar backgroundColor="#667eea" barStyle="light-content" />
      )}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friends & Messages</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
                {tab.count > 0 ? ` (${tab.count})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'search' && (
            <>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search users by name..."
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={searchQuery}
                  onChangeText={handleSearchInputChange}
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  disabled={loading}
                >
                  <Text style={styles.searchButtonText}>
                    {loading ? '⏳' : '🔍'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Search Suggestions */}
              {searchSuggestions.length > 0 && searchQuery.length >= 2 ? (
                <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled>
                  {searchSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion.id}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setSearchQuery(suggestion.displayName);
                        setSearchSuggestions([]);
                        handleSearch();
                      }}
                    >
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>
                          {suggestion.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.suggestionText}>{suggestion.displayName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </>
          )}

          <FlatList
            data={
              activeTab === 'friends' ? friendsWithConversations :
              activeTab === 'requests' ? friendRequests :
              searchResults
            }
            keyExtractor={(item: any) => item.id}
            ListHeaderComponent={
              activeTab === 'friends' ? (
                <TouchableOpacity
                  style={styles.botChatButton}
                  onPress={handleStartBotChat}
                >
                  <View style={styles.botIconContainer}>
                    <Text style={styles.botIcon}>🤖</Text>
                  </View>
                  <View style={styles.botChatContent}>
                    <Text style={styles.botChatTitle}>Chat with GSO Assistant</Text>
                    <Text style={styles.botChatSubtitle}>Get help and tips for using the app</Text>
                  </View>
                </TouchableOpacity>
              ) : null
            }
            renderItem={(props: any) => {
              if (activeTab === 'friends') {
                return renderFriend(props);
              } else if (activeTab === 'requests') {
                return renderFriendRequest(props);
              } else {
                return renderSearchResult(props);
              }
            }}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='on-drag'
          />
        </View>
        
        {/* Navbar */}
        <Navbar activeTab={navbarTab} onTabPress={handleNavbarTabPress} user={currentUserData} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 70 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  tabs: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  tab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 0,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  activeTabText: {
    color: '#667eea',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    marginRight: 10,
    borderWidth: 0,
  },
  searchButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    marginBottom: 10,
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 80,
  },
  botChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.4)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  botIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  botIcon: {
    fontSize: 28,
  },
  botChatContent: {
    flex: 1,
  },
  botChatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  botChatSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 0,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 0,
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  friendAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendDetails: {
    flex: 1,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  friendStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
    fontStyle: 'italic',
  },
  chatButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    fontSize: 18,
  },
  addButton: {
    backgroundColor: 'rgba(118, 75, 162, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  requestButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  acceptButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: '#f44336',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#ff3333',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButtonSmall: {
    backgroundColor: 'rgba(102, 126, 234, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButtonSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  followButtonTextSmall: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  followingButtonTextSmall: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default FriendsScreen;