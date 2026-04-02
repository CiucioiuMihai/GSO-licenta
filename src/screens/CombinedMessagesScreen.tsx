import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  BackHandler,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, FriendRequest, Conversation, DirectMessage } from '@/types';
import { 
  getUserFriends, 
  getPendingFriendRequests, 
  acceptFriendRequest, 
  rejectFriendRequest,
  sendFriendRequest,
  removeFriend,
  getUserConversations,
  sendDirectMessage, 
  getConversationMessages, 
  markMessagesAsRead,
  sendMessageWithBotResponse
} from '@/services/friendsService';
import { followUser, unfollowUser, getUserDataWithCounts } from '@/services/postsService';
import { offlineService } from '@/services/offlineService';
import { BOT_USER_ID, BOT_USER, isBotMessage } from '@/services/chatbotService';
import { setActiveConversationForNotifications } from '@/services/notificationService';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit, startAfter, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import Navbar from '@/components/Navbar';

interface CombinedMessagesScreenProps {
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

type TabType = 'conversations' | 'friends' | 'requests' | 'search';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth > 768;
const MESSAGES_BATCH_SIZE = 20;

const CombinedMessagesScreen: React.FC<CombinedMessagesScreenProps> = ({ 
  onBack,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToLeaderboard,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const [navbarTab, setNavbarTab] = useState('explore');
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendRequestUsers, setFriendRequestUsers] = useState<Record<string, User>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  
  // Chat state
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [lastVisibleMessageDoc, setLastVisibleMessageDoc] = useState<any>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;
  const mobileContentBottomSpacing = !isWeb && !isTablet ? 100 : 0;

  const scrollMessagesToBottom = (animated: boolean = true) => {
    // Multiple attempts handle async layout/measurement timing on mobile.
    const run = () => flatListRef.current?.scrollToEnd({ animated });
    run();
    requestAnimationFrame(run);
    setTimeout(run, 60);
  };

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
    const unsubscribeConversations = getUserConversations(async (convs) => {
      // Fetch names for each conversation
      const conversationsWithNames = await Promise.all(
        convs.map(async (conv) => {
          const otherUserName = await getOtherUserName(conv);
          return { ...conv, otherUserName };
        })
      );
      setConversations(conversationsWithNames);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeConversations();
    };
  }, []);

  useEffect(() => {
    const loadFriendRequestUsers = async () => {
      const uniqueUserIds = [...new Set(friendRequests.map(req => req.fromUserId))];
      if (uniqueUserIds.length === 0) {
        setFriendRequestUsers({});
        return;
      }

      try {
        const userDocs = await Promise.all(uniqueUserIds.map((userId) => getDoc(doc(db, 'users', userId))));
        const userMap: Record<string, User> = {};
        userDocs.forEach((docSnap) => {
          if (docSnap.exists()) {
            userMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as User;
          }
        });
        setFriendRequestUsers(userMap);
      } catch (error) {
        console.error('Error loading friend request users:', error);
      }
    };

    loadFriendRequestUsers();
  }, [friendRequests]);

  // Chat message listener (latest batch + realtime updates)
  useEffect(() => {
    if (!selectedConversation) return;

    setMessages([]);
    setLastVisibleMessageDoc(null);
    setHasMoreMessages(true);
    setIsLoadingMoreMessages(false);

    setActiveConversationForNotifications(selectedConversation);

    const messagesQuery = query(
      collection(db, 'directMessages'),
      where('conversationId', '==', selectedConversation),
      orderBy('createdAt', 'desc'),
      limit(MESSAGES_BATCH_SIZE)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newestBatch = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
        createdAt: messageDoc.data().createdAt?.toDate() || new Date(),
      })) as DirectMessage[];

      const newestIds = new Set(newestBatch.map((msg) => msg.id));

      setMessages((prevMessages) => {
        const olderLoadedMessages = prevMessages.filter((msg) => !newestIds.has(msg.id));
        const merged = [...olderLoadedMessages, ...newestBatch];
        merged.sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
          return aTime - bTime;
        });
        return merged;
      });

      if (!lastVisibleMessageDoc) {
        setLastVisibleMessageDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreMessages(snapshot.docs.length === MESSAGES_BATCH_SIZE);
      }

      requestAnimationFrame(() => scrollMessagesToBottom(false));
    });

    markMessagesAsRead(selectedConversation).catch(console.error);
    return () => {
      setActiveConversationForNotifications(null);
      unsubscribe();
    };
  }, [selectedConversation]);

  const loadMoreMessages = async () => {
    if (!selectedConversation || isLoadingMoreMessages || !hasMoreMessages || !lastVisibleMessageDoc) {
      return;
    }

    setIsLoadingMoreMessages(true);
    try {
      const olderMessagesQuery = query(
        collection(db, 'directMessages'),
        where('conversationId', '==', selectedConversation),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleMessageDoc),
        limit(MESSAGES_BATCH_SIZE)
      );

      const snapshot = await getDocs(olderMessagesQuery);
      const olderMessages = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
        createdAt: messageDoc.data().createdAt?.toDate() || new Date(),
      })) as DirectMessage[];

      if (olderMessages.length > 0) {
        setMessages((prevMessages) => {
          const existingIds = new Set(prevMessages.map((msg) => msg.id));
          const uniqueOlder = olderMessages.filter((msg) => !existingIds.has(msg.id));
          const merged = [...prevMessages, ...uniqueOlder];
          merged.sort((a, b) => {
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
            return aTime - bTime;
          });
          return merged;
        });
      }

      setLastVisibleMessageDoc(snapshot.docs[snapshot.docs.length - 1] || lastVisibleMessageDoc);
      setHasMoreMessages(snapshot.docs.length === MESSAGES_BATCH_SIZE);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const handleMessagesScroll = (event: any) => {
    if (event?.nativeEvent?.contentOffset?.y <= 160) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || isWeb || isTablet) {
      return;
    }

    const onHardwareBackPress = () => {
      if (selectedConversation) {
        setSelectedConversation(null);
        setSelectedUserId(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => subscription.remove();
  }, [selectedConversation]);

  const loadFriends = async () => {
    try {
      const userFriends = await getUserFriends();
      setFriends(userFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const getOtherUserId = (conversation: Conversation): string | null => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return null;
    return conversation.participants.find(id => id !== currentUserId) || null;
  };

  const getOtherUserName = async (conversation: Conversation): Promise<string> => {
    const otherUserId = getOtherUserId(conversation);
    if (!otherUserId) return 'Unknown User';

    // Check if it's the bot
    if (otherUserId === BOT_USER_ID) {
      return BOT_USER.displayName; // 'GSO Assistant'
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', otherUserId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        return userData.displayName || 'Unknown User';
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
    return 'Unknown User';
  };

  const handleStartChat = async (userId: string, conversationId: string) => {
    setSelectedConversation(conversationId);
    setSelectedUserId(userId);
    
    // Get other user's info
    try {
      // Check if it's the bot
      if (userId === BOT_USER_ID) {
        setOtherUser(BOT_USER);
      } else {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setOtherUser({ id: userDoc.id, ...userDoc.data() } as User);
        }
      }
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || loading || !selectedUserId) return;

    const text = newMessage.trim();
    setLoading(true);
    try {
      // Check if messaging the bot
      if (selectedUserId === BOT_USER_ID) {
        // Send message and get bot response
        await sendMessageWithBotResponse(selectedUserId, text, currentUserData);
      } else {
        const isOfflineSend = !offlineService.isConnected();

        if (isOfflineSend && currentUser?.uid) {
          const optimisticMessage: DirectMessage = {
            id: `offline_${Date.now()}`,
            conversationId: selectedConversation || `temp_${selectedUserId}`,
            fromUserId: currentUser.uid,
            toUserId: selectedUserId,
            message: text,
            read: false,
            createdAt: new Date(),
          };
          setMessages((prev) => [...prev, optimisticMessage]);
          setTimeout(() => scrollMessagesToBottom(true), 50);
        }

        // Use offline service for regular users
        await offlineService.sendDirectMessage(
          currentUser?.uid || '',
          selectedUserId,
          text
        );
      }
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (selectedUserId === BOT_USER_ID) {
        Alert.alert('Error', 'Failed to send message to bot. Please try again.');
      } else {
        Alert.alert(
          'Message Queued', 
          'Your message will be sent when you reconnect to the internet.',
          [{ text: 'OK' }]
        );
      }
      setNewMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    try {
      const searchLower = searchQuery.toLowerCase();
      
      const exactQuery = query(
        collection(db, 'users'),
        where('email', '==', searchQuery)
      );
      
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
      
      exactSnapshot.docs.forEach(doc => {
        if (doc.id !== auth.currentUser?.uid) {
          usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
        }
      });
      
      nameSnapshot.docs.forEach(doc => {
        if (doc.id !== auth.currentUser?.uid) {
          usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
        }
      });

      setSearchResults(Array.from(usersMap.values()));
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      await loadFriends();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    if (friends.some(friend => friend.id === userId)) {
      Alert.alert('Already friends', 'You are already friends with this user.');
      return;
    }

    try {
      await sendFriendRequest(userId);
      Alert.alert('Success', 'Friend request sent!');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error?.message || 'Failed to send friend request');
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
      const message = error?.message || 'Failed to follow user';
      Alert.alert('Error', message.includes('permissions') ? `${message}\nIf this persists, redeploy Firestore rules.` : message);
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

  const handleUnfriend = async (friendId: string) => {
    const confirmUnfriend = async () => {
      try {
        await removeFriend(friendId);
        await loadFriends();
        if (currentUser) {
          const userData = await getUserDataWithCounts(currentUser.uid);
          setCurrentUserData(userData);
        }
        Alert.alert('Success', 'Friend removed');
      } catch (error: any) {
        Alert.alert('Error', error?.message || 'Failed to remove friend');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Remove this friend?')) {
        await confirmUnfriend();
      }
      return;
    }

    Alert.alert('Remove friend', 'Do you want to remove this friend?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void confirmUnfriend(); } },
    ]);
  };

  const isFollowing = (userId: string): boolean => {
    return currentUserData?.following?.includes(userId) || false;
  };

  const isUserOnlineNow = (user?: Partial<User> | null): boolean => {
    if (!user?.isOnline) return false;

    const rawLastActive = (user as any).lastActive;
    let lastActive: Date | null = null;

    if (rawLastActive instanceof Date) {
      lastActive = rawLastActive;
    } else if (rawLastActive?.toDate) {
      lastActive = rawLastActive.toDate();
    } else if (rawLastActive) {
      lastActive = new Date(rawLastActive);
    }

    if (!lastActive) return false;
    return Date.now() - lastActive.getTime() <= 2 * 60 * 1000;
  };

  const handleStartBotChat = async () => {
    try {
      const { startBotConversation } = await import('@/services/friendsService');
      const conversationId = await startBotConversation(currentUserData);
      handleStartChat(BOT_USER_ID, conversationId);
    } catch (error) {
      console.error('Error starting bot conversation:', error);
      Alert.alert('Error', 'Failed to start bot conversation');
    }
  };

  const handleNavbarTabPress = (tab: string) => {
    setNavbarTab(tab);
    if (tab === 'explore') {
      // Already on messages screen
    } else if (tab === 'posts') {
      onNavigateToPostsFeed();
    } else if (tab === 'home') {
      onNavigateToHome();
    } else if (tab === 'create') {
      onNavigateToCreatePost();
    } else if (tab === 'profile') {
      onNavigateToProfile();
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  const renderLeftSidebar = () => (
    <View style={[styles.sidebar, (isWeb || isTablet) && styles.sidebarWeb]}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.sidebarGradient}>
        {/* Header */}
        <View style={styles.sidebarHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.sidebarTitle}>Messages</Text>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
          {['conversations', 'friends', 'requests', 'search'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                isWeb && styles.tabButtonWeb,
                activeTab === tab && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab(tab as TabType)}
            >
              <Text numberOfLines={1} style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'conversations' ? 'Chats' : 
                 tab === 'friends' ? 'Friends' :
                 tab === 'requests' ? `Requests${friendRequests.length > 0 ? ` (${friendRequests.length})` : ''}` :
                 'Search'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Input */}
        {activeTab === 'search' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content List */}
        <FlatList
          style={styles.sidebarList}
          contentContainerStyle={[
            styles.sidebarListContent,
            !isWeb && !isTablet && styles.sidebarListContentMobile,
            !isWeb && !isTablet && { paddingBottom: 16 + mobileContentBottomSpacing },
          ]}
          showsVerticalScrollIndicator={false}
          data={
            activeTab === 'conversations' ? conversations :
            activeTab === 'friends' ? friends :
            activeTab === 'requests' ? friendRequests :
            searchResults
          }
          keyExtractor={(item: any) => item.id}
          ListHeaderComponent={
            activeTab === 'conversations' ? (
              <TouchableOpacity
                style={[styles.botChatButton, selectedUserId === BOT_USER_ID && styles.selectedListItem]}
                onPress={handleStartBotChat}
              >
                <View style={styles.botIconContainer}>
                  <Text style={styles.botIcon}>🤖</Text>
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.botChatTitle}>Chat with GSO Assistant</Text>
                  <Text style={styles.botChatSubtitle}>Get help and tips for using the app</Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            if (activeTab === 'conversations') {
              const otherUserId = getOtherUserId(item);
              const otherUserName = item.otherUserName || 'Unknown User';
              const otherUser = friends.find(f => f.id === otherUserId);
              
              return (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    selectedConversation === item.id && styles.selectedListItem
                  ]}
                  onPress={() => otherUserId && handleStartChat(otherUserId, item.id)}
                >
                  {otherUser?.profilePicture ? (
                    <Image
                      source={{ uri: otherUser.profilePicture }}
                      style={styles.listItemAvatar}
                    />
                  ) : (
                    <View style={styles.listItemAvatarPlaceholder}>
                      <Text style={styles.listItemAvatarText}>
                        {otherUserName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.listItemContent}>
                    <Text style={styles.listItemTitle}>{otherUserName}</Text>
                    <Text style={styles.listItemSubtitle} numberOfLines={1}>
                      {item.lastMessage || 'No messages yet'}
                    </Text>
                  </View>
                  {item[`unreadCount_${currentUser?.uid}`] > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item[`unreadCount_${currentUser?.uid}`]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }

            if (activeTab === 'friends') {
              const userIsFollowed = isFollowing(item.id);
              
              return (
                <View style={styles.friendItem}>
                  <TouchableOpacity
                    style={styles.friendItemTouchable}
                    onPress={() => onNavigateToProfile(item.id)}
                  >
                    {item.profilePicture ? (
                      <Image
                        source={{ uri: item.profilePicture }}
                        style={styles.listItemAvatar}
                      />
                    ) : (
                      <View style={styles.listItemAvatarPlaceholder}>
                        <Text style={styles.listItemAvatarText}>
                          {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>{item.displayName}</Text>
                      <Text style={styles.listItemSubtitle}>
                        {isUserOnlineNow(item) ? '🟢 Online' : '⚫ Offline'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.unfriendButtonSmall}
                      onPress={() => handleUnfriend(item.id)}
                    >
                      <Text style={styles.unfriendButtonTextSmall}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.followButtonSmall, userIsFollowed && styles.followingButtonSmall]}
                      onPress={() => userIsFollowed ? handleUnfollowUser(item.id) : handleFollowUser(item.id)}
                    >
                      <Text style={[styles.followButtonTextSmall, userIsFollowed && styles.followingButtonTextSmall]}>
                        {userIsFollowed ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chatButtonSmall}
                      onPress={() => {
                        const existingConvo = conversations.find(c => {
                          const otherUserId = getOtherUserId(c);
                          return otherUserId === item.id;
                        });
                        if (existingConvo) {
                          handleStartChat(item.id, existingConvo.id);
                        } else {
                          handleStartChat(item.id, `temp_${item.id}`);
                        }
                      }}
                    >
                      <Text style={styles.chatButtonSmallText}>💬</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            if (activeTab === 'requests') {
              const sender = friendRequestUsers[item.fromUserId];
              const senderName = sender?.displayName || 'Friend Request';
              return (
                <View style={styles.requestItem}>
                  <View style={styles.listItemContent}>
                    <Text style={styles.listItemTitle}>{senderName}</Text>
                    <Text style={styles.listItemSubtitle}>Sent you a friend request</Text>
                  </View>
                  <View style={styles.requestButtons}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptRequest(item.id)}
                    >
                      <Text style={styles.buttonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => rejectFriendRequest(item.id)}
                    >
                      <Text style={styles.buttonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            // Search results
            const userIsFollowed = isFollowing(item.id);
            const userIsFriend = friends.some(friend => friend.id === item.id);
            
            return (
              <View style={styles.searchResultItem}>
                <TouchableOpacity
                  style={styles.listItemContent}
                  onPress={() => onNavigateToProfile(item.id)}
                >
                  <Text style={styles.listItemTitle}>{item.displayName}</Text>
                  <Text style={styles.listItemSubtitle}>{item.email}</Text>
                </TouchableOpacity>
                <View style={styles.searchResultButtons}>
                  <TouchableOpacity
                    style={[styles.followButtonSmall, userIsFollowed && styles.followingButtonSmall]}
                    onPress={() => userIsFollowed ? handleUnfollowUser(item.id) : handleFollowUser(item.id)}
                  >
                    <Text style={[styles.followButtonTextSmall, userIsFollowed && styles.followingButtonTextSmall]}>
                      {userIsFollowed ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFriendButton, userIsFriend && styles.addFriendButtonDisabled]}
                    onPress={() => handleSendFriendRequest(item.id)}
                    disabled={userIsFriend}
                  >
                    <Text style={[styles.addFriendText, userIsFriend && styles.addFriendTextDisabled]}>
                      {userIsFriend ? 'Friends' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'conversations' ? 'No conversations yet' :
                 activeTab === 'friends' ? 'No friends yet' :
                 activeTab === 'requests' ? 'No friend requests' :
                 'Search for users'}
              </Text>
            </View>
          }
        />
        
      </LinearGradient>
    </View>
  );

  const renderChatArea = () => {
    if (!selectedConversation || !otherUser) {
      return (
        <View style={styles.chatArea}>
          <LinearGradient colors={['#f8f9fa', '#e9ecef']} style={styles.emptyChatGradient}>
            <View style={styles.emptyChatContainer}>
              <View style={styles.emptyChatCard}>
                <Text style={styles.emptyChatTitle}>💬</Text>
                <Text style={styles.emptyChatText}>Select a conversation to start messaging</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        style={styles.chatArea}
        enabled={!isWeb && !isTablet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.chatGradient}>
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            {!isWeb && !isTablet && (
              <TouchableOpacity 
                onPress={() => {
                  setSelectedConversation(null);
                  setSelectedUserId(null);
                }} 
                style={styles.chatBackButton}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              disabled={selectedUserId === BOT_USER_ID}
              onPress={() => selectedUserId && selectedUserId !== BOT_USER_ID && onNavigateToProfile(selectedUserId)}
              style={styles.chatHeaderAvatar}
            >
              {otherUser?.profilePicture ? (
                <Image
                  source={{ uri: otherUser.profilePicture }}
                  style={styles.chatHeaderAvatarImage}
                />
              ) : (
                <View style={styles.chatHeaderAvatarPlaceholder}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {(otherUser?.displayName || 'User').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.chatHeaderContent}>
              <Text style={styles.chatHeaderTitle}>{otherUser.displayName}</Text>
              <Text style={styles.chatHeaderSubtitle}>
                {isUserOnlineNow(otherUser) ? '🟢 Online' : '⚫ Offline'}
              </Text>
            </View>
          </View>

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesListContent}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => scrollMessagesToBottom(false)}
            onLayout={() => scrollMessagesToBottom(false)}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const isOwnMessage = item.fromUserId === currentUser?.uid;
              const isPendingMessage = item.id.startsWith('offline_');
              const messageTime = item.createdAt instanceof Date 
                ? item.createdAt 
                : new Date(item.createdAt || Date.now());
              
              return (
                <View style={[
                  styles.messageContainer,
                  isOwnMessage ? styles.ownMessage : styles.otherMessage
                ]}>
                  {!isOwnMessage && (
                    <TouchableOpacity
                      disabled={selectedUserId === BOT_USER_ID}
                      onPress={() => selectedUserId && selectedUserId !== BOT_USER_ID && onNavigateToProfile(selectedUserId)}
                    >
                      {otherUser?.profilePicture ? (
                        <Image
                          source={{ uri: otherUser.profilePicture }}
                          style={styles.messageAvatar}
                        />
                      ) : (
                        <View style={styles.messageAvatarPlaceholder}>
                          <Text style={styles.messageAvatarText}>
                            {(otherUser?.displayName || 'User').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownBubble : styles.otherBubble
                  ]}>
                    <Text style={[
                      styles.messageText,
                      isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                    ]}>
                      {item.message || 'No message content'}
                    </Text>
                    <Text style={[
                      styles.messageTime,
                      isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
                    ]}>
                      {messageTime.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                    {isPendingMessage && (
                      <Text style={[styles.pendingSyncText, isOwnMessage ? styles.ownPendingSyncText : styles.otherPendingSyncText]}>
                        Pending sync
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isLoadingMoreMessages ? (
                <View style={styles.loadingMoreMessagesContainer}>
                  <Text style={styles.loadingMoreMessagesText}>Loading older messages...</Text>
                </View>
              ) : !hasMoreMessages && messages.length > 0 ? (
                <View style={styles.loadingMoreMessagesContainer}>
                  <Text style={styles.loadingMoreMessagesText}>Beginning of conversation</Text>
                </View>
              ) : null
            }
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                placeholderTextColor="rgba(0,0,0,0.5)"
                cursorColor="#2ecc71"
                selectionColor="#2ecc71"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || loading}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  };

  // For web/tablet: side-by-side layout
  if (isWeb || isTablet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webLayout}>
          {renderLeftSidebar()}
          {renderChatArea()}
        </View>
      </SafeAreaView>
    );
  }

  // For mobile: full-screen list or chat based on selection
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {selectedConversation ? (
        renderChatArea()
      ) : (
        <>
          {renderLeftSidebar()}
          {!isWeb && !isTablet && (
            <Navbar
              activeTab={navbarTab}
              onTabPress={handleNavbarTabPress}
              user={currentUserData}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#764ba2',
    overflow: 'hidden',
  },
  webLayout: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebar: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebarWeb: {
    width: '33%',
    flexBasis: '33%',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: isWeb || isTablet ? 300 : 0,
    maxWidth: isWeb || isTablet ? 420 : '100%',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  sidebarGradient: {
    flex: 1,
    minHeight: 0,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sidebarTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButton: {
    minWidth: 82,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabButtonWeb: {
    minWidth: 74,
    paddingHorizontal: 8,
  },
  activeTabButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tabText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#667eea',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: 'white',
    marginBottom: 8,
  },
  searchButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  sidebarList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  sidebarListContent: {
    paddingBottom: 80,
  },
  sidebarListContentMobile: {
    paddingBottom: 140,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 2,
    marginHorizontal: 8,
    borderRadius: 12,
    padding: 12,
  },
  selectedListItem: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  botChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  botIconContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botIcon: {
    fontSize: 24,
  },
  botChatTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botChatSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  listItemAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  listItemAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102, 126, 234, 0.6)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listItemSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  requestItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 2,
    marginHorizontal: 8,
    borderRadius: 12,
    padding: 12,
  },
  requestButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  addFriendText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  addFriendTextDisabled: {
    color: 'rgba(255,255,255,0.95)',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
  chatArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatGradient: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  emptyChatGradient: {
    flex: 1,
    padding: 28,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChatCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  emptyChatTitle: {
    fontSize: 58,
    marginBottom: 14,
  },
  emptyChatText: {
    fontSize: 18,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 340,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  chatBackButton: {
    padding: 4,
  },
  chatHeaderAvatar: {
    marginRight: 4,
  },
  chatHeaderAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatHeaderAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  chatHeaderContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeaderTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatHeaderSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'web' ? 12 : 80,
  },
  messagesListContent: {
    paddingBottom: 8,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 2,
  },
  messageAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 8,
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  otherBubble: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#333',
  },
  otherMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(0,0,0,0.6)',
  },
  otherMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  pendingSyncText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  ownPendingSyncText: {
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'right',
  },
  otherPendingSyncText: {
    color: 'rgba(255,255,255,0.75)',
  },
  loadingMoreMessagesContainer: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  loadingMoreMessagesText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'white',
    color: '#1f1f1f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  gradient: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mobileNote: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  friendItemTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  followButtonSmall: {
    backgroundColor: 'rgba(102, 126, 234, 0.8)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  followingButtonSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  unfriendButtonSmall: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unfriendButtonTextSmall: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatButtonSmall: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonSmallText: {
    fontSize: 16,
  },
  followButtonTextSmall: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  followingButtonTextSmall: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  searchResultButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addFriendButton: {
    backgroundColor: 'rgba(118, 75, 162, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addFriendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});

export default CombinedMessagesScreen;