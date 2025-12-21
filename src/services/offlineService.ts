import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { 
  Post, 
  Comment, 
  User, 
  Notification, 
  OfflineAction, 
  NetworkState, 
  SyncStatus 
} from '../types';
import { 
  createPost as firebaseCreatePost, 
  createComment as firebaseCreateComment,
  likePost as firebaseLikePost,
  getPosts as firebaseGetPosts,
  getUser as firebaseGetUser
} from './firestore';

export interface CachedData {
  posts: Post[];
  users: { [userId: string]: User };
  notifications: Notification[];
  lastUpdated: number;
}

export interface OfflineCacheKeys {
  POSTS: 'offline_posts';
  USERS: 'offline_users';
  NOTIFICATIONS: 'offline_notifications';
  ACTIONS: 'offline_actions';
  LAST_SYNC: 'last_sync_time';
}

// Storage keys for offline data
const STORAGE_KEYS: OfflineCacheKeys = {
  POSTS: 'offline_posts',
  USERS: 'offline_users',
  NOTIFICATIONS: 'offline_notifications',
  ACTIONS: 'offline_actions',
  LAST_SYNC: 'last_sync_time'
};

class OfflineService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private syncQueue: OfflineAction[] = [];

  constructor() {
    this.initializeNetworkListener();
    this.loadOfflineActions();
  }

  // Network state management
  private initializeNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected || false;
      
      if (wasOffline && this.isOnline) {
        // Just came back online, sync pending actions
        this.syncOfflineActions();
      }
    });
  }

  public async getNetworkState(): Promise<NetworkState> {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected || false,
      connectionType: state.type || 'unknown'
    };
  }

  public isConnected(): boolean {
    return this.isOnline;
  }

  // Cache management
  public async cacheData<T>(key: keyof OfflineCacheKeys, data: T): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(STORAGE_KEYS[key], JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  public async getCachedData<T>(key: keyof OfflineCacheKeys): Promise<T | null> {
    try {
      const cachedData = await AsyncStorage.getItem(STORAGE_KEYS[key]);
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData);
      return parsed.data as T;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  public async clearCache(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Posts management
  public async getPosts(forceOnline: boolean = false): Promise<Post[]> {
    if (this.isOnline && forceOnline) {
      try {
        const posts = await firebaseGetPosts(20);
        await this.cacheData('POSTS', posts);
        return posts;
      } catch (error) {
        console.error('Error fetching posts online:', error);
        // Fall back to cached data
      }
    }

    // Return cached posts
    const cachedPosts = await this.getCachedData<Post[]>('POSTS');
    return cachedPosts || [];
  }

  public async createPost(userId: string, content: string, images?: string[]): Promise<Post> {
    const postData: Omit<Post, 'id' | 'createdAt' | 'likes' | 'comments' | 'shares' | 'likedBy'> = {
      userId,
      content,
      images: images?.map(img => ({
        data: img,
        width: 800,
        height: 600,
        size: img.length
      })) || []
    };

    if (this.isOnline) {
      try {
        const postId = await firebaseCreatePost(postData);
        const newPost: Post = {
          id: postId,
          ...postData,
          likes: 0,
          comments: 0,
          shares: 0,
          likedBy: [],
          createdAt: new Date(),
          synced: true
        };
        
        // Update cache
        await this.addPostToCache(newPost);
        return newPost;
      } catch (error) {
        console.error('Error creating post online:', error);
        // Fall through to offline handling
      }
    }

    // Create offline post
    const offlinePost: Post = {
      id: `offline_${Date.now()}`,
      ...postData,
      likes: 0,
      comments: 0,
      shares: 0,
      likedBy: [],
      createdAt: new Date(),
      isLocal: true,
      synced: false
    };

    // Add to offline actions queue
    await this.addOfflineAction({
      id: `create_post_${Date.now()}`,
      type: 'CREATE_POST',
      userId,
      data: postData,
      timestamp: Date.now()
    });

    // Add to cache
    await this.addPostToCache(offlinePost);
    
    return offlinePost;
  }

  public async likePost(postId: string, userId: string): Promise<void> {
    if (this.isOnline) {
      try {
        await firebaseLikePost(postId, userId);
        await this.updatePostLikeInCache(postId, userId, true);
        return;
      } catch (error) {
        console.error('Error liking post online:', error);
        // Fall through to offline handling
      }
    }

    // Handle offline like
    await this.addOfflineAction({
      id: `like_post_${postId}_${Date.now()}`,
      type: 'LIKE_POST',
      userId,
      data: { postId },
      timestamp: Date.now()
    });

    await this.updatePostLikeInCache(postId, userId, true);
  }

  public async createComment(postId: string, userId: string, text: string): Promise<Comment> {
    const commentData = { postId, userId, text };

    if (this.isOnline) {
      try {
        const commentId = await firebaseCreateComment(commentData);
        const newComment: Comment = {
          id: commentId,
          ...commentData,
          likes: 0,
          createdAt: new Date(),
          synced: true
        };
        return newComment;
      } catch (error) {
        console.error('Error creating comment online:', error);
        // Fall through to offline handling
      }
    }

    // Create offline comment
    const offlineComment: Comment = {
      id: `offline_comment_${Date.now()}`,
      ...commentData,
      likes: 0,
      createdAt: new Date(),
      isLocal: true
    };

    await this.addOfflineAction({
      id: `create_comment_${Date.now()}`,
      type: 'CREATE_COMMENT',
      userId,
      data: commentData,
      timestamp: Date.now()
    });

    return offlineComment;
  }

  // Cache helpers
  private async addPostToCache(post: Post): Promise<void> {
    const cachedPosts = await this.getCachedData<Post[]>('POSTS') || [];
    const updatedPosts = [post, ...cachedPosts.filter(p => p.id !== post.id)];
    await this.cacheData('POSTS', updatedPosts);
  }

  private async updatePostLikeInCache(postId: string, userId: string, liked: boolean): Promise<void> {
    const cachedPosts = await this.getCachedData<Post[]>('POSTS') || [];
    const updatedPosts = cachedPosts.map(post => {
      if (post.id === postId) {
        const likedBy = post.likedBy || [];
        return {
          ...post,
          likes: liked ? post.likes + 1 : post.likes - 1,
          likedBy: liked 
            ? [...likedBy, userId]
            : likedBy.filter(id => id !== userId),
          isLocallyModified: true
        };
      }
      return post;
    });
    await this.cacheData('POSTS', updatedPosts);
  }

  // User data management
  public async getUser(userId: string): Promise<User | null> {
    const cachedUsers = await this.getCachedData<{ [userId: string]: User }>('USERS') || {};
    
    if (cachedUsers[userId]) {
      return cachedUsers[userId];
    }

    if (this.isOnline) {
      try {
        const user = await firebaseGetUser(userId);
        if (user) {
          await this.cacheUser(user);
          return user;
        }
      } catch (error) {
        console.error('Error fetching user online:', error);
      }
    }

    return null;
  }

  public async cacheUser(user: User): Promise<void> {
    const cachedUsers = await this.getCachedData<{ [userId: string]: User }>('USERS') || {};
    cachedUsers[user.id] = user;
    await this.cacheData('USERS', cachedUsers);
  }

  // Offline actions management
  private async addOfflineAction(action: OfflineAction): Promise<void> {
    this.syncQueue.push(action);
    await this.saveOfflineActions();
  }

  private async loadOfflineActions(): Promise<void> {
    try {
      const actions = await this.getCachedData<OfflineAction[]>('ACTIONS');
      this.syncQueue = actions || [];
    } catch (error) {
      console.error('Error loading offline actions:', error);
      this.syncQueue = [];
    }
  }

  private async saveOfflineActions(): Promise<void> {
    await this.cacheData('ACTIONS', this.syncQueue);
  }

  private async clearOfflineActions(): Promise<void> {
    this.syncQueue = [];
    await this.saveOfflineActions();
  }

  // Synchronization
  public async syncOfflineActions(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Syncing ${this.syncQueue.length} offline actions...`);

    const actionsToSync = [...this.syncQueue];
    const failedActions: OfflineAction[] = [];

    for (const action of actionsToSync) {
      try {
        await this.processOfflineAction(action);
        console.log(`Synced action: ${action.type}`);
      } catch (error) {
        console.error(`Failed to sync action ${action.type}:`, error);
        failedActions.push(action);
      }
    }

    // Keep only failed actions in the queue
    this.syncQueue = failedActions;
    await this.saveOfflineActions();

    // Update last sync time
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

    this.syncInProgress = false;
    console.log(`Sync completed. ${failedActions.length} actions failed.`);
  }

  private async processOfflineAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'CREATE_POST':
        await firebaseCreatePost(action.data);
        break;
      
      case 'LIKE_POST':
        await firebaseLikePost(action.data.postId, action.userId);
        break;
      
      case 'CREATE_COMMENT':
        await firebaseCreateComment(action.data);
        break;
      
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  // Sync status
  public async getSyncStatus(): Promise<SyncStatus> {
    const lastSyncTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    
    return {
      pendingActions: this.syncQueue.length,
      lastSyncTime: lastSyncTime ? parseInt(lastSyncTime, 10) : 0,
      syncInProgress: this.syncInProgress,
      isConnected: this.isOnline
    };
  }

  // Manual sync trigger
  public async forcSync(): Promise<void> {
    if (this.isOnline) {
      await this.syncOfflineActions();
      
      // Refresh cached data
      try {
        const posts = await firebaseGetPosts(20);
        await this.cacheData('POSTS', posts);
      } catch (error) {
        console.error('Error refreshing posts during sync:', error);
      }
    }
  }
}

// Export singleton instance
export const offlineService = new OfflineService();

// Export individual functions for easier usage
export const isOnline = (): boolean => offlineService.isConnected();
export const getPosts = (forceOnline?: boolean): Promise<Post[]> => offlineService.getPosts(forceOnline);
export const createPost = (userId: string, content: string, images?: string[]): Promise<Post> => 
  offlineService.createPost(userId, content, images);
export const likePost = (postId: string, userId: string): Promise<void> => 
  offlineService.likePost(postId, userId);
export const createComment = (postId: string, userId: string, text: string): Promise<Comment> => 
  offlineService.createComment(postId, userId, text);
export const getUser = (userId: string): Promise<User | null> => offlineService.getUser(userId);
export const syncOfflineActions = (): Promise<void> => offlineService.syncOfflineActions();
export const getSyncStatus = (): Promise<SyncStatus> => offlineService.getSyncStatus();
export const getNetworkState = (): Promise<NetworkState> => offlineService.getNetworkState();