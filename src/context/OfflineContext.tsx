import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { offlineService, getSyncStatus } from '../services/offlineService';
import { NetworkState, SyncStatus } from '../types';

interface OfflineContextType {
  isConnected: boolean;
  networkState: NetworkState;
  syncStatus: SyncStatus;
  forcSync: () => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    connectionType: 'unknown'
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingActions: 0,
    lastSyncTime: 0,
    syncInProgress: false,
    isConnected: true
  });

  const updateSyncStatus = async (): Promise<void> => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  };

  const handleNetworkChange = (state: NetInfoState): void => {
    const connected = state.isConnected ?? false;
    const connectionType = state.type || 'unknown';

    setIsConnected(connected);
    setNetworkState({
      isConnected: connected,
      connectionType
    });

    // Update sync status when network state changes
    updateSyncStatus();

    // If we just came back online, sync automatically
    if (connected && !isConnected) {
      setTimeout(() => {
        offlineService.syncOfflineActions();
      }, 1000); // Small delay to ensure connection is stable
    }
  };

  const forcSync = async (): Promise<void> => {
    try {
      await offlineService.forcSync();
      await updateSyncStatus();
    } catch (error) {
      console.error('Error during forced sync:', error);
    }
  };

  useEffect(() => {
    // Set up network listener
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initial network state check
    NetInfo.fetch().then(handleNetworkChange);

    // Initial sync status update
    updateSyncStatus();

    // Set up periodic sync status updates
    const syncStatusInterval = setInterval(updateSyncStatus, 30000); // Every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(syncStatusInterval);
    };
  }, []);

  // Update sync status when isConnected changes
  useEffect(() => {
    updateSyncStatus();
  }, [isConnected]);

  const value: OfflineContextType = {
    isConnected,
    networkState,
    syncStatus,
    forcSync,
    refreshSyncStatus: updateSyncStatus
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

// Hook for network-aware operations
export const useNetworkAwareOperation = () => {
  const { isConnected } = useOffline();

  const executeWhenOnline = async function<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (isConnected) {
      return operation();
    } else if (fallback) {
      return fallback();
    } else {
      throw new Error('Operation requires internet connection');
    }
  };

  return { executeWhenOnline, isConnected };
};

// Hook for sync status monitoring
export const useSyncStatus = () => {
  const { syncStatus, refreshSyncStatus, forcSync } = useOffline();

  const hasPendingActions = syncStatus.pendingActions > 0;
  const isSyncing = syncStatus.syncInProgress;
  const lastSyncTime = new Date(syncStatus.lastSyncTime);
  const timeSinceLastSync = Date.now() - syncStatus.lastSyncTime;

  return {
    syncStatus,
    hasPendingActions,
    isSyncing,
    lastSyncTime,
    timeSinceLastSync,
    refreshSyncStatus,
    forcSync
  };
};