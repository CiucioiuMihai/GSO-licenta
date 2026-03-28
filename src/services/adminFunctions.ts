import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { batchApplyRetroactiveXP } from './levelService';
import { Tag, User } from '@/types';

// Admin stats interface
interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
  pendingReports: number;
  verificationRequests: number;
}

// Moderation types
type ModerationAction = 'approved' | 'rejected' | 'flagged';
type ContentType = 'post' | 'comment';

// System settings interface
interface SystemSettings {
  [key: string]: any;
  updatedAt?: Timestamp;
}

// Backup data interface
interface BackupData {
  timestamp: string;
  data: { [collectionName: string]: any[] };
}

// Admin Dashboard Functions
export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    const stats: AdminStats = {
      totalUsers: 0,
      totalPosts: 0,
      totalComments: 0,
      activeUsers: 0,
      pendingReports: 0,
      verificationRequests: 0
    };
    
    // Get user count
    const usersSnapshot = await getDocs(collection(db, 'users'));
    stats.totalUsers = usersSnapshot.size;
    
    // Get active users (logged in within last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeUsersQuery = query(
      collection(db, 'users'),
      where('lastActive', '>=', weekAgo)
    );
    const activeUsersSnapshot = await getDocs(activeUsersQuery);
    stats.activeUsers = activeUsersSnapshot.size;
    
    // Get posts count
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    stats.totalPosts = postsSnapshot.size;
    
    // Get comments count
    const commentsSnapshot = await getDocs(collection(db, 'comments'));
    stats.totalComments = commentsSnapshot.size;
    
    // Get pending reports
    const reportsQuery = query(
      collection(db, 'reports'),
      where('status', '==', 'pending')
    );
    const reportsSnapshot = await getDocs(reportsQuery);
    stats.pendingReports = reportsSnapshot.size;
    
    // Get verification requests
    const verificationQuery = query(
      collection(db, 'verificationRequests'),
      where('status', '==', 'pending')
    );
    const verificationSnapshot = await getDocs(verificationQuery);
    stats.verificationRequests = verificationSnapshot.size;
    
    return stats;
  } catch (error) {
    console.error('Error getting admin stats:', error);
    throw error;
  }
};

// Content Moderation
export const moderateContent = async (
  contentId: string, 
  contentType: ContentType, 
  action: ModerationAction, 
  moderatorId: string, 
  reason: string
): Promise<void> => {
  try {
    // Update content status
    const contentRef = doc(db, contentType === 'post' ? 'posts' : 'comments', contentId);
    await updateDoc(contentRef, {
      moderationStatus: action,
      moderatedBy: moderatorId,
      moderationReason: reason,
      moderatedAt: serverTimestamp()
    });
    
    // Log moderation action
    await addDoc(collection(db, 'moderationLogs'), {
      contentId,
      contentType,
      action,
      moderatorId,
      reason,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error moderating content:', error);
    throw error;
  }
};

// User Management
export const suspendUser = async (
  userId: string, 
  duration: number, 
  reason: string, 
  moderatorId: string
): Promise<void> => {
  try {
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + duration);
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      suspended: true,
      suspensionEnd: suspensionEnd,
      suspensionReason: reason,
      suspendedBy: moderatorId,
      suspendedAt: serverTimestamp()
    });
    
    // Log suspension
    await addDoc(collection(db, 'userActions'), {
      userId,
      action: 'user_suspended',
      duration,
      reason,
      moderatorId,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

// System Configuration
export const updateSystemSettings = async (settings: SystemSettings): Promise<void> => {
  try {
    const settingsRef = doc(db, 'systemSettings', 'global');
    await updateDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    throw error;
  }
};

// Rate Limiting
const rateLimits = new Map<string, number[]>();

export const checkRateLimit = (
  userId: string, 
  action: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): boolean => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const userRequests = rateLimits.get(key) || [];
  
  // Remove old requests outside the window
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  validRequests.push(now);
  rateLimits.set(key, validRequests);
  return true;
};

// Backup and Recovery
export const createDataBackup = async (collections: string[]): Promise<BackupData> => {
  try {
    const backup: BackupData = {
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      backup.data[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
    
    // Store backup metadata
    await addDoc(collection(db, 'backups'), {
      timestamp: serverTimestamp(),
      collections,
      size: JSON.stringify(backup).length
    });
    
    return backup;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

// Security Functions
export const detectSuspiciousActivity = async (userId: string, action: string): Promise<boolean> => {
  try {
    // Simple suspicious activity detection
    const recentActions = await getDocs(
      query(
        collection(db, 'userActions'),
        where('userId', '==', userId),
        where('timestamp', '>=', new Date(Date.now() - 60000)), // Last minute
        orderBy('timestamp', 'desc')
      )
    );
    
    if (recentActions.size > 20) { // More than 20 actions per minute
      await addDoc(collection(db, 'securityAlerts'), {
        userId,
        type: 'suspicious_activity',
        details: `${recentActions.size} actions in 1 minute`,
        timestamp: serverTimestamp()
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    return false;
  }
};

/**
 * Apply retroactive XP to all users
 * This is an admin function that should be run once when implementing gamification
 */
export const adminApplyRetroactiveXPToAllUsers = async (
  onProgress?: (completed: number, total: number, currentUser?: string) => void
): Promise<{
  success: boolean;
  result?: {
    totalUsers: number;
    usersUpdated: number;
    totalXPAwarded: number;
    errors: string[];
  };
  error?: string;
}> => {
  try {
    console.log('Starting admin retroactive XP application...');
    
    const result = await batchApplyRetroactiveXP(onProgress);
    
    // Log the operation for auditing
    await addDoc(collection(db, 'adminActions'), {
      action: 'retroactive_xp_application',
      timestamp: serverTimestamp(),
      result: {
        totalUsers: result.totalUsers,
        usersUpdated: result.usersUpdated,
        totalXPAwarded: result.totalXPAwarded,
        errorCount: result.errors.length
      }
    });
    
    return {
      success: true,
      result
    };
  } catch (error: any) {
    console.error('Admin retroactive XP application failed:', error);
    
    // Log the error
    await addDoc(collection(db, 'adminActions'), {
      action: 'retroactive_xp_application',
      timestamp: serverTimestamp(),
      error: error.message,
      success: false
    });
    
    return {
      success: false,
      error: error.message
    };
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Admin Content Deletion Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Delete any post as admin, regardless of ownership.
 * Updates the post owner's totalPosts count and all related tag postsCount values.
 */
export const adminDeletePost = async (postId: string, moderatorId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) throw new Error('Post not found');

    const postData = postSnap.data();
    const batch = writeBatch(db);

    // Delete the post
    batch.delete(postRef);

    // Decrement owner's post count
    if (postData.userId) {
      batch.update(doc(db, 'users', postData.userId), {
        totalPosts: increment(-1),
      });
    }

    // Decrement each tag's postsCount
    if (Array.isArray(postData.tags)) {
      for (const tag of postData.tags as string[]) {
        const tagRef = doc(db, 'tags', tag.toLowerCase());
        const tagSnap = await getDoc(tagRef);
        if (tagSnap.exists()) {
          batch.update(tagRef, { postsCount: increment(-1) });
        }
      }
    }

    await batch.commit();

    // Log the action
    await addDoc(collection(db, 'moderationLogs'), {
      contentId: postId,
      contentType: 'post',
      action: 'admin_deleted',
      moderatorId,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting post as admin:', error);
    throw error;
  }
};

/**
 * Delete a tag entirely from the tags collection.
 */
export const adminDeleteTag = async (tagId: string, moderatorId: string): Promise<void> => {
  try {
    const tagRef = doc(db, 'tags', tagId);
    await deleteDoc(tagRef);

    await addDoc(collection(db, 'moderationLogs'), {
      contentId: tagId,
      contentType: 'tag',
      action: 'admin_deleted',
      moderatorId,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting tag as admin:', error);
    throw error;
  }
};

/**
 * Fetch all tags for admin management.
 */
export const adminGetAllTags = async (): Promise<Tag[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'tags'), orderBy('postsCount', 'desc'))
    );

    return snapshot.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Tag, 'id'>),
      createdAt: (d.data().createdAt as Timestamp)?.toDate?.() ?? new Date(),
      lastUsed: (d.data().lastUsed as Timestamp)?.toDate?.() ?? new Date(),
    }));
  } catch (error) {
    console.error('Error fetching tags for admin:', error);
    throw error;
  }
};

/**
 * Fetch all users for admin management.
 */
export const adminGetAllUsers = async (): Promise<User[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));

    return snapshot.docs
      .map(d => ({
        id: d.id,
        ...(d.data() as Omit<User, 'id'>),
        createdAt: (d.data().createdAt as Timestamp)?.toDate?.() ?? new Date(),
        lastActive: (d.data().lastActive as Timestamp)?.toDate?.() ?? new Date(),
      }))
      .sort((a, b) => (b.xp || 0) - (a.xp || 0));
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    throw error;
  }
};

/**
 * Delete a user and their own authored content.
 */
export const adminDeleteUser = async (userId: string, moderatorId: string): Promise<void> => {
  try {
    if (userId === moderatorId) {
      throw new Error('You cannot delete your own account');
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');

    const userData = userSnap.data() as Partial<User>;
    if (userData.role === 'admin') {
      throw new Error('Cannot delete another admin account from this screen');
    }

    const postsSnapshot = await getDocs(query(collection(db, 'posts'), where('userId', '==', userId)));
    const commentsSnapshot = await getDocs(query(collection(db, 'comments'), where('userId', '==', userId)));
    const repliesSnapshot = await getDocs(query(collection(db, 'replies'), where('userId', '==', userId)));
    const requestsFromSnapshot = await getDocs(query(collection(db, 'friendRequests'), where('fromUserId', '==', userId)));
    const requestsToSnapshot = await getDocs(query(collection(db, 'friendRequests'), where('toUserId', '==', userId)));

    const refsToDelete = [
      userRef,
      ...postsSnapshot.docs.map(d => d.ref),
      ...commentsSnapshot.docs.map(d => d.ref),
      ...repliesSnapshot.docs.map(d => d.ref),
      ...requestsFromSnapshot.docs.map(d => d.ref),
      ...requestsToSnapshot.docs.map(d => d.ref),
    ];

    // Firestore batch limit is 500 operations
    for (let i = 0; i < refsToDelete.length; i += 450) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + 450).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    await addDoc(collection(db, 'moderationLogs'), {
      contentId: userId,
      contentType: 'user',
      action: 'admin_deleted',
      moderatorId,
      timestamp: serverTimestamp(),
      details: {
        deletedPosts: postsSnapshot.size,
        deletedComments: commentsSnapshot.size,
        deletedReplies: repliesSnapshot.size,
      },
    });
  } catch (error) {
    console.error('Error deleting user as admin:', error);
    throw error;
  }
};