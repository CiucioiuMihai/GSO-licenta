import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  increment, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove,
  startAfter,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  User, 
  Post, 
  Comment, 
  Notification, 
  FriendRequest, 
  DirectMessage, 
  Conversation, 
  Report, 
  Achievement,
  ActivityFeedItem,
  LeaderboardUser,
  XPTransaction,
  UserAction,
  VerificationRequest
} from '../types';

// User Management
export const createUser = async (userId: string, userData: Partial<User>): Promise<void> => {
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    xp: 0,
    level: 1,
    badges: [],
    achievements: [],
    friends: [],
    following: [],
    followers: [],
    totalPosts: 0,
    totalLikes: 0,
    isOnline: true,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
    privacySettings: {
      profileVisibility: 'public',
      postVisibility: 'public',
      allowMessages: 'everyone',
      allowFriendRequests: true,
      showOnlineStatus: true,
      allowTagging: true,
      updatedAt: serverTimestamp()
    }
  });
};

export const getUser = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User : null;
};

export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), updates);
};

export const updateUserOnlineStatus = async (userId: string, isOnline: boolean): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    isOnline,
    lastActive: serverTimestamp()
  });
};

export const addUserXP = async (userId: string, xp: number): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as User;
    const newXP = (userData.xp || 0) + xp;
    const newLevel = Math.floor(newXP / 1000) + 1;
    
    await updateDoc(userRef, {
      xp: increment(xp),
      level: newLevel
    });

    // Record XP transaction
    await addDoc(collection(db, 'xpTransactions'), {
      userId,
      amount: xp,
      reason: 'Activity reward',
      timestamp: serverTimestamp(),
      previousXP: userData.xp || 0,
      newXP
    });
  }
};

export const getUserXPTransactions = async (userId: string): Promise<XPTransaction[]> => {
  const q = query(
    collection(db, 'xpTransactions'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as XPTransaction);
};

// Post Management
export const createPost = async (postData: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments' | 'shares' | 'likedBy'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...postData,
    likes: 0,
    comments: 0,
    shares: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
    moderationStatus: 'approved'
  });

  // Increment user's post count
  await updateDoc(doc(db, 'users', postData.userId), {
    totalPosts: increment(1)
  });

  // Award XP for creating a post
  await addUserXP(postData.userId, 10);

  return docRef.id;
};

export const getPosts = async (pageSize: number = 20, lastPostId?: string): Promise<Post[]> => {
  let q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (lastPostId) {
    const lastDoc = await getDoc(doc(db, 'posts', lastPostId));
    q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Post);
};

export const getUserPosts = async (userId: string): Promise<Post[]> => {
  const q = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Post);
};

export const likePost = async (postId: string, userId: string): Promise<void> => {
  const postRef = doc(db, 'posts', postId);
  const postDoc = await getDoc(postRef);
  
  if (postDoc.exists()) {
    const post = postDoc.data() as Post;
    const hasLiked = post.likedBy?.includes(userId);
    
    if (hasLiked) {
      // Unlike
      await updateDoc(postRef, {
        likes: increment(-1),
        likedBy: arrayRemove(userId)
      });
    } else {
      // Like
      await updateDoc(postRef, {
        likes: increment(1),
        likedBy: arrayUnion(userId)
      });

      // Create notification for post author
      if (post.userId !== userId) {
        await createNotification(post.userId, {
          type: 'post_liked',
          fromUserId: userId,
          message: 'liked your post',
          data: { postId }
        });
      }

      // Award XP to user who liked
      await addUserXP(userId, 2);

      // Award XP to post author
      await addUserXP(post.userId, 5);
    }
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  await deleteDoc(doc(db, 'posts', postId));
  
  // Delete associated comments
  const commentsQuery = query(collection(db, 'comments'), where('postId', '==', postId));
  const commentsSnapshot = await getDocs(commentsQuery);
  
  for (const commentDoc of commentsSnapshot.docs) {
    await deleteDoc(commentDoc.ref);
  }
};

// Comment Management
export const createComment = async (commentData: Omit<Comment, 'id' | 'createdAt' | 'likes'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'comments'), {
    ...commentData,
    likes: 0,
    createdAt: serverTimestamp()
  });

  // Increment post's comment count
  await updateDoc(doc(db, 'posts', commentData.postId), {
    comments: increment(1)
  });

  // Get post data for notification
  const postDoc = await getDoc(doc(db, 'posts', commentData.postId));
  if (postDoc.exists()) {
    const post = postDoc.data() as Post;
    
    // Create notification for post author
    if (post.userId !== commentData.userId) {
      await createNotification(post.userId, {
        type: 'comment_added',
        fromUserId: commentData.userId,
        message: 'commented on your post',
        data: { postId: commentData.postId, commentId: docRef.id }
      });
    }
  }

  // Award XP for commenting
  await addUserXP(commentData.userId, 5);

  return docRef.id;
};

export const getPostComments = async (postId: string): Promise<Comment[]> => {
  const q = query(
    collection(db, 'comments'),
    where('postId', '==', postId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Comment);
};

// Notification Management
export const createNotification = async (userId: string, notificationData: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'notifications'), {
    userId,
    ...notificationData,
    read: false,
    createdAt: serverTimestamp()
  });
  
  return docRef.id;
};

export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Notification);
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true,
    readAt: serverTimestamp()
  });
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  
  const snapshot = await getDocs(q);
  
  for (const doc of snapshot.docs) {
    await updateDoc(doc.ref, {
      read: true,
      readAt: serverTimestamp()
    });
  }
};

// Friend System
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<string> => {
  // Check if request already exists
  const existingQuery = query(
    collection(db, 'friendRequests'),
    where('fromUserId', '==', fromUserId),
    where('toUserId', '==', toUserId),
    where('status', '==', 'pending')
  );
  
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Friend request already sent');
  }

  const docRef = await addDoc(collection(db, 'friendRequests'), {
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  // Create notification
  await createNotification(toUserId, {
    type: 'friend_request',
    fromUserId,
    message: 'sent you a friend request',
    data: { requestId: docRef.id }
  });

  return docRef.id;
};

export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  const requestRef = doc(db, 'friendRequests', requestId);
  const requestDoc = await getDoc(requestRef);
  
  if (!requestDoc.exists()) {
    throw new Error('Friend request not found');
  }

  const request = requestDoc.data() as FriendRequest;
  
  // Update request status
  await updateDoc(requestRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp()
  });

  // Add each user to the other's friends list
  await updateDoc(doc(db, 'users', request.fromUserId), {
    friends: arrayUnion(request.toUserId)
  });
  
  await updateDoc(doc(db, 'users', request.toUserId), {
    friends: arrayUnion(request.fromUserId)
  });

  // Create notification for requester
  await createNotification(request.fromUserId, {
    type: 'friend_accepted',
    fromUserId: request.toUserId,
    message: 'accepted your friend request'
  });

  // Award XP for making a friend
  await addUserXP(request.fromUserId, 25);
  await addUserXP(request.toUserId, 25);
};

export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'rejected'
  });
};

export const unfriend = async (userId1: string, userId2: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId1), {
    friends: arrayRemove(userId2)
  });
  
  await updateDoc(doc(db, 'users', userId2), {
    friends: arrayRemove(userId1)
  });
};

export const followUser = async (followerId: string, followingId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', followerId), {
    following: arrayUnion(followingId)
  });
  
  await updateDoc(doc(db, 'users', followingId), {
    followers: arrayUnion(followerId)
  });

  // Create notification
  await createNotification(followingId, {
    type: 'new_follower',
    fromUserId: followerId,
    message: 'started following you'
  });

  // Award XP
  await addUserXP(followerId, 10);
};

export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', followerId), {
    following: arrayRemove(followingId)
  });
  
  await updateDoc(doc(db, 'users', followingId), {
    followers: arrayRemove(followerId)
  });
};

export const getUserFriends = async (userId: string): Promise<User[]> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return [];
  
  const user = userDoc.data() as User;
  const friendIds = user.friends || [];
  
  if (friendIds.length === 0) return [];

  const friends: User[] = [];
  for (const friendId of friendIds) {
    const friendDoc = await getDoc(doc(db, 'users', friendId));
    if (friendDoc.exists()) {
      friends.push({ id: friendDoc.id, ...friendDoc.data() } as User);
    }
  }
  
  return friends;
};

// Search and Discovery
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  const q = query(
    collection(db, 'users'),
    where('displayName', '>=', searchTerm),
    where('displayName', '<=', searchTerm + '\uf8ff'),
    limit(20)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
};

export const getLeaderboard = async (): Promise<LeaderboardUser[]> => {
  const q = query(
    collection(db, 'users'),
    orderBy('xp', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc, index) => ({
    id: doc.id,
    ...doc.data(),
    rank: index + 1
  }) as LeaderboardUser);
};

// Activity Feed
export const getActivityFeed = async (userId: string): Promise<ActivityFeedItem[]> => {
  const user = await getUser(userId);
  if (!user) return [];

  const friends = user.friends || [];
  friends.push(userId); // Include user's own activity

  const q = query(
    collection(db, 'activityFeed'),
    where('userId', 'in', friends),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityFeedItem);
};

// Content Moderation
export const reportContent = async (reporterId: string, contentId: string, contentType: 'post' | 'comment' | 'user', reason: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'reports'), {
    reporterId,
    contentId,
    contentType,
    reason,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  
  return docRef.id;
};

export const getPendingReports = async (): Promise<Report[]> => {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Report);
};

// Real-time subscriptions
export const subscribeToUserNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }) as Notification);
    callback(notifications);
  });
};

export const subscribeToFeed = (callback: (posts: Post[]) => void) => {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }) as Post);
    callback(posts);
  });
};