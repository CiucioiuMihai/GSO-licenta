import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@/services/firebase';
import { getAllReports, updateReportStatus } from '@/services/reportService';
import { Report, User } from '@/types';
import { getUserDataWithCounts } from '@/services/postsService';
import Navbar from '@/components/Navbar';

interface AdminScreenProps {
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
}

type FilterStatus = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';

const AdminScreen: React.FC<AdminScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [resolution, setResolution] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [userData, setUserData] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const currentUser = auth.currentUser;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const data = await getUserDataWithCounts(currentUser.uid);
          setUserData(data);
          
          // Check if user is admin
          if (!data || data.role !== 'admin') {
            Alert.alert('Unauthorized', 'You do not have admin permissions', [
              { text: 'OK', onPress: onBack }
            ]);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserData();
  }, [currentUser]);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const allReports = await getAllReports();
      setReports(allReports);
      applyFilter(allReports, filterStatus);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchReports();
  }, []);

  // Apply filter
  const applyFilter = (reportsList: Report[], status: FilterStatus) => {
    if (status === 'all') {
      setFilteredReports(reportsList);
    } else {
      setFilteredReports(reportsList.filter(r => r.status === status));
    }
  };

  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status);
    applyFilter(reports, status);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const handleReportPress = (report: Report) => {
    setSelectedReport(report);
    setResolution(report.resolution || '');
    setModalVisible(true);
  };

  const handleUpdateStatus = async (status: 'reviewed' | 'resolved' | 'dismissed') => {
    if (!selectedReport) return;

    try {
      await updateReportStatus(selectedReport.id, status, resolution.trim() || undefined);
      Alert.alert('Success', `Report ${status} successfully`);
      setModalVisible(false);
      setSelectedReport(null);
      setResolution('');
      await fetchReports();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update report status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'reviewed':
        return '#4169E1';
      case 'resolved':
        return '#32CD32';
      case 'dismissed':
        return '#DC143C';
      default:
        return '#888';
    }
  };

  const formatDate = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'explore') {
      onNavigateToFriends();
    } else if (tab === 'home') {
      onNavigateToHome();
    } else if (tab === 'create') {
      onNavigateToCreatePost();
    } else if (tab === 'achievements') {
      onNavigateToAchievements();
    } else if (tab === 'profile') {
      onNavigateToProfile();
    }
  };

  const renderReport = ({ item }: { item: Report }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => handleReportPress(item)}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportType}>
          <Text style={styles.reportTypeText}>{item.reportedItem.type.toUpperCase()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.reasonText}>Reason: {item.reason}</Text>
      
      {item.details?.postContent && (
        <Text style={styles.contentPreview} numberOfLines={2}>
          Content: {item.details.postContent}
        </Text>
      )}

      {item.details?.userName && (
        <Text style={styles.detailText}>User: {item.details.userName}</Text>
      )}

      <View style={styles.reportFooter}>
        <Text style={styles.dateText}>Reported: {formatDate(item.createdAt)}</Text>
        {item.reviewedAt && (
          <Text style={styles.dateText}>Reviewed: {formatDate(item.reviewedAt)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#764ba2" />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
          <Navbar activeTab={activeTab} onTabPress={handleTabPress} user={userData} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {(['all', 'pending', 'reviewed', 'resolved', 'dismissed'] as FilterStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.filterButtonActive
              ]}
              onPress={() => handleFilterChange(status)}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Reports List */}
        <FlatList
          data={filteredReports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reports found</Text>
            </View>
          }
        />

        {/* Report Detail Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.95)']}
              style={styles.modalGradient}
            >
              <KeyboardAvoidingView
                style={styles.modalContent}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Report Details</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      setSelectedReport(null);
                      setResolution('');
                    }}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {selectedReport && (
                  <ScrollView
                    style={styles.modalBody}
                    contentContainerStyle={[
                      styles.modalBodyContent,
                      { paddingBottom: keyboardHeight + 24 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Type:</Text>
                      <Text style={styles.detailValue}>{selectedReport.reportedItem.type}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedReport.status) }]}>
                        <Text style={styles.statusText}>{selectedReport.status.toUpperCase()}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Reason:</Text>
                      <Text style={styles.detailValue}>{selectedReport.reason}</Text>
                    </View>

                    {selectedReport.details?.postContent && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Content:</Text>
                        <Text style={styles.detailValue}>{selectedReport.details.postContent}</Text>
                      </View>
                    )}

                    {selectedReport.details?.userName && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Reported User:</Text>
                        <Text style={styles.detailValue}>{selectedReport.details.userName}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Created:</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedReport.createdAt)}</Text>
                    </View>

                    {selectedReport.reviewedAt && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Reviewed:</Text>
                        <Text style={styles.detailValue}>{formatDate(selectedReport.reviewedAt)}</Text>
                      </View>
                    )}

                    {selectedReport.resolution && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Resolution:</Text>
                        <Text style={styles.detailValue}>{selectedReport.resolution}</Text>
                      </View>
                    )}

                    <View style={styles.resolutionContainer}>
                      <Text style={styles.resolutionLabel}>Add/Update Resolution:</Text>
                      <TextInput
                        style={styles.resolutionInput}
                        placeholder="Enter resolution notes..."
                        placeholderTextColor="#888"
                        value={resolution}
                        onChangeText={setResolution}
                        multiline
                        numberOfLines={4}
                      />
                    </View>

                    <View style={styles.actionButtons}>
                      {selectedReport.status === 'pending' && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.reviewButton]}
                          onPress={() => handleUpdateStatus('reviewed')}
                        >
                          <Text style={styles.actionButtonText}>Mark as Reviewed</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.actionButton, styles.resolveButton]}
                        onPress={() => handleUpdateStatus('resolved')}
                      >
                        <Text style={styles.actionButtonText}>Resolve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.dismissButton]}
                        onPress={() => handleUpdateStatus('dismissed')}
                      >
                        <Text style={styles.actionButtonText}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                )}
              </KeyboardAvoidingView>
            </LinearGradient>
          </View>
        </Modal>

        <Navbar activeTab={activeTab} onTabPress={handleTabPress} user={userData} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: 'white',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 24,
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    maxHeight: 50,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(118, 75, 162, 0.8)',
  },
  filterButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  reportCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportType: {
    backgroundColor: 'rgba(118, 75, 162, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  reasonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  contentPreview: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginBottom: 4,
  },
  reportFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalGradient: {
    width: '90%',
    maxWidth: 600,
    height: '85%',
    borderRadius: 15,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingBottom: 24,
  },
  detailRow: {
    marginBottom: 15,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailValue: {
    color: 'white',
    fontSize: 14,
  },
  resolutionContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  resolutionLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  resolutionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionButtons: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButton: {
    backgroundColor: 'rgba(65, 105, 225, 0.8)',
  },
  resolveButton: {
    backgroundColor: 'rgba(50, 205, 50, 0.8)',
  },
  dismissButton: {
    backgroundColor: 'rgba(220, 20, 60, 0.8)',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminScreen;
