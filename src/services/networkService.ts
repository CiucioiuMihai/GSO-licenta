import NetInfo from '@react-native-community/netinfo';
import { 
  getOfflineQueue, 
  removeFromOfflineQueue, 
  clearOfflineQueue,
  setLastSyncTime,
  getLastSyncTime,
  getCachedPosts,
  cachePosts,
  getCachedUserProfile,
  cacheUserProfile,
  getCachedLeaderboard,
  cacheLeaderboard
} from './offlineStorage';
import {
  createPost,
  likePost,
  createComment,
  updateUserProfile,
  getLeaderboard,
  getPosts,
  addUserXP
} from './firestore';
import { OfflineAction, NetworkState, SyncStatus } from '../types';

type NetworkListener = (isConnected: boolean, connectionType: string) => void;

class NetworkService {
  private isConnected: boolean = true;
  private connectionType: string = 'wifi';
  private syncInProgress: boolean = false;
  private listeners: NetworkListener[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Listen to network state changes
    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;
      this.connectionType = state.type;
      
      console.log('Network state changed:', {
        isConnected: this.isConnected,
        type: this.connectionType
      });

      // Notify listeners
      this.listeners.forEach(listener => listener(this.isConnected, this.connectionType));
      
      // Trigger sync if connection restored
      if (!wasConnected && this.isConnected) {
        this.syncOfflineActions();
      }
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      this.isConnected = state.isConnected ?? false;
      this.connectionType = state.type;
    });
  }

  // Add listener for network state changes
  addNetworkListener(listener: NetworkListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Get current network state
  getNetworkState(): NetworkState {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType
    };
  }

  // Check if connected
  isOnline(): boolean {
    return this.isConnected;
  }

  // Sync offline actions when connection is restored
  async syncOfflineActions(): Promise<void> {
    if (!this.isConnected || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    console.log('Starting offline sync...');

    try {
      const offlineQueue = await getOfflineQueue();
      console.log(`Syncing ${offlineQueue.length} offline actions`);

      for (const action of offlineQueue) {
        try {
          await this.processOfflineAction(action);
          await removeFromOfflineQueue(action.id);
          console.log(`Synced action: ${action.type}`);
        } catch (error) {
          console.error(`Failed to sync action ${action.type}:`, error);
          // Keep failed actions in queue for retry
        }
      }

      // Update last sync time
      await setLastSyncTime();
      
      // Refresh cached data
      await this.refreshCacheData();

      console.log('Offline sync completed');
    } catch (error) {
      console.error('Error during offline sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Process individual offline actions
  private async processOfflineAction(action: OfflineAction): Promise<any> {
    switch (action.type) {
      case 'CREATE_POST':
        return await createPost(action.data);
      
      case 'LIKE_POST':
        return await likePost(action.postId!, action.userId);
      
      case 'CREATE_COMMENT':
        return await createComment({
          postId: action.postId!,
          userId: action.userId,
          text: action.text!
        });
      
      case 'UPDATE_PROFILE':
        return await updateUserProfile(action.userId, action.updates!);
      
      case 'ADD_XP':
        return await addUserXP(action.userId, action.amount!);
      
      default:
        console.warn(`Unknown offline action type: ${action.type}`);
    }
  }

  // Refresh cached data from server
  private async refreshCacheData(): Promise<void> {
    try {
      // Refresh posts cache
      const posts = await getPosts(20);
      await cachePosts(posts);

      // Refresh leaderboard cache
      const leaderboard = await getLeaderboard();
      await cacheLeaderboard(leaderboard);

      console.log('Cache data refreshed');
    } catch (error) {
      console.error('Error refreshing cache:', error);
    }
  }

  // Force sync now
  async forceSync(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('No internet connection');
    }
    
    await this.syncOfflineActions();
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatus> {
    const offlineQueue = await getOfflineQueue();
    const lastSync = await getLastSyncTime();
    
    return {
      pendingActions: offlineQueue.length,
      lastSyncTime: lastSync,
      syncInProgress: this.syncInProgress,
      isConnected: this.isConnected
    };
  }
}

// Export singleton instance
export default new NetworkService();