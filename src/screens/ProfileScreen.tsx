import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '@/services/firebase';
import { updateUserProfile } from '@/services/firestore';
import { getUserDataWithCounts, followUser, unfollowUser } from '@/services/postsService';
import { getUserPosts } from '@/services/postsService';
import { sendFriendRequest } from '@/services/friendsService';
import { createReport } from '@/services/reportService';
import { User, Post } from '@/types';
import { calculateLevel } from '@/utils/gamification';
import { ACHIEVEMENT_DEFINITIONS } from '@/types';
import Navbar from '@/components/Navbar';

interface ProfileScreenProps {
  userId?: string | null; // Optional userId to view other users' profiles
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
    onNavigateToLeaderboard?: () => void;
  onNavigateToAdmin?: () => void;
}

const { width } = Dimensions.get('window');

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  userId,
  onBack,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToAdmin,
  onNavigateToLeaderboard,
}) => {
  const [userData, setUserData] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [tempProfilePicture, setTempProfilePicture] = useState('');
  const [saving, setSaving] = useState(false);
  const [navbarTab, setNavbarTab] = useState('profile');
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedPostImages, setSelectedPostImages] = useState<any[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isFriendUser, setIsFriendUser] = useState(false);
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const currentUser = auth.currentUser;

  const REPORT_REASONS = [
    'Spam or scam',
    'Harassment or bullying',
    'Hate speech',
    'Inappropriate profile content',
    'Impersonation',
    'Other',
  ];
  
  // Determine if viewing own profile or another user's profile
  const viewingUserId = userId || currentUser?.uid;
  const isOwnProfile = !userId || userId === currentUser?.uid;

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (viewingUserId) {
      try {
        const data = await getUserDataWithCounts(viewingUserId);
        setUserData(data);
        setTempBio(data?.bio || '');
        setTempProfilePicture(data?.profilePicture || '');
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
  }, [viewingUserId]);

  // Fetch user posts
  const fetchUserPosts = useCallback(() => {
    if (viewingUserId) {
      return getUserPosts(viewingUserId, (posts) => {
        setUserPosts(posts);
        setLoading(false);
      });
    }
  }, [viewingUserId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchUserData();
      const unsubscribe = fetchUserPosts();
      return unsubscribe;
    };

    const unsubscribe = loadData();
    
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub());
      }
    };
  }, [fetchUserData, fetchUserPosts]);

  useEffect(() => {
    const loadRelationshipStatus = async () => {
      if (!currentUser || !viewingUserId || isOwnProfile) return;

      try {
        const currentUserDataWithCounts = await getUserDataWithCounts(currentUser.uid);
        setIsFollowingUser(currentUserDataWithCounts?.following?.includes(viewingUserId) || false);
        setIsFriendUser(currentUserDataWithCounts?.friends?.includes(viewingUserId) || false);
      } catch (error) {
        console.error('Error loading relationship status:', error);
      }
    };

    loadRelationshipStatus();
  }, [currentUser, viewingUserId, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (!viewingUserId || !currentUser || isOwnProfile || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowingUser) {
        await unfollowUser(viewingUserId);
        setIsFollowingUser(false);
      } else {
        await followUser(viewingUserId);
        setIsFollowingUser(true);
      }
      await fetchUserData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!viewingUserId || !currentUser || isOwnProfile || sendingFriendRequest) return;

    setSendingFriendRequest(true);
    try {
      await sendFriendRequest(viewingUserId);
      Alert.alert('Success', 'Friend request sent');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setSendingFriendRequest(false);
    }
  };

  const handleReportUser = async () => {
    if (!viewingUserId || !userData) return;
    if (!selectedReportReason) {
      Alert.alert('Choose a reason', 'Please select a report reason.');
      return;
    }

    try {
      await createReport('user', viewingUserId, selectedReportReason, {
        userId: viewingUserId,
        userName: userData.displayName,
      });
      setReportModalVisible(false);
      setSelectedReportReason('');
      Alert.alert('Reported', 'Thank you. Your report has been submitted.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    }
  };

  const handleNavbarTabPress = (tab: string) => {
    setNavbarTab(tab);
    if (tab === 'explore') {
      onNavigateToFriends();
    } else if (tab === 'home') {
      onNavigateToHome();
    } else if (tab === 'create') {
      onNavigateToCreatePost();
    } else if (tab === 'achievements') {
      onNavigateToAchievements();
    } else if (tab === 'profile') {
      // Already on profile screen
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  const pickProfileImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = `data:image/jpeg;base64,${asset.base64}`;
        setTempProfilePicture(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    setSaving(true);
    try {
      const updates: Partial<User> = {
        bio: tempBio.trim(),
      };

      // Only update profile picture if it changed
      if (tempProfilePicture !== userData?.profilePicture) {
        updates.profilePicture = tempProfilePicture;
      }

      await updateUserProfile(currentUser.uid, updates);
      
      // Refresh user data
      await fetchUserData();
      
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTempBio(userData?.bio || '');
    setTempProfilePicture(userData?.profilePicture || '');
    setEditMode(false);
  };

  const formatTime = (date: any) => {
    if (!date) return '';
    const postDate = date instanceof Date ? date : date.toDate();
    const now = new Date();
    const diff = now.getTime() - postDate.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleImagePress = (imageUri: string, images: any[], index: number) => {
    setSelectedImage(imageUri);
    setSelectedPostImages(images);
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? (selectedImageIndex - 1 + selectedPostImages.length) % selectedPostImages.length
      : (selectedImageIndex + 1) % selectedPostImages.length;

    setSelectedImageIndex(newIndex);
    setSelectedImage(selectedPostImages[newIndex].data);
  };

  const handleDownloadImage = async () => {
    try {
      if (!selectedImage) {
        Alert.alert('Error', 'No image available to download.');
        return;
      }

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = selectedImage;
        link.download = `gso-profile-image-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const FileSystem = await import('expo-file-system/legacy');
      const MediaLibrary = await import('expo-media-library');

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow media library access to save images.');
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}gso-profile-image-${Date.now()}.jpg`;
      let localUri = fileUri;

      if (selectedImage.startsWith('data:image')) {
        const base64Data = selectedImage.split(',')[1] || '';
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        const downloadResult = await FileSystem.downloadAsync(selectedImage, fileUri);
        localUri = downloadResult.uri;
      }

      const asset = await MediaLibrary.createAssetAsync(localUri);
      await MediaLibrary.createAlbumAsync('GSO', asset, false).catch(() => {});
      Alert.alert('Saved', 'Image downloaded to your gallery.');
    } catch (error: any) {
      Alert.alert(
        'Download unavailable',
        'Native download module is not ready. Rebuild the Android app/dev client after installing new Expo modules.'
      );
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <Text style={styles.postContent}>{item.content}</Text>
      
      {item.images && item.images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.postImagesContainer}
        >
          {item.images.map((image, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleImagePress(image.data, item.images!, index)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: image.data }}
                style={styles.postImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      <View style={styles.postFooter}>
        <Text style={styles.postStats}>
          ❤️ {item.likes} · 💬 {item.comments}
        </Text>
        <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isOwnProfile ? 'Profile' : userData?.displayName || 'Profile'}
          </Text>
          {isOwnProfile ? (
            <TouchableOpacity 
              onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
              disabled={saving}
            >
              <Text style={styles.editButton}>
                {saving ? '...' : editMode ? '💾 Save' : '✏️ Edit'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRight} />
          )}
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Info Card */}
          <View style={styles.profileCard}>
            {/* Profile Picture */}
            <View style={styles.profilePictureContainer}>
              <Image
                source={{
                  uri: (editMode && isOwnProfile) ? tempProfilePicture : (userData?.profilePicture || 'https://via.placeholder.com/120')
                }}
                style={styles.profilePicture}
              />
              {editMode && isOwnProfile && (
                <TouchableOpacity 
                  style={styles.changePictureButton}
                  onPress={pickProfileImage}
                >
                  <Text style={styles.changePictureText}>📷</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* User Name */}
            <Text style={styles.displayName}>{userData?.displayName}</Text>

            {!isOwnProfile && (
              <View style={styles.relationshipRow}>
                {isFriendUser ? (
                  <View style={styles.friendBadge}>
                    <Text style={styles.friendBadgeText}>Friend</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.relationshipButton, styles.friendActionButton]}
                    onPress={handleSendFriendRequest}
                    disabled={sendingFriendRequest}
                  >
                    <Text style={styles.relationshipButtonText}>
                      {sendingFriendRequest ? 'Sending...' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isFollowingUser ? (
                  <TouchableOpacity style={styles.followingBadge} onPress={handleFollowToggle} disabled={followLoading}>
                    <Text style={styles.followingBadgeText}>Following</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.relationshipButton, styles.followActionButton]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    <Text style={styles.relationshipButtonText}>
                      {followLoading ? 'Working...' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.reportUserButton}
                onPress={() => setReportModalVisible(true)}
              >
                <Text style={styles.reportUserButtonText}>Report User</Text>
              </TouchableOpacity>
            )}
            
            {/* Level */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>
                Level {userData?.level || calculateLevel(userData?.xp || 0)}
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userData?.xp || 0}</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userData?.totalPosts || 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userData?.totalFriends || 0}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userData?.totalFollowers || 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>

            {/* Bio */}
            <View style={styles.bioContainer}>
              <Text style={styles.bioLabel}>About Me</Text>
              {editMode && isOwnProfile ? (
                <TextInput
                  style={styles.bioInput}
                  value={tempBio}
                  onChangeText={setTempBio}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  multiline
                  maxLength={200}
                />
              ) : (
                <Text style={styles.bioText}>
                  {userData?.bio || 'No bio yet. Add one to tell people about yourself!'}
                </Text>
              )}
            </View>

            {/* Cancel button in edit mode */}
            {editMode && isOwnProfile && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Admin Dashboard Button */}
          {isOwnProfile && userData?.role === 'admin' && onNavigateToAdmin && (
            <TouchableOpacity 
              style={styles.adminButton}
              onPress={onNavigateToAdmin}
            >
              <LinearGradient
                colors={['rgba(220, 20, 60, 0.8)', 'rgba(139, 0, 0, 0.8)']}
                style={styles.adminButtonGradient}
              >
                <Text style={styles.adminButtonIcon}>⚠️</Text>
                <Text style={styles.adminButtonText}>Admin Dashboard</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Achievements Section */}
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>
              🏆 Achievements ({userData?.achievements?.length || 0}/{ACHIEVEMENT_DEFINITIONS.length})
            </Text>
            
            {userData && userData.achievements && userData.achievements.length > 0 ? (
              <View style={styles.achievementsGrid}>
                {userData.achievements.map((achievement) => {
                  const definition = ACHIEVEMENT_DEFINITIONS.find(def => def.id === achievement.id);
                  if (!definition) return null;
                  
                  return (
                    <View key={achievement.id} style={styles.achievementCard}>
                      <Text style={styles.achievementIcon}>{definition.icon}</Text>
                      <Text style={styles.achievementTitle}>{definition.title}</Text>
                      <Text style={styles.achievementDescription} numberOfLines={2}>
                        {definition.description}
                      </Text>
                      <View style={styles.achievementXPBadge}>
                        <Text style={styles.achievementXP}>+{definition.xpReward} XP</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyAchievements}>
                <Text style={styles.emptyAchievementsText}>No achievements yet</Text>
                <Text style={styles.emptyAchievementsSubtext}>
                  Keep posting, making friends, and engaging to unlock achievements!
                </Text>
              </View>
            )}
          </View>

          {/* My Posts Section */}
          <View style={styles.postsSection}>
            <Text style={styles.sectionTitle}>My Posts ({userPosts.length})</Text>
            
            {userPosts.length === 0 ? (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyPostsText}>No posts yet</Text>
                <Text style={styles.emptyPostsSubtext}>Start sharing your thoughts!</Text>
              </View>
            ) : (
              <View>
                {userPosts.map((post) => (
                  <View key={post.id}>
                    {renderPost({ item: post })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Image Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={imageModalVisible}
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.imageModalContainer}>
            <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']} style={styles.imageModalGradient}>
              <SafeAreaView style={styles.imageModalContent}>
                <View style={styles.imageModalHeader}>
                  <TouchableOpacity
                    style={styles.closeImageButton}
                    onPress={() => setImageModalVisible(false)}
                  >
                    <Text style={styles.closeImageButtonText}>✕</Text>
                  </TouchableOpacity>

                  <View style={styles.imageHeaderRight}>
                    {selectedPostImages.length > 1 && (
                      <Text style={styles.imageCounter}>
                        {selectedImageIndex + 1} / {selectedPostImages.length}
                      </Text>
                    )}
                    <TouchableOpacity style={styles.downloadImageButton} onPress={handleDownloadImage}>
                      <Text style={styles.downloadImageButtonText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.imageModalImageContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} resizeMode="contain" />

                  {selectedPostImages.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={[styles.imageNavButton, styles.prevButton]}
                        onPress={() => navigateImage('prev')}
                      >
                        <Text style={styles.imageNavText}>‹</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imageNavButton, styles.nextButton]}
                        onPress={() => navigateImage('next')}
                      >
                        <Text style={styles.imageNavText}>›</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </SafeAreaView>
            </LinearGradient>
          </View>
        </Modal>

        {/* Report User Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={reportModalVisible}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.reportModalContainer}>
            <LinearGradient colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.92)']} style={styles.reportModalGradient}>
              <View style={styles.reportModalHeader}>
                <Text style={styles.reportModalTitle}>Report User</Text>
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <Text style={styles.closeImageButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.reportModalSubtitle}>Choose a reason:</Text>
              <View style={styles.reasonList}>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonOption,
                      selectedReportReason === reason && styles.reasonOptionSelected,
                    ]}
                    onPress={() => setSelectedReportReason(reason)}
                  >
                    <Text
                      style={[
                        styles.reasonOptionText,
                        selectedReportReason === reason && styles.reasonOptionTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitReportButton} onPress={handleReportUser}>
                <Text style={styles.submitReportButtonText}>Submit Report</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
        
        {/* Navbar */}
        <Navbar activeTab={navbarTab} onTabPress={handleNavbarTabPress} user={userData} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 70 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  backButton: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  editButton: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  headerRight: {
    width: 60, // Same width as edit button to maintain centering
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 15,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#667eea',
  },
  changePictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#667eea',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  changePictureText: {
    fontSize: 18,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  levelText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  relationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 8,
  },
  relationshipButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  friendActionButton: {
    backgroundColor: 'rgba(118, 75, 162, 0.75)',
  },
  followActionButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.75)',
  },
  relationshipButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  friendBadge: {
    backgroundColor: 'rgba(118, 75, 162, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  friendBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingBadge: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: 'rgba(46, 204, 113, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  followingBadgeText: {
    color: '#B8F7D4',
    fontSize: 12,
    fontWeight: '700',
  },
  reportUserButton: {
    marginBottom: 14,
    backgroundColor: 'rgba(220, 53, 69, 0.12)',
    borderColor: 'rgba(220, 53, 69, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  reportUserButtonText: {
    color: '#b22222',
    fontSize: 12,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
  },
  bioContainer: {
    width: '100%',
    marginBottom: 15,
  },
  bioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bioInput: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  cancelButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#e74c3c',
    fontWeight: '600',
    textAlign: 'center',
  },
  postsSection: {
    margin: 15,
    marginTop: 0,
  },
  achievementsSection: {
    margin: 15,
    marginTop: 0,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    width: '48%',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  achievementIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementXPBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  achievementXP: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  emptyAchievements: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  emptyAchievementsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  emptyAchievementsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  postCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 10,
  },
  postImagesContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginRight: 8,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  postStats: {
    fontSize: 12,
    color: '#666',
  },
  postTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyPosts: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  emptyPostsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  emptyPostsSubtext: {
    fontSize: 14,
    color: '#666',
  },
  adminButton: {
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  adminButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  adminButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  adminButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  reportModalGradient: {
    width: '88%',
    borderRadius: 16,
    padding: 18,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  reportModalSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    marginBottom: 10,
  },
  reasonList: {
    gap: 8,
  },
  reasonOption: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(220,53,69,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.8)',
  },
  reasonOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  reasonOptionTextSelected: {
    fontWeight: '700',
  },
  submitReportButton: {
    backgroundColor: '#b22222',
    borderRadius: 10,
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitReportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  imageModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalGradient: {
    flex: 1,
    width: '100%',
  },
  imageModalContent: {
    flex: 1,
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  closeImageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imageCounter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadImageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  downloadImageButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  imageModalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prevButton: {
    left: 14,
  },
  nextButton: {
    right: 14,
  },
  imageNavText: {
    color: 'white',
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '700',
  },
});

export default ProfileScreen;
