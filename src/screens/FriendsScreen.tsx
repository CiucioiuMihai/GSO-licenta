import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
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
} from '@/services/friendsService';
import { followUser, unfollowUser, getUserDataWithCounts } from '@/services/postsService';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

interface FriendsScreenProps {
  onStartChat: (userId: string, conversationId: string) => void;
  onBack: () => void;
}

type TabType = 'friends' | 'requests' | 'search' | 'conversations';

const FriendsScreen: React.FC<FriendsScreenProps> = ({ onStartChat, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const currentUser = auth.currentUser;

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

  const handleOpenConversation = async (conversation: Conversation) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;

    const otherUserId = conversation.participants.find(id => id !== currentUserId);
    if (otherUserId) {
      onStartChat(otherUserId, conversation.id);
    }
  };

  const getOtherUserName = async (conversation: Conversation): Promise<string> => {
    const currentUserId = auth.currentUser?.uid;
    const otherUserId = conversation.participants.find(id => id !== currentUserId);
    
    if (!otherUserId) return 'Unknown User';

    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('id', '==', otherUserId)));
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data() as User;
        return userData.displayName;
      }
    } catch (error) {
      console.error('Error getting user name:', error);
    }
    
    return 'Unknown User';
  };

  const renderFriend = ({ item }: { item: User }) => {
    const userIsFollowed = isFollowing(item.id);
    
    return (
      <View style={styles.friendItem}>
        <View style={styles.friendInfo}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.displayName}</Text>
            <Text style={styles.friendStatus}>
              {item.isOnline ? '🟢 Online' : '⚪ Offline'}
            </Text>
          </View>
        </View>
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
        <View style={styles.friendInfo}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.displayName}</Text>
            <Text style={styles.friendStatus}>{item.email}</Text>
          </View>
        </View>
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

  const renderConversation = ({ item }: { item: Conversation }) => {
    const currentUserId = auth.currentUser?.uid;
    const unreadCount = currentUserId ? item[`unreadCount_${currentUserId}`] : 0;
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleOpenConversation(item)}
      >
        <View style={styles.friendInfo}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>💬</Text>
          </View>
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>Chat</Text>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const tabs = [
    { id: 'conversations' as TabType, label: 'Chats', count: conversations.length },
    { id: 'friends' as TabType, label: 'Friends', count: friends.length },
    { id: 'requests' as TabType, label: 'Requests', count: friendRequests.length },
    { id: 'search' as TabType, label: 'Search', count: 0 },
  ];

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
                {tab.count > 0 && ` (${tab.count})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'search' && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
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
          )}

          <FlatList
            data={
              activeTab === 'friends' ? friends :
              activeTab === 'requests' ? friendRequests :
              activeTab === 'search' ? searchResults :
              conversations
            }
            keyExtractor={(item: any) => item.id}
            renderItem={(props: any) => {
              if (activeTab === 'friends') {
                return renderFriend(props);
              } else if (activeTab === 'requests') {
                return renderFriendRequest(props);
              } else if (activeTab === 'search') {
                return renderSearchResult(props);
              } else {
                return renderConversation(props);
              }
            }}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
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
  },
  tab: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  friendStatus: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
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