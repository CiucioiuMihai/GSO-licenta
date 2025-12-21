import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

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