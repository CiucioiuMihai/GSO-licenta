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
