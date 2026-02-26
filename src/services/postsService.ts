import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Post, Comment, Reply, Tag, User } from '@/types';
import { calculateLevel } from '@/utils/gamification';

// Post Operations
export const createPost = async (content: string, tags: string[] = [], images?: any[]): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const batch = writeBatch(db);

  try {
    // Create post
    const postRef = doc(collection(db, 'posts'));
    const postData: Omit<Post, 'id'> = {
      userId: currentUser.uid,
      content,
      tags,
      images: images || [],
      likes: 0,
      comments: 0,
      shares: 0,
      likedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(postRef, postData);

    // Update user's post count
    const userRef = doc(db, 'users', currentUser.uid);
    batch.update(userRef, {
      totalPosts: increment(1)
    });

    // Update tag usage counts
    for (const tag of tags) {
      const tagRef = doc(db, 'tags', tag.toLowerCase());
      batch.set(tagRef, {
        name: tag,
        postsCount: increment(1),
        lastUsed: new Date(),
        createdAt: new Date()
      }, { merge: true });
    }

    await batch.commit();
    console.log('Post created successfully');
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const getPosts = (callback: (posts: Post[]) => void, limitCount = 20) => {
  return onSnapshot(
    query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    ),
    (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Post[];
      callback(posts);
    }
  );
};

export const getUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
  return onSnapshot(
    query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ),
    (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Post[];
      callback(posts);
    }
  );
};

export const getPostsByTag = (tag: string, callback: (posts: Post[]) => void) => {
  return onSnapshot(
    query(
      collection(db, 'posts'),
      where('tags', 'array-contains', tag),
      orderBy('createdAt', 'desc'),
      limit(20)
    ),
    (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Post[];
      callback(posts);
    }
  );
};

// Get posts from followed users
export const getPostsFromFollowing = async (userId: string): Promise<Post[]> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];
    
    const userData = userDoc.data() as User;
    // Filter out current user from following list to exclude own posts
    const following = (userData.following || []).filter(id => id !== userId);
    
    if (following.length === 0) return [];
    
    // Firestore 'in' queries are limited to 10 items, so we need to batch
    const batches: string[][] = [];
    for (let i = 0; i < following.length; i += 10) {
      batches.push(following.slice(i, i + 10));
    }
    
    const allPosts: Post[] = [];
    for (const batch of batches) {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', batch),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Post[];
      allPosts.push(...posts);
    }
    
    // Sort by date and return most recent
    return allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
  } catch (error) {
    console.error('Error getting posts from following:', error);
    return [];
  }
};

// Get posts from friends
export const getPostsFromFriends = async (userId: string): Promise<Post[]> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];
    
    const userData = userDoc.data() as User;
    // Filter out current user from friends list to exclude own posts
    const friends = (userData.friends || []).filter(id => id !== userId);
    
    if (friends.length === 0) return [];
    
    // Firestore 'in' queries are limited to 10 items
    const batches: string[][] = [];
    for (let i = 0; i < friends.length; i += 10) {
      batches.push(friends.slice(i, i + 10));
    }
    
    const allPosts: Post[] = [];
    for (const batch of batches) {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', batch),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Post[];
      allPosts.push(...posts);
    }
    
    // Sort by date and return most recent
    return allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
  } catch (error) {
    console.error('Error getting posts from friends:', error);
    return [];
  }
};

export const getPostsByTagStatic = async (tag: string): Promise<Post[]> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('tags', 'array-contains', tag),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const postsSnapshot = await getDocs(postsQuery);
    return postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Post[];
  } catch (error) {
    console.error('Error getting posts by tag:', error);
    return [];
  }
};

export const likePost = async (postId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const postRef = doc(db, 'posts', postId);
  const postDoc = await getDoc(postRef);
  
  if (!postDoc.exists()) throw new Error('Post not found');
  
  const postData = postDoc.data() as Post;
  const isLiked = postData.likedBy.includes(currentUser.uid);

  if (isLiked) {
    // Unlike
    await updateDoc(postRef, {
      likes: increment(-1),
      likedBy: arrayRemove(currentUser.uid)
    });
  } else {
    // Like
    await updateDoc(postRef, {
      likes: increment(1),
      likedBy: arrayUnion(currentUser.uid)
    });
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const batch = writeBatch(db);

  try {
    // Get post data first
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) throw new Error('Post not found');
    
    const postData = postDoc.data() as Post;
    
    // Check if user owns the post
    if (postData.userId !== currentUser.uid) {
      throw new Error('You can only delete your own posts');
    }

    // Delete post
    batch.delete(postRef);

    // Update user's post count
    const userRef = doc(db, 'users', currentUser.uid);
    batch.update(userRef, {
      totalPosts: increment(-1)
    });

    // Update tag usage counts
    if (postData.tags) {
      for (const tag of postData.tags) {
        const tagRef = doc(db, 'tags', tag.toLowerCase());
        batch.update(tagRef, {
          postsCount: increment(-1)
        });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// Comment Operations
export const addComment = async (postId: string, text: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const batch = writeBatch(db);

  try {
    // Get the post to find the owner
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) throw new Error('Post not found');
    
    const post = postDoc.data() as Post;
    const postOwnerId = post.userId;

    // Create comment
    const commentRef = doc(collection(db, 'comments'));
    const commentData: Omit<Comment, 'id'> = {
      postId,
      userId: currentUser.uid,
      text,
      likes: 0,
      likedBy: [],
      replies: [],
      repliesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(commentRef, commentData);

    // Update post comment count
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      comments: increment(1)
    });

    await batch.commit();
    
    // Award XP to post owner (if not commenting on own post)
    if (postOwnerId !== currentUser.uid) {
      const { awardXP } = await import('./levelService');
      await awardXP(postOwnerId, 'receive_comment');
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

export const getPostComments = (postId: string, callback: (comments: Comment[]) => void) => {
  return onSnapshot(
    query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'desc')
    ),
    (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Comment[];
      callback(comments);
    }
  );
};

export const likeComment = async (commentId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const commentRef = doc(db, 'comments', commentId);
  const commentDoc = await getDoc(commentRef);
  
  if (!commentDoc.exists()) throw new Error('Comment not found');
  
  const commentData = commentDoc.data() as Comment;
  const isLiked = commentData.likedBy.includes(currentUser.uid);

  if (isLiked) {
    // Unlike
    await updateDoc(commentRef, {
      likes: increment(-1),
      likedBy: arrayRemove(currentUser.uid)
    });
  } else {
    // Like
    await updateDoc(commentRef, {
      likes: increment(1),
      likedBy: arrayUnion(currentUser.uid)
    });
  }
};

export const addReply = async (commentId: string, text: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  const batch = writeBatch(db);

  try {
    // Create reply
    const replyRef = doc(collection(db, 'replies'));
    const replyData: Omit<Reply, 'id'> = {
      commentId,
      userId: currentUser.uid,
      text,
      likes: 0,
      likedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    batch.set(replyRef, replyData);

    // Update comment reply count
    const commentRef = doc(db, 'comments', commentId);
    batch.update(commentRef, {
      repliesCount: increment(1)
    });

    await batch.commit();
  } catch (error) {
    console.error('Error adding reply:', error);
    throw error;
  }
};

export const getCommentReplies = (commentId: string, callback: (replies: Reply[]) => void) => {
  return onSnapshot(
    query(
      collection(db, 'replies'),
      where('commentId', '==', commentId),
      orderBy('createdAt', 'asc')
    ),
    (snapshot) => {
      const replies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Reply[];
      callback(replies);
    }
  );
};

// Tag Operations
export const getTrendingTags = async (limitCount = 10): Promise<Tag[]> => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'tags'),
        orderBy('postsCount', 'desc'),
        limit(limitCount)
      )
    );

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastUsed: doc.data().lastUsed?.toDate() || new Date(),
    })) as Tag[];
  } catch (error) {
    console.error('Error fetching trending tags:', error);
    throw error;
  }
};

export const searchTags = async (searchTerm: string): Promise<Tag[]> => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'tags'),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        orderBy('name'),
        limit(10)
      )
    );

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastUsed: doc.data().lastUsed?.toDate() || new Date(),
    })) as Tag[];
  } catch (error) {
    console.error('Error searching tags:', error);
    throw error;
  }
};

// Helper function to get user data for posts
export const getUserData = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

// Follow/Unfollow functionality
export const followUser = async (targetUserId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const targetUserRef = doc(db, 'users', targetUserId);
    
    // Add to current user's following list
    await updateDoc(userRef, {
      following: arrayUnion(targetUserId)
    });
    
    // Add to target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUser.uid)
    });
    
    console.log('Successfully followed user:', targetUserId);
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

export const unfollowUser = async (targetUserId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const targetUserRef = doc(db, 'users', targetUserId);
    
    // Remove from current user's following list
    await updateDoc(userRef, {
      following: arrayRemove(targetUserId)
    });
    
    // Remove from target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUser.uid)
    });
    
    console.log('Successfully unfollowed user:', targetUserId);
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
};

// Get accurate user post count
export const getUserPostCount = async (userId: string): Promise<number> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    return postsSnapshot.size;
  } catch (error) {
    console.error('Error getting user post count:', error);
    return 0;
  }
};

// Get total likes received by user on all their posts
export const getUserTotalLikes = async (userId: string): Promise<number> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    
    let totalLikes = 0;
    postsSnapshot.forEach((doc) => {
      const postData = doc.data() as Post;
      totalLikes += postData.likes || 0;
    });
    
    return totalLikes;
  } catch (error) {
    console.error('Error getting user total likes:', error);
    return 0;
  }
};

// Get total comments received by user on all their posts
export const getUserTotalComments = async (userId: string): Promise<number> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    
    let totalComments = 0;
    postsSnapshot.forEach((doc) => {
      const postData = doc.data() as Post;
      totalComments += postData.comments || 0;
    });
    
    return totalComments;
  } catch (error) {
    console.error('Error getting user total comments:', error);
    return 0;
  }
};

// Get user data with accurate counts
export const getUserDataWithCounts = async (userId: string): Promise<User | null> => {
  try {
    const [userDoc, postCount, totalLikes, totalComments] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getUserPostCount(userId),
      getUserTotalLikes(userId),
      getUserTotalComments(userId)
    ]);
    
    if (userDoc.exists()) {
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      
      // Ensure all required fields exist with defaults
      userData.totalPosts = postCount; // Always use real count
      userData.totalLikes = totalLikes; // Always use real count
      userData.totalComments = totalComments; // Always use real count
      userData.totalFriends = userData.friends?.length || 0;
      userData.totalFollowers = userData.followers?.length || 0;
      userData.totalFollowing = userData.following?.length || 0;
      userData.xp = userData.xp || 0;
      
      // Always recalculate level from XP to ensure consistency
      const calculatedLevel = calculateLevel(userData.xp);
      userData.level = calculatedLevel;
      
      // Initialize dailyStreak to 1 for active users if not set
      const hasActivity = (userData.totalPosts || 0) > 0 || 
                         (userData.totalFriends || 0) > 0 || 
                         (userData.totalLikes || 0) > 0;
      if (hasActivity && !userData.dailyStreak) {
        userData.dailyStreak = 1;
      }
      
      userData.achievements = userData.achievements || [];
      userData.friends = userData.friends || [];
      userData.followers = userData.followers || [];
      userData.following = userData.following || [];
      
      // Update the database with accurate counts and level if they don't match
      const dbLevel = userDoc.data().level || 1;
      const dbDailyStreak = userDoc.data().dailyStreak || 0;
      const needsUpdate = userData.totalPosts !== (userDoc.data().totalPosts || 0) ||
                         userData.totalLikes !== (userDoc.data().totalLikes || 0) ||
                         userData.totalComments !== (userDoc.data().totalComments || 0) ||
                         dbLevel !== calculatedLevel ||
                         (userData.dailyStreak && dbDailyStreak !== userData.dailyStreak);
      
      if (needsUpdate) {
        console.log('getUserDataWithCounts - Updating user data:', {
          totalPosts: userData.totalPosts,
          totalLikes: userData.totalLikes,
          totalComments: userData.totalComments,
          xp: userData.xp,
          oldLevel: dbLevel,
          newLevel: calculatedLevel,
          dailyStreak: userData.dailyStreak
        });
        
        const updateData: any = {
          totalPosts: userData.totalPosts,
          totalLikes: userData.totalLikes,
          totalComments: userData.totalComments,
          totalFriends: userData.totalFriends,
          totalFollowers: userData.totalFollowers,
          totalFollowing: userData.totalFollowing,
          level: calculatedLevel,
        };
        
        if (userData.dailyStreak && dbDailyStreak !== userData.dailyStreak) {
          updateData.dailyStreak = userData.dailyStreak;
        }
        
        await updateDoc(doc(db, 'users', userId), updateData);
      }
      
      return userData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data with counts:', error);
    return null;
  }
};