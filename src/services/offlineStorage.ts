import AsyncStorage from '@react-native-async-storage/async-storage';
import { Post, Comment, User } from '../types';

// Storage Keys interface
interface StorageKeys {
  USER_PROFILE: string;
  POSTS_CACHE: string;
  COMMENTS_CACHE: string;
  LEADERBOARD_CACHE: string;
  ACHIEVEMENTS_CACHE: string;
  OFFLINE_QUEUE: string;
  LAST_SYNC: string;
  APP_DATA: string;
  USER_SETTINGS: string;
  MESSAGES_CACHE: string;
}

// Cache item interface
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiration: number;
}

// User settings interface
interface UserSettings {
  notifications: boolean;
  soundEffects: boolean;
  autoSync: boolean;
  cacheImages: boolean;
  offlineMode: boolean;
}

// Storage info interface
interface StorageInfo {
  totalKeys: number;
  totalSize: number;
  breakdown: {
    cache?: number;
    userProfiles?: number;
    offlineQueue?: number;
    other?: number;
  };
  formattedSize: string;
}

// Storage Keys
const STORAGE_KEYS: StorageKeys = {
  USER_PROFILE: 'user_profile_',
  POSTS_CACHE: 'posts_cache',
  COMMENTS_CACHE: 'comments_cache_',
  LEADERBOARD_CACHE: 'leaderboard_cache',
  ACHIEVEMENTS_CACHE: 'achievements_cache',
  OFFLINE_QUEUE: 'offline_queue',
  LAST_SYNC: 'last_sync',
  APP_DATA: 'app_data',
  USER_SETTINGS: 'user_settings',
  MESSAGES_CACHE: 'messages_cache'
};

// Cache Management
export const cacheData = async <T>(key: string, data: T, expirationMinutes: number = 60): Promise<void> => {
  try {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiration: Date.now() + (expirationMinutes * 60 * 1000)
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
  } catch (error) {
    console.error('Error caching data:', error);
  }
};

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const cachedItem = await AsyncStorage.getItem(key);
    if (!cachedItem) return null;

    const parsedItem: CacheItem<T> = JSON.parse(cachedItem);
    
    // Check if cache is still valid
    if (parsedItem.expiration && Date.now() > parsedItem.expiration) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsedItem.data;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
};

export const clearCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.includes('_cache') || key.includes('user_profile_')
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};

// User Profile Cache
export const cacheUserProfile = async (userId: string, profileData: User): Promise<void> => {
  await cacheData(`${STORAGE_KEYS.USER_PROFILE}${userId}`, profileData, 120); // 2 hours
};

export const getCachedUserProfile = async (userId: string): Promise<User | null> => {
  return await getCachedData<User>(`${STORAGE_KEYS.USER_PROFILE}${userId}`);
};

// Posts Cache
export const cachePosts = async (posts: Post[]): Promise<void> => {
  await cacheData(STORAGE_KEYS.POSTS_CACHE, posts, 30); // 30 minutes
};

export const getCachedPosts = async (): Promise<Post[]> => {
  return await getCachedData<Post[]>(STORAGE_KEYS.POSTS_CACHE) || [];
};

export const addPostToCache = async (newPost: Post): Promise<void> => {
  try {
    const existingPosts = await getCachedPosts();
    const updatedPosts = [newPost, ...existingPosts];
    await cachePosts(updatedPosts.slice(0, 50)); // Keep last 50 posts
  } catch (error) {
    console.error('Error adding post to cache:', error);
  }
};

export const updatePostInCache = async (postId: string, updates: Partial<Post>): Promise<void> => {
  try {
    const posts = await getCachedPosts();
    const updatedPosts = posts.map(post => 
      post.id === postId ? { ...post, ...updates } : post
    );
    await cachePosts(updatedPosts);
  } catch (error) {
    console.error('Error updating post in cache:', error);
  }
};

// Comments Cache
export const cacheComments = async (postId: string, comments: Comment[]): Promise<void> => {
  await cacheData(`${STORAGE_KEYS.COMMENTS_CACHE}${postId}`, comments, 30);
};

export const getCachedComments = async (postId: string): Promise<Comment[]> => {
  return await getCachedData<Comment[]>(`${STORAGE_KEYS.COMMENTS_CACHE}${postId}`) || [];
};

// Leaderboard Cache
export const cacheLeaderboard = async (leaderboardData: User[]): Promise<void> => {
  await cacheData(STORAGE_KEYS.LEADERBOARD_CACHE, leaderboardData, 15); // 15 minutes
};

export const getCachedLeaderboard = async (): Promise<User[]> => {
  return await getCachedData<User[]>(STORAGE_KEYS.LEADERBOARD_CACHE) || [];
};

// Achievements Cache
export const cacheAchievements = async (achievements: any[]): Promise<void> => {
  await cacheData(STORAGE_KEYS.ACHIEVEMENTS_CACHE, achievements, 60);
};

export const getCachedAchievements = async (): Promise<any[]> => {
  return await getCachedData<any[]>(STORAGE_KEYS.ACHIEVEMENTS_CACHE) || [];
};

// Offline Queue Management
export const addToOfflineQueue = async (action: any): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = [...queue, {
      ...action,
      timestamp: Date.now(),
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }];
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Error adding to offline queue:', error);
  }
};

export const getOfflineQueue = async (): Promise<any[]> => {
  try {
    const queue = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error getting offline queue:', error);
    return [];
  }
};

export const removeFromOfflineQueue = async (actionId: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.filter(action => action.id !== actionId);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Error removing from offline queue:', error);
  }
};

export const clearOfflineQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  } catch (error) {
    console.error('Error clearing offline queue:', error);
  }
};

// Sync Management
export const setLastSyncTime = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('Error setting last sync time:', error);
  }
};

export const getLastSyncTime = async (): Promise<number> => {
  try {
    const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? parseInt(lastSync) : 0;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return 0;
  }
};

// App Data (settings, preferences)
export const saveAppData = async (data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving app data:', error);
  }
};

export const getAppData = async (): Promise<any> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.APP_DATA);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting app data:', error);
    return {};
  }
};

// User Settings
export const saveUserSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving user settings:', error);
  }
};

export const getUserSettings = async (): Promise<UserSettings> => {
  try {
    const settings = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    return settings ? JSON.parse(settings) : {
      notifications: true,
      soundEffects: true,
      autoSync: true,
      cacheImages: true,
      offlineMode: true
    };
  } catch (error) {
    console.error('Error getting user settings:', error);
    return {
      notifications: true,
      soundEffects: true,
      autoSync: true,
      cacheImages: true,
      offlineMode: true
    };
  }
};

// Storage Info
export const getStorageInfo = async (): Promise<StorageInfo | null> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const data = await AsyncStorage.multiGet(keys);
    
    let totalSize = 0;
    const breakdown: StorageInfo['breakdown'] = {};
    
    data.forEach(([key, value]) => {
      if (value) {
        const size = new Blob([value]).size;
        totalSize += size;
        
        if (key.includes('_cache')) {
          breakdown.cache = (breakdown.cache || 0) + size;
        } else if (key.includes('user_profile_')) {
          breakdown.userProfiles = (breakdown.userProfiles || 0) + size;
        } else if (key.includes('offline_queue')) {
          breakdown.offlineQueue = (breakdown.offlineQueue || 0) + size;
        } else {
          breakdown.other = (breakdown.other || 0) + size;
        }
      }
    });

    return {
      totalKeys: keys.length,
      totalSize: totalSize,
      breakdown: breakdown,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return null;
  }
};

const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};