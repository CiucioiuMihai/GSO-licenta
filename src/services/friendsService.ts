import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  User, 
  FriendRequest, 
  DirectMessage, 
  Conversation 
} from '@/types';

// Friend Requests
export const sendFriendRequest = async (toUserId: string): Promise<void> => {
  console.log('sendFriendRequest called with toUserId:', toUserId);
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('No authenticated user found');
    throw new Error('Not authenticated');
  }
  
  console.log('Current user ID:', currentUser.uid);
  
  if (currentUser.uid === toUserId) {
    console.error('Attempted to send friend request to self');
    throw new Error('You cannot send a friend request to yourself');
  }

  try {
    // Check if both users exist
    console.log('Checking if users exist...');
    const [currentUserDoc, targetUserDoc] = await Promise.all([
      getDoc(doc(db, 'users', currentUser.uid)),
      getDoc(doc(db, 'users', toUserId))
    ]);

    if (!currentUserDoc.exists()) {
      console.error('Current user document not found');
      throw new Error('Current user document not found');
    }
    
    if (!targetUserDoc.exists()) {
      console.error('Target user document not found for ID:', toUserId);
      throw new Error('User not found');
    }
    
    const currentUserData = { ...currentUserDoc.data(), id: currentUser.uid } as User;
    const targetUserData = { ...targetUserDoc.data(), id: toUserId } as User;
    
    console.log('Current user data:', { id: currentUserData.id, email: currentUserData.email });
    console.log('Target user data:', { id: targetUserData.id, email: targetUserData.email });

    // Check if request already exists
    console.log('Checking for existing friend requests...');
    const existingRequest = await getDocs(
      query(
        collection(db, 'friendRequests'),
        where('fromUserId', '==', currentUser.uid),
        where('toUserId', '==', toUserId),
        where('status', '==', 'pending')
      )
    );

    if (!existingRequest.empty) {
      console.error('Friend request already exists');
      throw new Error('Friend request already sent');
    }

    // Check if they are already friends
    const currentUserFriends = currentUserData.friends || [];
    if (currentUserFriends.includes(toUserId)) {
      console.error('Users are already friends');
      throw new Error('You are already friends with this user');
    }

    // Create friend request
    console.log('Creating friend request...');
    const friendRequest: Omit<FriendRequest, 'id'> = {
      fromUserId: currentUser.uid,
      toUserId,
      status: 'pending',
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'friendRequests'), friendRequest);
    console.log('Friend request created successfully with ID:', docRef.id);
    
  } catch (error: any) {
    console.error('Error in sendFriendRequest:', error);
    throw new Error(error.message || 'Failed to send friend request');
  }
};

export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  console.log('acceptFriendRequest called with requestId:', requestId);
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('No authenticated user');
    throw new Error('Not authenticated');
  }

  console.log('Current user ID:', currentUser.uid);

  // Get the friend request
  const requestDoc = await getDoc(doc(db, 'friendRequests', requestId));
  if (!requestDoc.exists()) {
    console.error('Friend request not found');
    throw new Error('Friend request not found');
  }

  const request = requestDoc.data() as FriendRequest;
  console.log('Friend request data:', request);
  
  // Update request status
  console.log('Updating request status to accepted...');
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'accepted',
    acceptedAt: new Date(),
  });

  // Add to both users' friends arrays (handle missing arrays)
  const fromUserRef = doc(db, 'users', request.fromUserId);
  const toUserRef = doc(db, 'users', currentUser.uid);

  console.log('Adding friends - fromUserId:', request.fromUserId, 'toUserId:', currentUser.uid);

  // Get both user docs to check if friends array exists
  const [fromUserDoc, toUserDoc] = await Promise.all([
    getDoc(fromUserRef),
    getDoc(toUserRef)
  ]);

  // Initialize friends array if it doesn't exist
  const fromUserData = fromUserDoc.data();
  const toUserData = toUserDoc.data();

  console.log('From user friends before:', fromUserData?.friends);
  console.log('To user friends before:', toUserData?.friends);

  if (!fromUserData?.friends) {
    console.log('Initializing friends array for fromUser');
    await updateDoc(fromUserRef, { friends: [] });
  }
  if (!toUserData?.friends) {
    console.log('Initializing friends array for toUser');
    await updateDoc(toUserRef, { friends: [] });
  }

  // Now add friends
  console.log('Adding friend connections...');
  await updateDoc(fromUserRef, {
    friends: arrayUnion(currentUser.uid),
  });

  await updateDoc(toUserRef, {
    friends: arrayUnion(request.fromUserId),
  });

  console.log('Friend request accepted successfully');
};

export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'rejected',
  });
};

export const removeFriend = async (friendId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  // Remove from both users' friends arrays
  const currentUserRef = doc(db, 'users', currentUser.uid);
  const friendUserRef = doc(db, 'users', friendId);

  await updateDoc(currentUserRef, {
    friends: arrayRemove(friendId),
  });

  await updateDoc(friendUserRef, {
    friends: arrayRemove(currentUser.uid),
  });
};

// Get pending friend requests
export const getPendingFriendRequests = (callback: (requests: FriendRequest[]) => void) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return () => {};

  return onSnapshot(
    query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', currentUser.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    ),
    (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as FriendRequest[];
      callback(requests);
    }
  );
};

// Get user's friends
export const getUserFriends = async (userId?: string): Promise<User[]> => {
  const targetUserId = userId || auth.currentUser?.uid;
  if (!targetUserId) throw new Error('User ID required');

  const userDoc = await getDoc(doc(db, 'users', targetUserId));
  if (!userDoc.exists()) throw new Error('User not found');

  const userData = userDoc.data() as User;
  
  // Handle both old and new user structures
  const friendIds = userData.friends || [];

  // If friends array doesn't exist, initialize it
  if (!userData.friends) {
    await updateDoc(doc(db, 'users', targetUserId), {
      friends: [],
    });
  }

  if (friendIds.length === 0) return [];

  // Get friends' data
  const friendsPromises = friendIds.map(friendId => 
    getDoc(doc(db, 'users', friendId))
  );

  const friendsDocs = await Promise.all(friendsPromises);
  
  return friendsDocs
    .filter(doc => doc.exists())
    .map(doc => ({ id: doc.id, ...doc.data() } as User));
};

// Direct Messages
export const sendDirectMessage = async (toUserId: string, message: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  // Create conversation ID (consistent regardless of who sends first)
  const participantIds = [currentUser.uid, toUserId].sort();
  const conversationId = participantIds.join('_');

  // Check if conversation exists, create if not
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);

  if (!conversationDoc.exists()) {
    const newConversation = {
      participants: participantIds,
      lastMessage: message,
      lastMessageAt: new Date(),
      [`unreadCount_${toUserId}`]: 1,
      [`unreadCount_${currentUser.uid}`]: 0,
    };
    
    await setDoc(conversationRef, newConversation);
  } else {
    // Update existing conversation
    await updateDoc(conversationRef, {
      lastMessage: message,
      lastMessageAt: new Date(),
      [`unreadCount_${toUserId}`]: (conversationDoc.data()?.[`unreadCount_${toUserId}`] || 0) + 1,
    });
  }

  // Add the message
  const directMessage: Omit<DirectMessage, 'id'> = {
    conversationId,
    fromUserId: currentUser.uid,
    toUserId,
    message,
    read: false,
    createdAt: new Date(),
  };

  await addDoc(collection(db, 'directMessages'), directMessage);
};

// Get messages for a conversation
export const getConversationMessages = (
  conversationId: string,
  callback: (messages: DirectMessage[]) => void
) => {
  return onSnapshot(
    query(
      collection(db, 'directMessages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    ),
    (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as DirectMessage[];
      callback(messages);
    }
  );
};

// Get user's conversations
export const getUserConversations = (callback: (conversations: Conversation[]) => void) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return () => {};

  return onSnapshot(
    query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    ),
    (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastMessageAt: doc.data().lastMessageAt?.toDate() || new Date(),
      })) as Conversation[];
      callback(conversations);
    }
  );
};

// Mark messages as read
export const markMessagesAsRead = async (conversationId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  // Reset unread count for current user
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`unreadCount_${currentUser.uid}`]: 0,
  });

  // Mark messages as read
  const messagesQuery = query(
    collection(db, 'directMessages'),
    where('conversationId', '==', conversationId),
    where('toUserId', '==', currentUser.uid),
    where('read', '==', false)
  );

  const messagesSnapshot = await getDocs(messagesQuery);
  
  const updatePromises = messagesSnapshot.docs.map(messageDoc =>
    updateDoc(messageDoc.ref, { read: true })
  );

  await Promise.all(updatePromises);
};