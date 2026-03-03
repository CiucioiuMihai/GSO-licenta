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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '@/services/firebase';
import { updateUserProfile } from '@/services/firestore';
import { getUserDataWithCounts } from '@/services/postsService';
import { getUserPosts } from '@/services/postsService';
import { User, Post } from '@/types';
import { calculateLevel } from '@/utils/gamification';
import { ACHIEVEMENT_DEFINITIONS } from '@/types';

interface ProfileScreenProps {
  onBack: () => void;
}

const { width } = Dimensions.get('window');

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const [userData, setUserData] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [tempBio, setTempBio] = useState('');
  const [tempProfilePicture, setTempProfilePicture] = useState('');
  const [saving, setSaving] = useState(false);
  const currentUser = auth.currentUser;

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (currentUser) {
      try {
        const data = await getUserDataWithCounts(currentUser.uid);
        setUserData(data);
        setTempBio(data?.bio || '');
        setTempProfilePicture(data?.profilePicture || '');
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
  }, [currentUser]);

  // Fetch user posts
  const fetchUserPosts = useCallback(() => {
    if (currentUser) {
      return getUserPosts(currentUser.uid, (posts) => {
        setUserPosts(posts);
        setLoading(false);
      });
    }
  }, [currentUser]);

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
            <Image
              key={index}
              source={{ uri: image.data }}
              style={styles.postImage}
              resizeMode="cover"
            />
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
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity 
            onPress={() => editMode ? handleSaveProfile() : setEditMode(true)}
            disabled={saving}
          >
            <Text style={styles.editButton}>
              {saving ? '...' : editMode ? '💾 Save' : '✏️ Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Info Card */}
          <View style={styles.profileCard}>
            {/* Profile Picture */}
            <View style={styles.profilePictureContainer}>
              <Image
                source={{
                  uri: editMode ? tempProfilePicture : (userData?.profilePicture || 'https://via.placeholder.com/120')
                }}
                style={styles.profilePicture}
              />
              {editMode && (
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
              {editMode ? (
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
            {editMode && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

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
  scrollView: {
    flex: 1,
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
});

export default ProfileScreen;
