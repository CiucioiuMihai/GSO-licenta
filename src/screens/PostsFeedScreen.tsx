import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Post, Comment, User, Reply } from '@/types';
import { 
  getPosts, 
  getPostsPaginated,
  likePost, 
  getUserData, 
  addComment, 
  getPostComments, 
  likeComment,
  likeReply,
  addReply,
  getCommentReplies,
  getPostsFromFollowing,
  getPostsFromFriends,
  getPostsByTagStatic,
  followUser,
  unfollowUser,
  getUserDataWithCounts
} from '@/services/postsService';
import { createReport } from '@/services/reportService';
import { auth } from '@/services/firebase';
import Navbar from '@/components/Navbar';

interface PostsFeedScreenProps {
  onCreatePost: () => void;
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

const { width } = Dimensions.get('window');

type FilterType = 'all' | 'following' | 'friends' | 'tag';
const MAX_FEED_POSTS = 20;

const PostsFeedScreen: React.FC<PostsFeedScreenProps> = ({ 
  onCreatePost, 
  onBack,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToLeaderboard,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsWithUsers, setPostsWithUsers] = useState<(Post & { user: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
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
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set());
  const [likingComments, setLikingComments] = useState<Set<string>>(new Set());
  const [likingReplies, setLikingReplies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('explore');
  const [replyingTo, setReplyingTo] = useState<(Comment & { user: User }) | null>(null);
  const [repliesWithUsers, setRepliesWithUsers] = useState<{ [commentId: string]: (Reply & { user: User })[] }>({});
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingPost, setReportingPost] = useState<(Post & { user: User }) | null>(null);
  const [reportReason, setReportReason] = useState('');
  const currentUser = auth.currentUser;

  const capPosts = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    if (items.length <= MAX_FEED_POSTS) return items;
    return items.slice(items.length - MAX_FEED_POSTS);
  }, []);

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
        // Use paginated fetch for 'all' posts with infinite scroll
        setLoading(true);
        try {
          const result = await getPostsPaginated(3);
          console.log(`📥 Loaded ${result.posts.length} posts (initial load)`);
          setPosts(capPosts(result.posts));
          setLastVisibleDoc(result.lastVisible);
          setHasMore(result.hasMore);
          loadUsersForPosts(capPosts(result.posts));
        } catch (error) {
          console.error('Error fetching initial posts:', error);
          setLoading(false);
        }
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
          
          setPosts(capPosts(fetchedPosts));
          loadUsersForPosts(capPosts(fetchedPosts));
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

  // Load more posts for infinite scroll
  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || activeFilter !== 'all') return;

    setIsLoadingMore(true);
    try {
      const result = await getPostsPaginated(3, lastVisibleDoc);
      console.log(`📥 Loaded ${result.posts.length} more posts (page ${Math.floor(posts.length / 3) + 1})`);
      
      // Filter out any posts that already exist (prevent duplicates)
      const existingPostIds = new Set(posts.map(p => p.id));
      const newPosts = result.posts.filter(p => !existingPostIds.has(p.id));
      
      setPosts(prevPosts => capPosts([...prevPosts, ...newPosts]));
      setLastVisibleDoc(result.lastVisible);
      setHasMore(result.hasMore);
      
      // Load users for new posts
      const newPostsWithUserData = await Promise.all(
        newPosts.map(async (post) => {
          const user = await getUserData(post.userId);
          return { ...post, user: user! };
        })
      );
      
      setPostsWithUsers(prevPosts => {
        const existingIds = new Set(prevPosts.map(p => p.id));
        const uniqueNewPosts = newPostsWithUserData.filter(p => p.user && !existingIds.has(p.id));
        return capPosts([...prevPosts, ...uniqueNewPosts]);
      });
    } catch (error) {
      console.error('Error loading more posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Track viewable items for logging
  const onViewableItemsChanged = useRef(({ changed }: any) => {
    if (!__DEV__) return;
    changed.forEach((item: any) => {
      if (item.isViewable) {
        console.log(`👁️ Post ${item.item.id.substring(0, 8)}... is now VISIBLE`);
      } else {
        console.log(`👋 Post ${item.item.id.substring(0, 8)}... is now HIDDEN`);
      }
    });
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50, // Log when 50% of item is visible
    minimumViewTime: 300, // Wait 300ms before logging
  }).current;

  const loadUsersForPosts = async (posts: Post[]) => {
    try {
      const postsWithUserData = await Promise.all(
        posts.map(async (post) => {
          const user = await getUserData(post.userId);
          return { ...post, user: user! };
        })
      );
      setPostsWithUsers(capPosts(postsWithUserData.filter(p => p.user)));
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
      
      // Load replies for each comment
      const repliesData: { [commentId: string]: (Reply & { user: User })[] } = {};
      await Promise.all(
        comments.map(async (comment) => {
          if (comment.repliesCount > 0) {
            getCommentReplies(comment.id, async (replies) => {
              const repliesWithUserData = await Promise.all(
                replies.map(async (reply) => {
                  const user = await getUserData(reply.userId);
                  return { ...reply, user: user! };
                })
              );
              repliesData[comment.id] = repliesWithUserData.filter(r => r.user);
              setRepliesWithUsers({ ...repliesData });
            });
          }
        })
      );
    });
  };

  const handleLikePost = async (postId: string) => {
    // Prevent spam clicking
    if (likingPosts.has(postId) || !currentUser) return;
    
    setLikingPosts(prev => new Set(prev).add(postId));
    
    // Save previous state for potential rollback
    const previousPosts = posts;
    const previousPostsWithUsers = postsWithUsers;
    
    // Optimistically update the UI
    const updatePosts = (postsList: Post[]) => {
      return postsList.map(post => {
        if (post.id === postId) {
          const isLiked = post.likedBy?.includes(currentUser.uid);
          return {
            ...post,
            likes: isLiked ? post.likes - 1 : post.likes + 1,
            likedBy: isLiked 
              ? post.likedBy.filter(id => id !== currentUser.uid)
              : [...(post.likedBy || []), currentUser.uid]
          };
        }
        return post;
      });
    };
    
    const updatePostsWithUsers = (postsList: (Post & { user: User })[]) => {
      return postsList.map(post => {
        if (post.id === postId) {
          const isLiked = post.likedBy?.includes(currentUser.uid);
          return {
            ...post,
            likes: isLiked ? post.likes - 1 : post.likes + 1,
            likedBy: isLiked 
              ? post.likedBy.filter(id => id !== currentUser.uid)
              : [...(post.likedBy || []), currentUser.uid]
          };
        }
        return post;
      });
    };
    
    setPosts(updatePosts(posts));
    setPostsWithUsers(updatePostsWithUsers(postsWithUsers));
    
    try {
      await likePost(postId);
    } catch (error: any) {
      // Revert to previous state on error
      setPosts(previousPosts);
      setPostsWithUsers(previousPostsWithUsers);
      Alert.alert('Error', error.message || 'Failed to like post');
    } finally {
      // Remove from set after a delay to prevent rapid re-clicking
      setTimeout(() => {
        setLikingPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }, 500);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    // Prevent spam clicking
    if (likingComments.has(commentId) || !currentUser) return;
    
    setLikingComments(prev => new Set(prev).add(commentId));
    
    // Save previous state for potential rollback
    const previousComments = postComments;
    const previousCommentsWithUsers = commentsWithUsers;
    
    // Optimistically update the UI
    const updateComments = (commentsList: Comment[]) => {
      return commentsList.map(comment => {
        if (comment.id === commentId) {
          const isLiked = comment.likedBy?.includes(currentUser.uid);
          return {
            ...comment,
            likes: isLiked ? comment.likes - 1 : comment.likes + 1,
            likedBy: isLiked 
              ? comment.likedBy.filter(id => id !== currentUser.uid)
              : [...(comment.likedBy || []), currentUser.uid]
          };
        }
        return comment;
      });
    };
    
    const updateCommentsWithUsers = (commentsList: (Comment & { user: User })[]) => {
      return commentsList.map(comment => {
        if (comment.id === commentId) {
          const isLiked = comment.likedBy?.includes(currentUser.uid);
          return {
            ...comment,
            likes: isLiked ? comment.likes - 1 : comment.likes + 1,
            likedBy: isLiked 
              ? comment.likedBy.filter(id => id !== currentUser.uid)
              : [...(comment.likedBy || []), currentUser.uid]
          };
        }
        return comment;
      });
    };
    
    setPostComments(updateComments(postComments));
    setCommentsWithUsers(updateCommentsWithUsers(commentsWithUsers));
    
    try {
      await likeComment(commentId);
    } catch (error: any) {
      // Revert to previous state on error
      setPostComments(previousComments);
      setCommentsWithUsers(previousCommentsWithUsers);
      Alert.alert('Error', error.message || 'Failed to like comment');
    } finally {
      // Remove from set after a delay to prevent rapid re-clicking
      setTimeout(() => {
        setLikingComments(prev => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });
      }, 500);
    }
  };

  const handleLikeReply = async (replyId: string) => {
    // Prevent spam clicking
    if (likingReplies.has(replyId) || !currentUser) return;
    
    setLikingReplies(prev => new Set(prev).add(replyId));
    
    // Save previous state for potential rollback
    const previousRepliesWithUsers = repliesWithUsers;
    
    // Optimistically update the UI
    const updatedReplies = { ...repliesWithUsers };
    Object.keys(updatedReplies).forEach(commentId => {
      updatedReplies[commentId] = updatedReplies[commentId].map(reply => {
        if (reply.id === replyId) {
          const isLiked = reply.likedBy?.includes(currentUser.uid);
          return {
            ...reply,
            likes: isLiked ? reply.likes - 1 : reply.likes + 1,
            likedBy: isLiked 
              ? reply.likedBy.filter(id => id !== currentUser.uid)
              : [...(reply.likedBy || []), currentUser.uid]
          };
        }
        return reply;
      });
    });
    
    setRepliesWithUsers(updatedReplies);
    
    try {
      await likeReply(replyId);
    } catch (error: any) {
      // Revert to previous state on error
      setRepliesWithUsers(previousRepliesWithUsers);
      Alert.alert('Error', error.message || 'Failed to like reply');
    } finally {
      // Remove from set after a delay to prevent rapid re-clicking
      setTimeout(() => {
        setLikingReplies(prev => {
          const newSet = new Set(prev);
          newSet.delete(replyId);
          return newSet;
        });
      }, 500);
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

  const handleDownloadImage = async () => {
    try {
      const imageUri = selectedImage;
      if (!imageUri) {
        Alert.alert('Error', 'No image available to download.');
        return;
      }

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = imageUri;
        link.download = `gso-image-${Date.now()}.jpg`;
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

      const fileUri = `${FileSystem.cacheDirectory}gso-image-${Date.now()}.jpg`;
      let localUri = fileUri;

      if (imageUri.startsWith('data:image')) {
        const base64Data = imageUri.split(',')[1] || '';
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);
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

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedPost) return;

    setLoadingComment(true);
    try {
      if (replyingTo) {
        // Adding a reply to a comment
        await addReply(replyingTo.id, commentText.trim());
        setReplyingTo(null);
      } else {
        // Adding a comment to the post
        await addComment(selectedPost.id, commentText.trim());
        
        // Update the comment count in local state
        setPosts(posts => posts.map(post => 
          post.id === selectedPost.id 
            ? { ...post, comments: post.comments + 1 }
            : post
        ));
        setPostsWithUsers(posts => posts.map(post => 
          post.id === selectedPost.id 
            ? { ...post, comments: post.comments + 1 }
            : post
        ));
      }
      setCommentText('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add ' + (replyingTo ? 'reply' : 'comment'));
    } finally {
      setLoadingComment(false);
    }
  };

  const handleReplyToComment = (comment: Comment & { user: User }) => {
    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
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
    setReplyingTo(null);
    setRepliesWithUsers({});
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    if (activeFilter === 'all') {
      // Reset pagination and reload
      try {
        const result = await getPostsPaginated(3);
        console.log(`🔄 Refreshed feed - Loaded ${result.posts.length} posts`);
        setPosts(capPosts(result.posts));
        setLastVisibleDoc(result.lastVisible);
        setHasMore(result.hasMore);
        loadUsersForPosts(capPosts(result.posts));
      } catch (error) {
        console.error('Error refreshing posts:', error);
        setRefreshing(false);
      }
    } else {
      // The useEffect will handle reloading for filtered views
      setRefreshing(false);
    }
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
          setPosts(capPosts(fetchedPosts));
          loadUsersForPosts(capPosts(fetchedPosts));
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

  const handleReport = async () => {
    if (!reportingPost || !reportReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the report');
      return;
    }

    if (!currentUser) return;

    try {
      await createReport(
        'post',
        reportingPost.id,
        reportReason,
        {
          postContent: reportingPost.content,
          userId: reportingPost.userId,
          userName: reportingPost.user?.displayName || 'Unknown user'
        }
      );

      Alert.alert('Success', 'Report submitted successfully. Our team will review it.');
      setReportModalVisible(false);
      setReportingPost(null);
      setReportReason('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    }
  };

  const isFollowing = (userId: string): boolean => {
    return currentUserData?.following?.includes(userId) || false;
  };

  const isFriend = (userId: string): boolean => {
    return currentUserData?.friends?.includes(userId) || false;
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
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  const renderPost = useCallback(({ item }: { item: Post & { user: User } }) => {
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
              <TouchableOpacity onPress={() => onNavigateToProfile(item.userId)}>
                <Text style={[styles.username, styles.clickableUsername]}>{item.user.displayName}</Text>
              </TouchableOpacity>
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

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              setReportingPost(item);
              setReportModalVisible(true);
            }}
          >
            <Text style={styles.actionText}>⚠️ Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [
    capPosts,
    currentUser?.uid,
    currentUserData?.friends,
    currentUserData?.following,
    onNavigateToProfile,
    handleUnfollowUser,
    handleFollowUser,
    handleLikePost,
    openComments,
    formatTime,
  ]);

  const keyExtractor = useCallback((item: Post & { user: User }) => item.id, []);

  const renderReply = (reply: Reply & { user: User }) => {
    const isLiked = reply.likedBy.includes(currentUser?.uid || '');
    
    return (
      <View key={reply.id} style={styles.replyContainer}>
        <Image
          source={{
            uri: reply.user.profilePicture || 'https://via.placeholder.com/30'
          }}
          style={styles.replyAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername}>{reply.user.displayName}</Text>
            <Text style={styles.commentTime}>{formatTime(reply.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{reply.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={[styles.commentAction, isLiked && styles.likedAction]}
              onPress={() => handleLikeReply(reply.id)}
            >
              <Text style={[styles.commentActionText, isLiked && styles.likedCommentText]}>
                {isLiked ? '❤️' : '🤍'} {reply.likes}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment & { user: User } }) => {
    const isLiked = item.likedBy.includes(currentUser?.uid || '');
    const replies = repliesWithUsers[item.id] || [];
    
    return (
      <View>
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
              <TouchableOpacity 
                style={styles.commentAction}
                onPress={() => handleReplyToComment(item)}
              >
                <Text style={styles.commentActionText}>Reply {item.repliesCount > 0 ? `(${item.repliesCount})` : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {/* Render replies with indentation */}
        {replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {replies.map(reply => renderReply(reply))}
          </View>
        )}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
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
            <View>
              {replyingTo && (
                <View style={styles.replyingToContainer}>
                  <Text style={styles.replyingToText}>
                    Replying to {replyingTo.user.displayName}
                  </Text>
                  <TouchableOpacity onPress={cancelReply}>
                    <Text style={styles.cancelReplyText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                  placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
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
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
            keyExtractor={keyExtractor}
            style={styles.feed}
            contentContainerStyle={styles.feedContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMorePosts}
            onEndReachedThreshold={0.3}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            removeClippedSubviews={true}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            updateCellsBatchingPeriod={80}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <Text style={styles.loadingMoreText}>Loading more posts...</Text>
                </View>
              ) : !hasMore && postsWithUsers.length > 0 ? (
                <View style={styles.endOfFeedContainer}>
                  <Text style={styles.endOfFeedText}>You've reached the end! 🎉</Text>
                </View>
              ) : null
            }
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
                  <View style={styles.imageHeaderRight}>
                    {selectedPostImages.length > 1 && (
                      <Text style={styles.imageCounter}>
                        {selectedImageIndex + 1} / {selectedPostImages.length}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.downloadImageButton}
                      onPress={handleDownloadImage}
                    >
                      <Text style={styles.downloadImageButtonText}>Download</Text>
                    </TouchableOpacity>
                  </View>
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
        
        {/* Report Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={reportModalVisible}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.reportModalContainer}>
            <LinearGradient colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']} style={styles.reportModalGradient}>
              <View style={styles.reportModalContent}>
                <View style={styles.reportModalHeader}>
                  <Text style={styles.reportModalTitle}>Report Post</Text>
                  <TouchableOpacity 
                    style={styles.closeReportButton} 
                    onPress={() => {
                      setReportModalVisible(false);
                      setReportingPost(null);
                      setReportReason('');
                    }}
                  >
                    <Text style={styles.closeReportButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.reportModalDescription}>
                  Please select or describe why you're reporting this post:
                </Text>

                {/* Predefined reasons */}
                <ScrollView style={styles.reasonsList}>
                  {['Spam', 'Inappropriate content', 'Harassment', 'Misinformation', 'Violence', 'Hate speech', 'Other'].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonButton,
                        reportReason === reason && styles.reasonButtonSelected
                      ]}
                      onPress={() => setReportReason(reason)}
                    >
                      <Text style={[
                        styles.reasonText,
                        reportReason === reason && styles.reasonTextSelected
                      ]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Custom reason input */}
                <View style={styles.customReasonContainer}>
                  <Text style={styles.customReasonLabel}>Or provide a custom reason:</Text>
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="Describe the issue..."
                    placeholderTextColor="#888"
                    value={reportReason}
                    onChangeText={setReportReason}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Submit button */}
                <TouchableOpacity
                  style={[styles.submitReportButton, !reportReason.trim() && styles.submitReportButtonDisabled]}
                  onPress={handleReport}
                  disabled={!reportReason.trim()}
                >
                  <Text style={styles.submitReportButtonText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>
        
        {/* Navbar */}
        <Navbar activeTab={activeTab} onTabPress={handleTabPress} user={currentUserData} />
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
  clickableUsername: {
    textDecorationLine: 'underline',
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
  keyboardAvoidingView: {
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
  repliesContainer: {
    marginLeft: 40,
    marginTop: -10,
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
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
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyingToText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  cancelReplyText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    paddingHorizontal: 10,
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
  imageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  endOfFeedContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfFeedText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  reportModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reportModalGradient: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 15,
  },
  reportModalContent: {
    padding: 20,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  closeReportButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeReportButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportModalDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 15,
  },
  reasonsList: {
    maxHeight: 200,
    marginBottom: 15,
  },
  reasonButton: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  reasonButtonSelected: {
    backgroundColor: 'rgba(118, 75, 162, 0.5)',
    borderColor: 'rgba(118, 75, 162, 0.8)',
  },
  reasonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  reasonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  customReasonContainer: {
    marginBottom: 20,
  },
  customReasonLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitReportButton: {
    backgroundColor: 'rgba(118, 75, 162, 0.8)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitReportButtonDisabled: {
    backgroundColor: 'rgba(118, 75, 162, 0.3)',
  },
  submitReportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PostsFeedScreen;