import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useOffline, useSyncStatus } from '../context/OfflineContext';
import { formatTimeAgo } from '../utils/helpers';

interface OfflineIndicatorProps {
  style?: any;
  showSyncButton?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  style, 
  showSyncButton = true 
}) => {
  const { isConnected, networkState } = useOffline();
  const { 
    hasPendingActions, 
    isSyncing, 
    lastSyncTime, 
    timeSinceLastSync,
    forcSync 
  } = useSyncStatus();

  // Don't show anything if online and no pending actions
  if (isConnected && !hasPendingActions && !isSyncing) {
    return null;
  }

  const getStatusColor = (): string => {
    if (!isConnected) return '#FF6B6B'; // Red for offline
    if (isSyncing) return '#FFA500'; // Orange for syncing
    if (hasPendingActions) return '#FFD700'; // Yellow for pending
    return '#4CAF50'; // Green for synced
  };

  const getStatusText = (): string => {
    if (!isConnected) {
      return `Offline • ${networkState.connectionType}`;
    }
    if (isSyncing) {
      return 'Syncing...';
    }
    if (hasPendingActions) {
      return `${hasPendingActions} items to sync`;
    }
    return 'Synced';
  };

  const getLastSyncText = (): string => {
    if (timeSinceLastSync === 0) return '';
    return `Last sync: ${formatTimeAgo(lastSyncTime)}`;
  };

  const handleSyncPress = (): void => {
    if (isConnected && !isSyncing) {
      forcSync();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
      <View style={styles.content}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {getLastSyncText() && (
          <Text style={styles.lastSyncText}>{getLastSyncText()}</Text>
        )}
      </View>
      
      {showSyncButton && isConnected && hasPendingActions && !isSyncing && (
        <TouchableOpacity 
          style={styles.syncButton} 
          onPress={handleSyncPress}
          activeOpacity={0.7}
        >
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    marginTop: 50,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  lastSyncText: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

// Alternative compact version for bottom tab bar or other tight spaces
export const CompactOfflineIndicator: React.FC = () => {
  const { isConnected } = useOffline();
  const { hasPendingActions, isSyncing } = useSyncStatus();

  // Only show when offline or has pending actions
  if (isConnected && !hasPendingActions && !isSyncing) {
    return null;
  }

  const getColor = (): string => {
    if (!isConnected) return '#FF6B6B';
    if (isSyncing) return '#FFA500';
    return '#FFD700';
  };

  return (
    <View style={compactStyles.container}>
      <View style={[compactStyles.dot, { backgroundColor: getColor() }]} />
    </View>
  );
};

const compactStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1000,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export { OfflineIndicator as default };