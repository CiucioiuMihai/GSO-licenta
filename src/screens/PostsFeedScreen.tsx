import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, Comment, User } from '@/types';
import { 
  getPosts, 
  likePost, 
  getUserData, 
  addComment, 
  getPostComments, 
  likeComment,
  addReply,
  getCommentReplies,
  getPostsFromFollowing,
  getPostsFromFriends,
  getPostsByTagStatic,
  followUser,
  unfollowUser,
  getUserDataWithCounts
} from '@/services/postsService';
import { auth } from '@/services/firebase';

interface PostsFeedScreenProps {
  onCreatePost: () => void;
  onBack: () => void;
}

const { width } = Dimensions.get('window');

type FilterType = 'all' | 'following' | 'friends' | 'tag';

const PostsFeedScreen: React.FC<PostsFeedScreenProps> = ({ onCreatePost, onBack }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsWithUsers, setPostsWithUsers] = useState<(Post & { user: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [commentsWithUsers, setCommentsWithUsers] = useState<(Comment & { user: User })[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedPostImages, setSelectedPostImages] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const currentUser = auth.currentUser;

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (currentUser) {
        const userData = await getUserDataWithCounts(currentUser.uid);
        setCurrentUserData(userData);
      }
    };
    fetchCurrentUser();
  }, [currentUser]);

  // Fetch posts based on active filter
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe: (() => void) | undefined;
    
    const setupPosts = async () => {
      if (activeFilter === 'all' || (activeFilter === 'tag' && !tagFilter.trim())) {
        // Only use real-time listener for 'all' posts
        unsubscribe = getPosts((newPosts) => {
          setPosts(newPosts);
          loadUsersForPosts(newPosts);
        }, 20);
      } else {
        // For filtered views, use static fetch
        setLoading(true);
        try {
          let fetchedPosts: Post[] = [];
          
          switch (activeFilter) {
            case 'following':
              fetchedPosts = await getPostsFromFollowing(currentUser.uid);
              break;
            case 'friends':
              fetchedPosts = await getPostsFromFriends(currentUser.uid);
              break;
            case 'tag':
              fetchedPosts = await getPostsByTagStatic(tagFilter.trim());
              break;
          }
          
          setPosts(fetchedPosts);
          loadUsersForPosts(fetchedPosts);
        } catch (error) {
          console.error('Error fetching posts:', error);
          setLoading(false);
        }
      }
    };

    setupPosts();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, activeFilter, tagFilter]);

  const loadUsersForPosts = async (posts: Post[]) => {
    try {
      const postsWithUserData = await Promise.all(
        posts.map(async (post) => {
          const user = await getUserData(post.userId);
          return { ...post, user: user! };
        })
      );
      setPostsWithUsers(postsWithUserData.filter(p => p.user));
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading users for posts:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCommentsForPost = (postId: string) => {
    return getPostComments(postId, async (comments) => {
      setPostComments(comments);
      // Load users for comments
      const commentsWithUserData = await Promise.all(
        comments.map(async (comment) => {
          const user = await getUserData(comment.userId);
          return { ...comment, user: user! };
        })
      );
      setCommentsWithUsers(commentsWithUserData.filter(c => c.user));
    });
  };

  const handleLikePost = async (postId: string) => {
    try {
      await likePost(postId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to like post');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      await likeComment(commentId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to like comment');
    }
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

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedPost) return;

    setLoadingComment(true);
    try {
      await addComment(selectedPost.id, commentText.trim());
      setCommentText('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add comment');
    } finally {
      setLoadingComment(false);
    }
  };

  const openComments = (post: Post) => {
    setSelectedPost(post);
    setShowComments(true);
    const unsubscribe = loadCommentsForPost(post.id);
    // Store unsubscribe function if needed later
  };

  const closeComments = () => {
    setShowComments(false);
    setSelectedPost(null);
    setPostComments([]);
    setCommentsWithUsers([]);
    setCommentText('');
  };

  const onRefresh = () => {
    setRefreshing(true);
    // The useEffect will handle reloading through the listener
  };

  const handleTagSearch = () => {
    // Trigger re-fetch by updating a dummy state or just forcing the useEffect
    if (activeFilter === 'tag' && tagFilter.trim()) {
      // The useEffect will automatically trigger when dependencies change
      // This is just for explicit search button press - we can force it
      setLoading(true);
      const fetchTagPosts = async () => {
        try {
          const fetchedPosts = await getPostsByTagStatic(tagFilter.trim());
          setPosts(fetchedPosts);
          loadUsersForPosts(fetchedPosts);
        } catch (error) {
          console.error('Error fetching posts by tag:', error);
          setLoading(false);
        }
      };
      fetchTagPosts();
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handleFollowUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      await followUser(userId);
      // Refresh current user data to update following list
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You are now following this user!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to follow user');
    }
  };

  const handleUnfollowUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      await unfollowUser(userId);
      // Refresh current user data to update following list
      const userData = await getUserDataWithCounts(currentUser.uid);
      setCurrentUserData(userData);
      Alert.alert('Success', 'You have unfollowed this user');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    }
  };

  const isFollowing = (userId: string): boolean => {
    return currentUserData?.following?.includes(userId) || false;
  };

  const isFriend = (userId: string): boolean => {
    return currentUserData?.friends?.includes(userId) || false;
  };

  const renderPost = ({ item }: { item: Post & { user: User } }) => {
    const isLiked = item.likedBy.includes(currentUser?.uid || '');
    const isOwnPost = item.userId === currentUser?.uid;
    const userIsFriend = isFriend(item.userId);
    const userIsFollowed = isFollowing(item.userId);
    
    return (
      <View style={styles.postContainer}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <Image
            source={{
              uri: item.user.profilePicture || 'https://via.placeholder.com/40'
            }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.username}>{item.user.displayName}</Text>
              {!isOwnPost && !userIsFriend && (
                <TouchableOpacity
                  style={[styles.followButton, userIsFollowed && styles.followingButton]}
                  onPress={() => userIsFollowed ? handleUnfollowUser(item.userId) : handleFollowUser(item.userId)}
                >
                  <Text style={[styles.followButtonText, userIsFollowed && styles.followingButtonText]}>
                    {userIsFollowed ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
              {userIsFriend && (
                <View style={styles.friendBadge}>
                  <Text style={styles.friendBadgeText}>Friend</Text>
                </View>
              )}
            </View>
            <View style={styles.postMeta}>
              <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <Text key={index} style={styles.tag}>#{tag}</Text>
                  ))}
                  {item.tags.length > 3 && (
                    <Text style={styles.tag}>+{item.tags.length - 3}</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Post Content */}
        <Text style={styles.postContent}>{item.content}</Text>

        {/* Post Images */}
        {item.images && item.images.length > 0 && (
          <View style={styles.imagesContainer}>
            {item.images.length === 1 ? (
              // Single image - full width
              <TouchableOpacity 
                onPress={() => handleImagePress(item.images![0].data, item.images!, 0)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: item.images[0].data }}
                  style={styles.singlePostImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              // Multiple images - grid layout
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imagesContent}
              >
                {item.images.map((image, index) => (
                  <TouchableOpacity 
                    key={index}
                    onPress={() => handleImagePress(image.data, item.images!, index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: image.data }}
                      style={styles.multiplePostImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={[styles.actionButton, isLiked && styles.likedButton]}
            onPress={() => handleLikePost(item.id)}
          >
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {isLiked ? '❤️' : '🤍'} {item.likes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openComments(item)}
          >
            <Text style={styles.actionText}>💬 {item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>🔄 {item.shares}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment & { user: User } }) => {
    const isLiked = item.likedBy.includes(currentUser?.uid || '');
    
    return (
      <View style={styles.commentContainer}>
        <Image
          source={{
            uri: item.user.profilePicture || 'https://via.placeholder.com/30'
          }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername}>{item.user.displayName}</Text>
            <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={[styles.commentAction, isLiked && styles.likedAction]}
              onPress={() => handleLikeComment(item.id)}
            >
              <Text style={[styles.commentActionText, isLiked && styles.likedCommentText]}>
                {isLiked ? '❤️' : '🤍'} {item.likes}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.commentAction}>
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderCommentsModal = () => (
    <Modal
      visible={showComments}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeComments}
    >
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.modalContainer}>
        <SafeAreaView style={styles.modalSafeArea}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeComments}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {/* Comments List */}
          <FlatList
            data={commentsWithUsers}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            style={styles.commentsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyComments}>No comments yet. Be the first to comment!</Text>
            }
          />

          {/* Add Comment */}
          <View style={styles.addCommentContainer}>
            <Image
              source={{
                uri: currentUser?.photoURL || 'https://via.placeholder.com/30'
              }}
              style={styles.commentAvatar}
            />
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendCommentButton, !commentText.trim() && styles.sendCommentDisabled]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || loadingComment}
            >
              <Text style={styles.sendCommentText}>
                {loadingComment ? '...' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Posts</Text>
          <TouchableOpacity style={styles.createButton} onPress={onCreatePost}>
            <Text style={styles.createButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
                All Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'following' && styles.filterTabActive]}
              onPress={() => setActiveFilter('following')}
            >
              <Text style={[styles.filterTabText, activeFilter === 'following' && styles.filterTabTextActive]}>
                Following
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'friends' && styles.filterTabActive]}
              onPress={() => setActiveFilter('friends')}
            >
              <Text style={[styles.filterTabText, activeFilter === 'friends' && styles.filterTabTextActive]}>
                Friends
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === 'tag' && styles.filterTabActive]}
              onPress={() => setActiveFilter('tag')}
            >
              <Text style={[styles.filterTabText, activeFilter === 'tag' && styles.filterTabTextActive]}>
                By Tag
              </Text>
            </TouchableOpacity>
          </ScrollView>
          {activeFilter === 'tag' && (
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Enter tag..."
                placeholderTextColor="#999"
                value={tagFilter}
                onChangeText={setTagFilter}
                onSubmitEditing={handleTagSearch}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.tagSearchButton} onPress={handleTagSearch}>
                <Text style={styles.tagSearchButtonText}>🔍</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Posts Feed */}
        <View style={styles.feedWrapper}>
          <FlatList
            data={postsWithUsers}
            renderItem={renderPost}
            keyExtractor={(item) => item.id}
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No posts yet.</Text>
                  <Text style={styles.emptySubtext}>Be the first to share something!</Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={onCreatePost}>
                    <Text style={styles.emptyButtonText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        </View>

        {/* Comments Modal */}
        {renderCommentsModal()}
        
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
                {/* Header */}
                <View style={styles.imageModalHeader}>
                  <TouchableOpacity 
                    style={styles.closeImageButton} 
                    onPress={() => setImageModalVisible(false)}
                  >
                    <Text style={styles.closeImageButtonText}>✕</Text>
                  </TouchableOpacity>
                  {selectedPostImages.length > 1 && (
                    <Text style={styles.imageCounter}>
                      {selectedImageIndex + 1} / {selectedPostImages.length}
                    </Text>
                  )}
                </View>
                
                {/* Image */}
                <View style={styles.imageModalImageContainer}>
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                  />
                  
                  {/* Navigation arrows for multiple images */}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    color: 'white',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  createButtonText: {
    fontSize: 16,
  },
  feedWrapper: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  feed: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
  },
  feedContent: {
    paddingBottom: 20,
  },
  postContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: Platform.OS === 'web' ? 15 : 15,
    marginHorizontal: Platform.OS === 'web' ? 0 : 15,
    padding: 15,
    borderRadius: 15,
  },
  postHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginRight: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 5,
  },
  postContent: {
    color: 'white',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  imagesContainer: {
    marginBottom: 10,
  },
  imagesContent: {
    paddingRight: 10,
  },
  singlePostImage: {
    width: '100%',
    height: Platform.OS === 'web' ? 400 : 300,
    borderRadius: 10,
  },
  multiplePostImage: {
    width: Platform.OS === 'web' ? 280 : 220,
    height: Platform.OS === 'web' ? 350 : 280,
    borderRadius: 10,
    marginRight: 10,
  },
  postImage: {
    width: width - 80,
    height: 200,
    borderRadius: 10,
    marginRight: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  likedButton: {
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    borderRadius: 15,
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  likedText: {
    color: '#ff69b4',
  },
  // Comments Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCloseText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalHeaderSpacer: {
    width: 18,
  },
  commentsList: {
    flex: 1,
    padding: 15,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  commentUsername: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 10,
  },
  commentTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 5,
  },
  commentActions: {
    flexDirection: 'row',
  },
  commentAction: {
    marginRight: 15,
  },
  likedAction: {
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  commentActionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  likedCommentText: {
    color: '#ff69b4',
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: 'white',
    maxHeight: 80,
    marginHorizontal: 10,
  },
  sendCommentButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCommentDisabled: {
    opacity: 0.5,
  },
  sendCommentText: {
    color: 'white',
    fontSize: 16,
  },
  emptyComments: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 50,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Image Modal Styles
  imageModalContainer: {
    flex: 1,
  },
  imageModalGradient: {
    flex: 1,
  },
  imageModalContent: {
    flex: 1,
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  closeImageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeImageButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageCounter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  imageModalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
  },
  prevButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  imageNavText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  // Filter styles
  filterContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterScroll: {
    paddingHorizontal: 15,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterTabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  tagInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 10,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    marginRight: 10,
  },
  tagSearchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSearchButtonText: {
    fontSize: 16,
  },
  // Follow button styles
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  followButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  followButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  followingButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  friendBadge: {
    backgroundColor: 'rgba(118, 75, 162, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  friendBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default PostsFeedScreen;