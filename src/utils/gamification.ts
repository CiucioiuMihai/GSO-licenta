import { 
  Achievement, 
  Badge, 
  AchievementDefinition, 
  BadgeDefinition, 
  LevelProgress,
  User,
  AchievementProgress,
  LEVEL_DEFINITIONS,
  ACHIEVEMENT_DEFINITIONS,
  XP_REWARDS,
  XPSource,
  LevelDefinition
} from '../types';

// Level calculation using the new level definitions
export const calculateLevel = (xp: number): number => {
  for (let i = LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_DEFINITIONS[i].xpRequired) {
      return LEVEL_DEFINITIONS[i].level;
    }
  }
  return 1; // Default to level 1
};

export const getLevelDefinition = (level: number): LevelDefinition => {
  return LEVEL_DEFINITIONS.find(def => def.level === level) || LEVEL_DEFINITIONS[0];
};

export const getXPForLevel = (level: number): number => {
  const levelDef = LEVEL_DEFINITIONS.find(def => def.level === level);
  return levelDef ? levelDef.xpRequired : 0;
};

export const getXPForNextLevel = (level: number): number => {
  const nextLevelDef = LEVEL_DEFINITIONS.find(def => def.level === level + 1);
  return nextLevelDef ? nextLevelDef.xpRequired : LEVEL_DEFINITIONS[LEVEL_DEFINITIONS.length - 1].xpRequired;
};

export const getLevelProgress = (currentXP: number): LevelProgress => {
  const currentLevel = calculateLevel(currentXP);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForNextLevel(currentLevel);
  const progressInLevel = currentXP - xpForCurrentLevel;
  const totalXPNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = totalXPNeeded > 0 ? Math.floor((progressInLevel / totalXPNeeded) * 100) : 100;
  const xpNeeded = Math.max(0, xpForNextLevel - currentXP);

  return {
    currentLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    progressInLevel,
    progressPercentage,
    xpNeeded
  };
};

// Achievement checking functions based on user stats
export const checkAchievementsForUser = (user: User): string[] => {
  const newAchievements: string[] = [];
  const currentAchievementIds = user.achievements?.map(a => a.id) || [];

  ACHIEVEMENT_DEFINITIONS.forEach(achDef => {
    // Skip if user already has this achievement
    if (currentAchievementIds.includes(achDef.id)) {
      return;
    }

    let isUnlocked = false;
    const req = achDef.requirement;

    switch (req.type) {
      case 'friends':
        isUnlocked = (user.totalFriends || user.friends?.length || 0) >= req.count;
        break;
      case 'posts':
        isUnlocked = (user.totalPosts || 0) >= req.count;
        break;
      case 'likes':
        isUnlocked = (user.totalLikes || 0) >= req.count;
        break;
      case 'comments':
        // This would need to be tracked separately in user stats
        break;
      case 'followers':
        isUnlocked = (user.totalFollowers || user.followers?.length || 0) >= req.count;
        break;
      case 'streak':
        isUnlocked = (user.dailyStreak || 0) >= req.count;
        break;
    }

    if (isUnlocked) {
      newAchievements.push(achDef.id);
    }
  });

  return newAchievements;
};

// Get achievement progress for a specific achievement
export const getAchievementProgress = (user: User, achievementId: string): AchievementProgress => {
  const achDef = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
  
  if (!achDef) {
    return { current: 0, required: 0, percentage: 0, completed: false };
  }

  const req = achDef.requirement;
  let current = 0;

  switch (req.type) {
    case 'friends':
      current = user.totalFriends || user.friends?.length || 0;
      break;
    case 'posts':
      current = user.totalPosts || 0;
      break;
    case 'likes':
      current = user.totalLikes || 0;
      break;
    case 'followers':
      current = user.totalFollowers || user.followers?.length || 0;
      break;
    case 'streak':
      current = user.dailyStreak || 0;
      break;
  }

  const required = req.count;
  const percentage = Math.min(100, Math.floor((current / required) * 100));
  const completed = current >= required;

  return { current, required, percentage, completed };
};

// Get all achievement progress
export const getAllAchievementProgress = (user: User): Record<string, AchievementProgress> => {
  const progress: Record<string, AchievementProgress> = {};
  
  ACHIEVEMENT_DEFINITIONS.forEach(achDef => {
    progress[achDef.id] = getAchievementProgress(user, achDef.id);
  });

  return progress;
};

// Get achievement definition
export const getAchievementDefinition = (achievementId: string): AchievementDefinition | null => {
  return ACHIEVEMENT_DEFINITIONS.find(def => def.id === achievementId) || null;
};

// Badge definitions - keeping these as some are non-achievement based
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'newcomer',
    title: 'Newcomer',
    description: 'Welcome to the community!',
    icon: '👋',
    color: '#4CAF50',
    rarity: 'common'
  },
  {
    id: 'active_user',
    title: 'Active User',
    description: 'Consistently engaged with the platform',
    icon: '⚡',
    color: '#2196F3',
    rarity: 'common'
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Been part of the community for a year',
    icon: '🏆',
    color: '#FFC107',
    rarity: 'rare'
  },
  {
    id: 'top_contributor',
    title: 'Top Contributor',
    description: 'One of the top content creators',
    icon: '🌟',
    color: '#9C27B0',
    rarity: 'epic'
  },
  {
    id: 'friendly',
    title: 'Friendly',
    description: 'Has many friends in the community',
    icon: '🤝',
    color: '#00BCD4',
    rarity: 'rare'
  },
  {
    id: 'verified',
    title: 'Verified',
    description: 'Account has been verified',
    icon: '✓',
    color: '#4CAF50',
    rarity: 'legendary'
  },
  {
    id: 'moderator',
    title: 'Moderator',
    description: 'Helps keep the community safe',
    icon: '🛡️',
    color: '#FF5722',
    rarity: 'legendary'
  },
  {
    id: 'community_guardian',
    title: 'Community Guardian',
    description: 'Keeps the community safe and positive',
    icon: '🛡️',
    color: '#FF5722',
    rarity: 'epic'
  }
];

export const getBadgeDefinition = (badgeId: string): BadgeDefinition | null => {
  return BADGE_DEFINITIONS.find(def => def.id === badgeId) || null;
};

// Ranking utilities
export const calculateUserRank = (users: User[], currentUser: User): number => {
  const sortedUsers = users.sort((a, b) => b.xp - a.xp);
  const userIndex = sortedUsers.findIndex(user => user.id === currentUser.id);
  return userIndex + 1; // Rank starts from 1
};

export const getTopUsers = (users: User[], count: number = 10): User[] => {
  return users
    .sort((a, b) => b.xp - a.xp)
    .slice(0, count);
};

// XP calculation helpers
export const calculateXPForAction = (action: XPSource['action']): number => {
  return XP_REWARDS[action] || 0;
};

export const calculateTotalXPGained = (actions: XPSource['action'][]): number => {
  return actions.reduce((total, action) => total + calculateXPForAction(action), 0);
};

// Helper to check if user leveled up
export const checkLevelUp = (oldXP: number, newXP: number): boolean => {
  const oldLevel = calculateLevel(oldXP);
  const newLevel = calculateLevel(newXP);
  return newLevel > oldLevel;
};

// Get level tier
export const getLevelTier = (level: number): string => {
  if (level >= 1 && level <= 5) return 'Newcomer';
  if (level >= 6 && level <= 10) return 'Regular';
  if (level >= 11 && level <= 15) return 'Active';
  if (level >= 16 && level <= 20) return 'Power User';
  if (level >= 21 && level <= 24) return 'Elite';
  if (level === 25) return 'Legendary';
  return 'Newcomer';
};
