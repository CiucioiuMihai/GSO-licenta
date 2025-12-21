import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  QuerySnapshot,
  DocumentData,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, User } from '../types';

// Interfaces for advanced features
interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sent: boolean;
  createdAt: any;
}

interface RecommendedPost extends Post {
  recommendationScore: number;
}

interface Hashtag {
  id?: string;
  name: string;
  usageCount: number;
  createdAt: any;
  lastUsed: any;
}

interface VerificationRequest {
  userId: string;
  type: 'identity' | 'business' | 'creator';
  documents: string[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  postVisibility: 'public' | 'friends' | 'private';
  allowMessages: 'everyone' | 'friends' | 'none';
  allowFriendRequests: boolean;
  showOnlineStatus: boolean;
  allowTagging: boolean;
  updatedAt?: any;
}

interface ContentFilterResult {
  approved: boolean;
  flagged: boolean;
  confidence: number;
}

interface ActivityFeedItem {
  id?: string;
  userId: string;
  type: string;
  metadata: Record<string, any>;
  createdAt: any;
}

interface CurrencyTransaction {
  userId: string;
  currencyType: string;
  amount: number;
  reason: string;
  timestamp: any;
}

interface SearchParams {
  query: string;
  type: 'users' | 'posts' | 'hashtags';
  filters?: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    [key: string]: any;
  };
  sortBy?: string;
  limit?: number;
}

// Push Notification Service
export const sendPushNotification = async (
  userId: string, 
  title: string, 
  body: string, 
  data: Record<string, any> = {}
): Promise<void> => {
  try {
    // Store notification in database
    await addDoc(collection(db, 'pushNotifications'), {
      userId,
      title,
      body,
      data,
      sent: false,
      createdAt: serverTimestamp()
    });
    
    // Track notification sent - assuming this function exists
    // await trackUserAction(userId, 'notification_received', { title, type: data.type });
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

// Content Recommendation Engine
export const getRecommendedPosts = async (userId: string, limitCount: number = 20): Promise<RecommendedPost[]> => {
  try {
    // Simple recommendation based on user's friends and interests
    // In production, you'd use ML algorithms
    
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      orderBy('likes', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const recommendations: RecommendedPost[] = querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      recommendationScore: Math.random() * 100 // Simple random scoring
    }) as RecommendedPost);
    
    // Track recommendation view
    // await trackUserAction(userId, 'recommendations_viewed', { count: recommendations.length });
    
    return recommendations;
  } catch (error) {
    console.error('Error getting recommended posts:', error);
    throw error;
  }
};

// Hashtag System
export const createHashtag = async (hashtag: string): Promise<void> => {
  try {
    const hashtagRef = doc(db, 'hashtags', hashtag.toLowerCase());
    await updateDoc(hashtagRef, {
      name: hashtag,
      usageCount: 1,
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp()
    });
  } catch (error) {
    // If hashtag doesn't exist, create it
    await addDoc(collection(db, 'hashtags'), {
      name: hashtag,
      usageCount: 1,
      createdAt: serverTimestamp(),
      lastUsed: serverTimestamp()
    });
  }
};

export const getTrendingHashtags = async (limitCount: number = 10): Promise<Hashtag[]> => {
  try {
    const hashtagsRef = collection(db, 'hashtags');
    const q = query(
      hashtagsRef,
      orderBy('usageCount', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Hashtag);
  } catch (error) {
    console.error('Error getting trending hashtags:', error);
    throw error;
  }
};

// User Verification System
export const requestVerification = async (
  userId: string, 
  verificationType: 'identity' | 'business' | 'creator', 
  documents: string[] = []
): Promise<void> => {
  try {
    await addDoc(collection(db, 'verificationRequests'), {
      userId,
      type: verificationType,
      documents: documents, // Base64 encoded documents
      status: 'pending',
      submittedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error requesting verification:', error);
    throw error;
  }
};

// Privacy and Security
export const updatePrivacySettings = async (userId: string, settings: Partial<PrivacySettings>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      privacySettings: {
        profileVisibility: settings.profileVisibility || 'public',
        postVisibility: settings.postVisibility || 'public',
        allowMessages: settings.allowMessages || 'everyone',
        allowFriendRequests: settings.allowFriendRequests ?? true,
        showOnlineStatus: settings.showOnlineStatus ?? true,
        allowTagging: settings.allowTagging ?? true,
        updatedAt: serverTimestamp()
      }
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
};

// Content Filtering and Safety
export const filterContent = async (content: string): Promise<ContentFilterResult> => {
  try {
    // Simple content filtering - in production use AI moderation services
    const bannedWords = ['spam', 'scam', 'fake']; // This would be a larger list
    const lowercaseContent = content.toLowerCase();
    
    const containsBannedWords = bannedWords.some(word => 
      lowercaseContent.includes(word)
    );
    
    return {
      approved: !containsBannedWords,
      flagged: containsBannedWords,
      confidence: containsBannedWords ? 0.9 : 0.1
    };
  } catch (error) {
    console.error('Error filtering content:', error);
    return { approved: true, flagged: false, confidence: 0 };
  }
};

// Real-time Activity Feed
export const createActivityFeedItem = async (
  userId: string, 
  activityType: string, 
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await addDoc(collection(db, 'activityFeed'), {
      userId,
      type: activityType, // 'post_created', 'achievement_unlocked', 'level_up', etc.
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating activity feed item:', error);
    throw error;
  }
};

export const getUserActivityFeed = async (userId: string, limitCount: number = 20): Promise<ActivityFeedItem[]> => {
  try {
    const activityRef = collection(db, 'activityFeed');
    const q = query(
      activityRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityFeedItem);
  } catch (error) {
    console.error('Error getting activity feed:', error);
    throw error;
  }
};

// Virtual Economy
export const createVirtualCurrency = async (
  userId: string, 
  currencyType: string, 
  amount: number, 
  reason: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const currencyField = `virtualCurrency.${currencyType}`;
    
    await updateDoc(userRef, {
      [currencyField]: amount,
      lastCurrencyUpdate: serverTimestamp()
    });
    
    // Record transaction
    await addDoc(collection(db, 'currencyTransactions'), {
      userId,
      currencyType,
      amount,
      reason,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error managing virtual currency:', error);
    throw error;
  }
};

// Advanced Search with Filters
export const advancedSearch = async (searchParams: SearchParams): Promise<any[]> => {
  try {
    const {
      query: searchQuery,
      type,
      filters = {},
      sortBy = 'relevance',
      limit: limitCount = 20
    } = searchParams;
    
    let collectionName: string;
    let searchField: string;
    
    switch (type) {
      case 'users':
        collectionName = 'users';
        searchField = 'displayName';
        break;
      case 'posts':
        collectionName = 'posts';
        searchField = 'content';
        break;
      case 'hashtags':
        collectionName = 'hashtags';
        searchField = 'name';
        break;
      default:
        throw new Error('Invalid search type');
    }
    
    const collectionRef = collection(db, collectionName);
    let q = query(
      collectionRef,
      where(searchField, '>=', searchQuery),
      where(searchField, '<=', searchQuery + '\\uf8ff'),
      limit(limitCount)
    );
    
    // Apply additional filters
    if (filters.dateRange) {
      q = query(q, where('createdAt', '>=', filters.dateRange.start));
      q = query(q, where('createdAt', '<=', filters.dateRange.end));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error performing advanced search:', error);
    throw error;
  }
};

// Subscription to real-time data
export const subscribeToNotifications = (
  userId: string, 
  callback: (snapshot: QuerySnapshot<DocumentData>) => void
): Unsubscribe => {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, callback);
};

export const subscribeToMessages = (
  conversationId: string, 
  callback: (snapshot: QuerySnapshot<DocumentData>) => void
): Unsubscribe => {
  const messagesRef = collection(db, 'messages');
  const q = query(
    messagesRef,
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, callback);
};