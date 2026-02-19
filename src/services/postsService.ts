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

// Get user data with accurate counts
export const getUserDataWithCounts = async (userId: string): Promise<User | null> => {
  try {
    const [userDoc, postCount] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getUserPostCount(userId)
    ]);
    
    if (userDoc.exists()) {
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      
      // Ensure all required fields exist with defaults
      userData.totalPosts = postCount; // Always use real count
      userData.totalFriends = userData.friends?.length || 0;
      userData.totalFollowers = userData.followers?.length || 0;
      userData.totalFollowing = userData.following?.length || 0;
      userData.xp = userData.xp || 0;
      userData.level = userData.level || 1;
      userData.achievements = userData.achievements || [];
      userData.friends = userData.friends || [];
      userData.followers = userData.followers || [];
      userData.following = userData.following || [];
      
      // Update the database with accurate counts if they don't match
      const needsUpdate = userData.totalPosts !== (userDoc.data().totalPosts || 0);
      if (needsUpdate) {
        await updateDoc(doc(db, 'users', userId), {
          totalPosts: userData.totalPosts,
          totalFriends: userData.totalFriends,
          totalFollowers: userData.totalFollowers,
          totalFollowing: userData.totalFollowing,
        });
      }
      
      return userData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data with counts:', error);
    return null;
  }
};