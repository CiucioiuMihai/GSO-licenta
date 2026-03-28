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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
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
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const flatListRef = useRef<FlatList>(null);
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

  // Chat message listener
  useEffect(() => {
    if (!selectedConversation) return;

    setActiveConversationForNotifications(selectedConversation);

    const unsubscribe = getConversationMessages(selectedConversation, (newMessages) => {
      setMessages(newMessages);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    markMessagesAsRead(selectedConversation).catch(console.error);
    return () => {
      setActiveConversationForNotifications(null);
      unsubscribe();
    };
  }, [selectedConversation]);

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

    setLoading(true);
    try {
      // Check if messaging the bot
      if (selectedUserId === BOT_USER_ID) {
        // Send message and get bot response
        await sendMessageWithBotResponse(selectedUserId, newMessage.trim(), currentUserData);
      } else {
        // Use offline service for regular users
        await offlineService.sendDirectMessage(
          currentUser?.uid || '',
          selectedUserId,
          newMessage.trim()
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
    try {
      await sendFriendRequest(userId);
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
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

  const renderLeftSidebar = () => (
    <View style={styles.sidebar}>
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
          contentContainerStyle={styles.sidebarListContent}
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
              
              return (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    selectedConversation === item.id && styles.selectedListItem
                  ]}
                  onPress={() => otherUserId && handleStartChat(otherUserId, item.id)}
                >
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
                    style={styles.addFriendButton}
                    onPress={() => handleSendFriendRequest(item.id)}
                  >
                    <Text style={styles.addFriendText}>Add</Text>
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
        
        {/* Navbar - Only show on mobile */}
        {!isWeb && !isTablet && (
          <Navbar
            activeTab={navbarTab}
            onTabPress={handleNavbarTabPress}
            user={currentUserData}
            mobileBottomOffset={0}
            mobileBackgroundHeight={50}
          />
        )}
      </LinearGradient>
    </View>
  );

  const renderChatArea = () => {
    if (!selectedConversation || !otherUser) {
      return (
        <View style={styles.chatArea}>
          <LinearGradient colors={['#f8f9fa', '#e9ecef']} style={styles.emptyChatGradient}>
            <View style={styles.emptyChatContainer}>
              <Text style={styles.emptyChatTitle}>💬</Text>
              <Text style={styles.emptyChatText}>Select a conversation to start messaging</Text>
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.chatArea}>
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
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isOwnMessage = item.fromUserId === currentUser?.uid;
              const messageTime = item.createdAt instanceof Date 
                ? item.createdAt 
                : new Date(item.createdAt || Date.now());
              
              return (
                <View style={[
                  styles.messageContainer,
                  isOwnMessage ? styles.ownMessage : styles.otherMessage
                ]}>
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
                  </View>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
          />

          {/* Message Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                placeholderTextColor="rgba(0,0,0,0.5)"
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
          </KeyboardAvoidingView>
        </LinearGradient>
      </View>
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
    <SafeAreaView style={styles.container}>
      {!selectedConversation ? (
        <>{renderLeftSidebar()}</>
      ) : (
        <>{renderChatArea()}</>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  webLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    flex: 1,
    width: isWeb ? Math.max(screenWidth * 0.33, 320) : isTablet ? 300 : '100%',
    minWidth: isWeb || isTablet ? 280 : 0,
    maxWidth: isWeb || isTablet ? 400 : '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  sidebarGradient: {
    flex: 1,
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
  },
  chatGradient: {
    flex: 1,
  },
  emptyChatGradient: {
    flex: 1,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChatTitle: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyChatText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chatBackButton: {
    marginRight: 12,
    padding: 4,
  },
  chatHeaderContent: {
    flex: 1,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
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
});

export default CombinedMessagesScreen;