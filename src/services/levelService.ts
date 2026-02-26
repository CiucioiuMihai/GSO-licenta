import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  User, 
  XPSource, 
  XP_REWARDS, 
  Achievement,
  ACHIEVEMENT_DEFINITIONS 
} from '../types';
import { 
  calculateLevel, 
  checkLevelUp, 
  checkAchievementsForUser,
  getLevelDefinition
} from '../utils/gamification';

/**
 * Award XP to a user for a specific action
 * @param userId - The user ID
 * @param action - The action that earned XP
 * @returns Object containing the XP awarded and whether the user leveled up
 */
export const awardXP = async (
  userId: string, 
  action: XPSource['action']
): Promise<{ xpAwarded: number; leveledUp: boolean; newLevel?: number }> => {
  const xpAmount = XP_REWARDS[action];
  
  if (!xpAmount || xpAmount <= 0) {
    return { xpAwarded: 0, leveledUp: false };
  }

  const userRef = doc(db, 'users', userId);
  
  try {
    // Get current user data to check level before update
    const { getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(userRef);
    const currentXP = userDoc.data()?.xp || 0;
    const oldLevel = calculateLevel(currentXP);
    const newXP = currentXP + xpAmount;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > oldLevel;

    // Update user XP and level
    await updateDoc(userRef, {
      xp: increment(xpAmount),
      level: newLevel,
    });

    return { 
      xpAwarded: xpAmount, 
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined
    };
  } catch (error) {
    console.error('Error awarding XP:', error);
    throw error;
  }
};

/**
 * Check and unlock new achievements for a user
 * @param userId - The user ID
 * @param user - The current user object
 * @returns Array of newly unlocked achievement IDs
 */
export const checkAndUnlockAchievements = async (
  userId: string,
  user: User
): Promise<string[]> => {
  try {
    const newAchievementIds = checkAchievementsForUser(user);
    
    if (newAchievementIds.length === 0) {
      return [];
    }

    const userRef = doc(db, 'users', userId);
    
    // Update user with new achievements and bonus XP
    const newAchievements = newAchievementIds.map((id: string) => ({
      id,
      unlockedAt: new Date()
    }));

    // Calculate total XP reward from achievements
    const totalAchievementXP = newAchievementIds.reduce((total: number, id: string) => {
      const achDef = ACHIEVEMENT_DEFINITIONS.find(a => a.id === id);
      return total + (achDef?.xpReward || 0);
    }, 0);
    
    // Update user with new achievements and bonus XP
    await updateDoc(userRef, {
      achievements: arrayUnion(...newAchievements),
      xp: increment(totalAchievementXP),
    });

    // Recalculate level with new XP
    const newXP = user.xp + totalAchievementXP;
    const newLevel = calculateLevel(newXP);
    
    if (newLevel > user.level) {
      await updateDoc(userRef, { level: newLevel });
    }

    return newAchievementIds;
  } catch (error) {
    console.error('Error checking achievements:', error);
    throw error;
  }
};

/**
 * Handle post creation XP and achievements
 */
export const handlePostCreated = async (userId: string, user: User) => {
  const { xpAwarded, leveledUp, newLevel } = await awardXP(userId, 'create_post');
  
  // Update user's total posts count
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    totalPosts: increment(1)
  });
  
  // Check for achievements (after totalPosts is updated)
  const updatedUser = { ...user, totalPosts: (user.totalPosts || 0) + 1, xp: user.xp + xpAwarded };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { xpAwarded, leveledUp, newLevel, newAchievements };
};

/**
 * Handle receiving a like on a post
 */
export const handlePostLikeReceived = async (userId: string, user: User) => {
  const { xpAwarded, leveledUp, newLevel } = await awardXP(userId, 'receive_like_post');
  
  // Update user's total likes count
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    totalLikes: increment(1)
  });
  
  // Check for achievements
  const updatedUser = { ...user, totalLikes: (user.totalLikes || 0) + 1, xp: user.xp + xpAwarded };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { xpAwarded, leveledUp, newLevel, newAchievements };
};

/**
 * Handle receiving a comment
 */
export const handleCommentReceived = async (userId: string, user: User) => {
  const result = await awardXP(userId, 'receive_comment');
  
  // Check for achievements
  const updatedUser = { ...user, xp: user.xp + result.xpAwarded };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { ...result, newAchievements };
};

/**
 * Handle receiving a like on a comment
 */
export const handleCommentLikeReceived = async (userId: string, user: User) => {
  const result = await awardXP(userId, 'receive_like_comment');
  
  // Check for achievements
  const updatedUser = { ...user, xp: user.xp + result.xpAwarded };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { ...result, newAchievements };
};

/**
 * Handle adding a friend
 */
export const handleFriendAdded = async (userId: string, user: User) => {
  const result = await awardXP(userId, 'add_friend');
  
  // The totalFriends is already updated by the friends service
  // Check for achievements with updated friend count
  const updatedUser = { 
    ...user, 
    totalFriends: (user.totalFriends || 0) + 1,
    xp: user.xp + result.xpAwarded 
  };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { ...result, newAchievements };
};

/**
 * Handle daily login
 */
export const handleDailyLogin = async (userId: string, user: User) => {
  const today = new Date().toDateString();
  const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate).toDateString() : null;
  
  // Only award XP if this is the first login today
  if (lastLogin === today) {
    return { xpAwarded: 0, leveledUp: false, newAchievements: [] };
  }
  
  const result = await awardXP(userId, 'daily_login');
  
  // Update login streak
  const userRef = doc(db, 'users', userId);
  const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  let newStreak = 1;
  if (lastLoginDate && lastLoginDate.toDateString() === yesterday.toDateString()) {
    newStreak = (user.dailyStreak || 0) + 1;
  }
  
  await updateDoc(userRef, {
    lastLoginDate: new Date(),
    dailyStreak: newStreak,
    totalDaysActive: increment(1)
  });
  
  // Check for streak-based achievements
  const updatedUser = { 
    ...user, 
    dailyStreak: newStreak,
    xp: user.xp + result.xpAwarded 
  };
  const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
  
  return { ...result, newAchievements };
};

/**
 * Get user's level information
 */
export const getUserLevelInfo = (user: User) => {
  const levelDef = getLevelDefinition(user.level);
  return {
    level: user.level,
    xp: user.xp,
    title: levelDef.title,
    icon: levelDef.icon,
    color: levelDef.color,
    xpRequired: levelDef.xpRequired,
    xpToNext: levelDef.xpToNext
  };
};

/**
 * Calculate retroactive XP based on user's existing stats
 * This gives users XP for actions they performed before the gamification system was implemented
 */
export const calculateRetroactiveXP = (user: User): number => {
  let retroactiveXP = 0;
  
  console.log('calculateRetroactiveXP - Input user data:', {
    totalPosts: user.totalPosts,
    totalLikes: user.totalLikes,
    totalComments: user.totalComments,
    totalFriends: user.totalFriends,
    friendsLength: user.friends?.length,
    createdAt: user.createdAt,
    totalDaysActive: user.totalDaysActive
  });
  
  // XP for posts created
  const postsXP = (user.totalPosts || 0) * XP_REWARDS.create_post;
  retroactiveXP += postsXP;
  console.log('calculateRetroactiveXP - Posts XP:', postsXP, `(${user.totalPosts || 0} posts × ${XP_REWARDS.create_post} XP)`);
  
  // XP for likes received
  const likesXP = (user.totalLikes || 0) * XP_REWARDS.receive_like_post;
  retroactiveXP += likesXP;
  console.log('calculateRetroactiveXP - Likes XP:', likesXP, `(${user.totalLikes || 0} likes × ${XP_REWARDS.receive_like_post} XP)`);
  
  // XP for comments received
  const commentsXP = (user.totalComments || 0) * XP_REWARDS.receive_comment;
  retroactiveXP += commentsXP;
  console.log('calculateRetroactiveXP - Comments XP:', commentsXP, `(${user.totalComments || 0} comments × ${XP_REWARDS.receive_comment} XP)`);
  
  // XP for friends added
  const friendsXP = (user.totalFriends || user.friends?.length || 0) * XP_REWARDS.add_friend;
  retroactiveXP += friendsXP;
  console.log('calculateRetroactiveXP - Friends XP:', friendsXP, `(${user.totalFriends || user.friends?.length || 0} friends × ${XP_REWARDS.add_friend} XP)`);
  
  // XP for daily logins (estimate based on account age and activity)
  // Handle missing createdAt gracefully
  let accountAge = 0;
  let estimatedLoginDays = 0;
  let loginXP = 0;
  
  if (user.createdAt && user.createdAt instanceof Date) {
    accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  } else if (user.createdAt) {
    // Try to parse createdAt if it's a string or timestamp
    try {
      const createdDate = new Date(user.createdAt);
      if (!isNaN(createdDate.getTime())) {
        accountAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    } catch (error) {
      console.log('calculateRetroactiveXP - Could not parse createdAt:', user.createdAt);
    }
  }
  
  if (accountAge > 0) {
    estimatedLoginDays = Math.min(
      accountAge, 
      (user.totalDaysActive || Math.min(accountAge, 30)) // Conservative estimate
    );
    loginXP = estimatedLoginDays * XP_REWARDS.daily_login;
  } else {
    // If no valid creation date, estimate based on activity level
    const activityBasedDays = Math.min((user.totalPosts || 0) + (user.totalFriends || 0), 30);
    estimatedLoginDays = Math.max(1, activityBasedDays); // At least 1 day if they have any activity
    loginXP = estimatedLoginDays * XP_REWARDS.daily_login;
  }
  
  retroactiveXP += loginXP;
  console.log('calculateRetroactiveXP - Login XP:', loginXP, `(${estimatedLoginDays} estimated days × ${XP_REWARDS.daily_login} XP)`);
  
  console.log('calculateRetroactiveXP - Total retroactive XP:', retroactiveXP);
  
  // Ensure we return a valid number
  const finalXP = Math.max(0, retroactiveXP);
  if (isNaN(finalXP)) {
    console.error('calculateRetroactiveXP - Result is NaN, returning 0');
    return 0;
  }
  
  return finalXP;
};

/**
 * Apply retroactive XP to a specific user
 * This will update their XP, level, and check for achievements
 */
export const applyRetroactiveXP = async (userId: string): Promise<{
  previousXP: number;
  retroactiveXP: number;
  newXP: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newAchievements: string[];
}> => {
  try {
    console.log('applyRetroactiveXP - Starting for user:', userId);
    const userRef = doc(db, 'users', userId);
    const { getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const user = { id: userId, ...userDoc.data() } as User;
    const previousXP = user.xp || 0;
    const previousLevel = user.level || 1;
    
    console.log('applyRetroactiveXP - Current user state:', {
      previousXP,
      previousLevel,
      retroactiveXPApplied: user.retroactiveXPApplied,
      totalPosts: user.totalPosts,
      totalFriends: user.totalFriends,
      totalLikes: user.totalLikes
    });
    
    // Calculate what the retroactive XP should be
    const calculatedRetroactiveXP = calculateRetroactiveXP(user);
    console.log('applyRetroactiveXP - Calculated retroactive XP:', calculatedRetroactiveXP);
    
    // Apply retroactive XP if the calculated amount is higher than current XP
    // This ensures users get the XP they deserve based on their activity
    if (calculatedRetroactiveXP > previousXP) {
      const newXP = calculatedRetroactiveXP;
      const newLevel = calculateLevel(newXP);
      const leveledUp = newLevel > previousLevel;
      
      console.log('applyRetroactiveXP - XP calculation:', {
        previousXP,
        calculatedRetroactiveXP,
        newXP,
        previousLevel,
        newLevel,
        leveledUp
      });
      
      console.log('applyRetroactiveXP - Updating user with new XP and level...');
      
      // Initialize dailyStreak if not set and user has activity
      const hasActivity = (user.totalPosts || 0) > 0 || 
                         (user.totalFriends || 0) > 0 || 
                         (user.totalLikes || 0) > 0;
      const shouldInitializeStreak = hasActivity && !user.dailyStreak;
      
      const updateData: any = {
        xp: newXP,
        level: newLevel,
        retroactiveXPApplied: true,
        retroactiveXPAmount: calculatedRetroactiveXP,
        lastRetroactiveCheck: new Date()
      };
      
      // Initialize streak to 1 for active users who don't have one yet
      if (shouldInitializeStreak) {
        updateData.dailyStreak = 1;
        console.log('applyRetroactiveXP - Initializing dailyStreak to 1 for active user');
      }
      
      await updateDoc(userRef, updateData);
      
      // Check for newly unlocked achievements
      const updatedUser = { ...user, xp: newXP, level: newLevel };
      const newAchievements = await checkAndUnlockAchievements(userId, updatedUser);
      
      console.log('applyRetroactiveXP - Completed successfully:', {
        previousXP,
        retroactiveXP: newXP - previousXP,
        newXP,
        previousLevel,
        newLevel,
        leveledUp,
        newAchievements
      });
      
      return {
        previousXP,
        retroactiveXP: newXP - previousXP,
        newXP,
        previousLevel,
        newLevel,
        leveledUp,
        newAchievements
      };
    } else {
      // Update the last check time even if no XP was awarded
      await updateDoc(userRef, {
        retroactiveXPApplied: true,
        lastRetroactiveCheck: new Date()
      });
      
      console.log('applyRetroactiveXP - User already has appropriate XP, no update needed');
      
      return {
        previousXP,
        retroactiveXP: 0,
        newXP: previousXP,
        previousLevel,
        newLevel: previousLevel,
        leveledUp: false,
        newAchievements: []
      };
    }
  } catch (error) {
    console.error('Error applying retroactive XP:', error);
    throw error;
  }
};

/**
 * Apply retroactive XP to all users in batches
 * This should be run as a one-time migration when implementing gamification
 */
export const batchApplyRetroactiveXP = async (
  onProgress?: (completed: number, total: number, currentUser?: string) => void
): Promise<{
  totalUsers: number;
  usersUpdated: number;
  totalXPAwarded: number;
  errors: string[];
}> => {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    
    // Get all users who haven't had retroactive XP applied
    const usersQuery = query(
      collection(db, 'users'),
      where('retroactiveXPApplied', '!=', true)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const totalUsers = usersSnapshot.docs.length;
    let usersUpdated = 0;
    let totalXPAwarded = 0;
    const errors: string[] = [];
    
    console.log(`Starting retroactive XP application for ${totalUsers} users`);
    
    // Process users in batches of 10 to avoid overwhelming Firestore
    const batchSize = 10;
    const userDocs = usersSnapshot.docs;
    
    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (userDoc) => {
          try {
            const userId = userDoc.id;
            const result = await applyRetroactiveXP(userId);
            
            if (result.retroactiveXP > 0) {
              usersUpdated++;
              totalXPAwarded += result.retroactiveXP;
              console.log(
                `Applied ${result.retroactiveXP} XP to user ${userId}. ` +
                `Level: ${result.previousLevel} → ${result.newLevel}`
              );
            }
            
            onProgress?.(i + batch.indexOf(userDoc) + 1, totalUsers, userId);
          } catch (error: any) {
            const errorMsg = `Failed to update user ${userDoc.id}: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        })
      );
      
      // Small delay between batches to be respectful to Firestore
      if (i + batchSize < userDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const result = {
      totalUsers,
      usersUpdated,
      totalXPAwarded,
      errors
    };
    
    console.log('Retroactive XP application completed:', result);
    return result;
  } catch (error) {
    console.error('Error in batch retroactive XP application:', error);
    throw error;
  }
};
