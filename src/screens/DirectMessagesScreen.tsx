import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DirectMessage, User } from '@/types';
import { 
  sendDirectMessage, 
  getConversationMessages, 
  markMessagesAsRead,
  sendMessageWithBotResponse
} from '@/services/friendsService';
import { followUser, unfollowUser, getUserDataWithCounts } from '@/services/postsService';
import { offlineService } from '@/services/offlineService';
import { BOT_USER_ID, BOT_USER, isBotMessage } from '@/services/chatbotService';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

interface DirectMessagesScreenProps {
  conversationId: string;
  otherUserId: string;
  onBack: () => void;
}

const DirectMessagesScreen: React.FC<DirectMessagesScreenProps> = ({
  conversationId,
  otherUserId,
  onBack,
}) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    // Get other user's info
    const fetchOtherUser = async () => {
      try {
        // Check if it's the bot
        if (otherUserId === BOT_USER_ID) {
          setOtherUser(BOT_USER);
        } else {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            setOtherUser({ id: userDoc.id, ...userDoc.data() } as User);
          }
        }
      } catch (error) {
        console.error('Error fetching other user:', error);
      }
    };

    fetchOtherUser();

    // Listen for messages
    console.log('Setting up message listener for conversation:', conversationId);
    const unsubscribe = getConversationMessages(conversationId, (newMessages) => {
      console.log('Received messages:', newMessages.length, newMessages);
      setMessages(newMessages);
      // Auto scroll to bottom when new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // Mark messages as read when screen opens
    markMessagesAsRead(conversationId).catch(console.error);

    return unsubscribe;
  }, [conversationId, otherUserId]);

  useEffect(() => {
    // Load current user data for following status
    const loadCurrentUser = async () => {
      if (currentUser) {
        const userData = await getUserDataWithCounts(currentUser.uid);
        setCurrentUserData(userData);
      }
    };
    loadCurrentUser();
  }, [currentUser]);

  const handleFollowUser = async () => {
    if (!currentUser || !otherUserId) return;
    
    try {
      await followUser(otherUserId);
      // Refresh current user data
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You are now following this user!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to follow user');
    }
  };

  const handleUnfollowUser = async () => {
    if (!currentUser || !otherUserId) return;
    
    try {
      await unfollowUser(otherUserId);
      // Refresh current user data
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You have unfollowed this user');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    }
  };

  const isFollowing = (): boolean => {
    return currentUserData?.following?.includes(otherUserId) || false;
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

  const isFriend = (): boolean => {
    return currentUserData?.friends?.includes(otherUserId) || false;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    console.log('Sending message:', newMessage.trim(), 'to user:', otherUserId);
    setLoading(true);
    try {
      // Check if messaging the bot
      if (otherUserId === BOT_USER_ID) {
        // Send message and get bot response
        await sendMessageWithBotResponse(otherUserId, newMessage.trim(), currentUserData);
        console.log('Message sent to bot successfully');
      } else {
        // Use offline service for automatic offline support (regular users)
        await offlineService.sendDirectMessage(
          currentUser?.uid || '',
          otherUserId,
          newMessage.trim()
        );
        console.log('Message sent successfully');
      }
      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (otherUserId === BOT_USER_ID) {
        Alert.alert('Error', 'Failed to send message to bot. Please try again.');
      } else {
        Alert.alert(
          'Message Queued', 
          'Your message will be sent when you reconnect to the internet.',
          [{ text: 'OK' }]
        );
      }
      setNewMessage(''); // Clear input even if offline
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    console.log('Rendering message:', item);
    const isOwnMessage = item.fromUserId === currentUser?.uid;
    
    // Safety check for createdAt
    const messageTime = item.createdAt instanceof Date 
      ? item.createdAt 
      : new Date(item.createdAt || Date.now());
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
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
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      {Platform.OS === 'android' && (
        <StatusBar backgroundColor="#667eea" barStyle="light-content" />
      )}
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior='padding'
          keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>
                {otherUser?.displayName || 'Loading...'}
              </Text>
              <View style={styles.headerBadges}>
                <Text style={styles.headerSubtitle}>
                  {isUserOnlineNow(otherUser) ? '🟢 Online' : '⚪ Offline'}
                </Text>
                {isFriend() && (
                  <View style={styles.friendBadge}>
                    <Text style={styles.friendBadgeText}>Friend</Text>
                  </View>
                )}
              </View>
            </View>
            {!isFriend() && otherUser && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing() && styles.followingButton]}
                onPress={isFollowing() ? handleUnfollowUser : handleFollowUser}
              >
                <Text style={[styles.followButtonText, isFollowing() && styles.followingButtonText]}>
                  {isFollowing() ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || loading) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || loading}
            >
              <Text style={styles.sendButtonText}>
                {loading ? '⏳' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginRight: 8,
  },
  friendBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  friendBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 8,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  followButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#fff',
  },
  headerRight: {
    width: 40, // Balance the back button
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContent: {
    paddingVertical: 20,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  ownMessageBubble: {
    // Same background as other messages for consistency
  },
  otherMessageBubble: {
    // Same background as own messages for consistency
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#fff',
  },
  ownMessageText: {
    // Same color for consistency
  },
  otherMessageText: {
    // Same color for consistency
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'right',
  },
  ownMessageTime: {
    // Same styling for consistency
  },
  otherMessageTime: {
    // Same styling for consistency
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 12,
    borderTopWidth: 0,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 0,
  },
  sendButton: {
    backgroundColor: '#667eea',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
});

export default DirectMessagesScreen;