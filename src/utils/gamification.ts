import { 
  Achievement, 
  Badge, 
  AchievementDefinition, 
  BadgeDefinition, 
  DailyChallenge, 
  LevelProgress,
  User,
  AchievementProgress
} from '../types';

export interface XPAction {
  type: 'post_created' | 'post_liked' | 'comment_created' | 'friend_added' | 'login_daily' | 'challenge_completed';
  xp: number;
  description: string;
}

// XP reward system
export const XP_REWARDS: Record<XPAction['type'], number> = {
  'post_created': 10,
  'post_liked': 2,
  'comment_created': 5,
  'friend_added': 25,
  'login_daily': 15,
  'challenge_completed': 50
};

// Level calculation
export const calculateLevel = (xp: number): number => {
  return Math.floor(xp / 1000) + 1;
};

export const getXPForLevel = (level: number): number => {
  return (level - 1) * 1000;
};

export const getXPForNextLevel = (level: number): number => {
  return level * 1000;
};

export const getLevelProgress = (currentXP: number): LevelProgress => {
  const currentLevel = calculateLevel(currentXP);
  const xpForCurrentLevel = getXPForLevel(currentLevel);
  const xpForNextLevel = getXPForNextLevel(currentLevel);
  const progressInLevel = currentXP - xpForCurrentLevel;
  const totalXPNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.floor((progressInLevel / totalXPNeeded) * 100);
  const xpNeeded = xpForNextLevel - currentXP;

  return {
    currentLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    progressInLevel,
    progressPercentage,
    xpNeeded
  };
};

// Achievement definitions
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first_post',
    title: 'First Steps',
    description: 'Create your first post',
    icon: '✏️',
    xpReward: 50
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Make 10 friends',
    icon: '🦋',
    xpReward: 200
  },
  {
    id: 'content_creator',
    title: 'Content Creator',
    description: 'Create 50 posts',
    icon: '🎨',
    xpReward: 500
  },
  {
    id: 'popular_post',
    title: 'Viral Content',
    description: 'Get 100 likes on a single post',
    icon: '🔥',
    xpReward: 300
  },
  {
    id: 'daily_streak_7',
    title: 'Week Warrior',
    description: 'Log in for 7 consecutive days',
    icon: '📅',
    xpReward: 150
  },
  {
    id: 'daily_streak_30',
    title: 'Month Master',
    description: 'Log in for 30 consecutive days',
    icon: '🗓️',
    xpReward: 1000
  },
  {
    id: 'comment_master',
    title: 'Comment Master',
    description: 'Leave 100 comments',
    icon: '💬',
    xpReward: 250
  },
  {
    id: 'level_10',
    title: 'Rising Star',
    description: 'Reach level 10',
    icon: '⭐',
    xpReward: 500
  },
  {
    id: 'level_25',
    title: 'Superstar',
    description: 'Reach level 25',
    icon: '🌟',
    xpReward: 1000
  },
  {
    id: 'influencer',
    title: 'Influencer',
    description: 'Get 500 followers',
    icon: '👑',
    xpReward: 750
  },
  {
    id: 'community_helper',
    title: 'Community Helper',
    description: 'Report 5 inappropriate posts',
    icon: '🛡️',
    xpReward: 100
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Create 10 posts before 9 AM',
    icon: '🐦',
    xpReward: 200
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Create 10 posts after 10 PM',
    icon: '🦉',
    xpReward: 200
  },
  {
    id: 'photo_enthusiast',
    title: 'Photo Enthusiast',
    description: 'Share 25 posts with images',
    icon: '📸',
    xpReward: 300
  },
  {
    id: 'conversation_starter',
    title: 'Conversation Starter',
    description: 'Create 10 posts that get 5+ comments each',
    icon: '🗣️',
    xpReward: 400
  }
];

// Badge definitions
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'newcomer',
    title: 'Newcomer',
    description: 'Welcome to the community!',
    icon: '👋',
    color: '#4CAF50'
  },
  {
    id: 'active_user',
    title: 'Active User',
    description: 'Consistently engaged with the platform',
    icon: '⚡',
    color: '#FF9800'
  },
  {
    id: 'content_king',
    title: 'Content King',
    description: 'Creates amazing content regularly',
    icon: '👑',
    color: '#9C27B0'
  },
  {
    id: 'social_master',
    title: 'Social Master',
    description: 'Expert at building connections',
    icon: '🤝',
    color: '#2196F3'
  },
  {
    id: 'trendsetter',
    title: 'Trendsetter',
    description: 'Always ahead of the curve',
    icon: '🚀',
    color: '#E91E63'
  },
  {
    id: 'mentor',
    title: 'Mentor',
    description: 'Helps and guides other users',
    icon: '🎓',
    color: '#607D8B'
  },
  {
    id: 'creative_genius',
    title: 'Creative Genius',
    description: 'Produces exceptional creative content',
    icon: '🎨',
    color: '#795548'
  },
  {
    id: 'community_guardian',
    title: 'Community Guardian',
    description: 'Keeps the community safe and positive',
    icon: '🛡️',
    color: '#FF5722'
  }
];

// Daily challenges
export const generateDailyChallenges = (): DailyChallenge[] => {
  const challenges: DailyChallenge[] = [
    {
      id: 'daily_post',
      title: 'Share Your Day',
      description: 'Create 3 posts today',
      requirement: 3,
      type: 'post',
      xpReward: 30
    },
    {
      id: 'daily_likes',
      title: 'Spread the Love',
      description: 'Like 10 posts today',
      requirement: 10,
      type: 'like',
      xpReward: 20
    },
    {
      id: 'daily_comments',
      title: 'Join the Conversation',
      description: 'Comment on 5 posts today',
      requirement: 5,
      type: 'comment',
      xpReward: 25
    },
    {
      id: 'daily_interactions',
      title: 'Be Social',
      description: 'Interact with 15 different users today',
      requirement: 15,
      type: 'interaction',
      xpReward: 40
    },
    {
      id: 'daily_views',
      title: 'Explorer',
      description: 'View 50 posts today',
      requirement: 50,
      type: 'view',
      xpReward: 15
    }
  ];

  // Shuffle and return 3 random challenges
  const shuffled = challenges.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// Achievement checking functions
export const checkAchievements = (user: User, action: XPAction['type'], metadata?: any): string[] => {
  const newAchievements: string[] = [];
  const userAchievements = user.achievements?.map(a => a.id) || [];

  switch (action) {
    case 'post_created':
      if (!userAchievements.includes('first_post')) {
        newAchievements.push('first_post');
      }
      if (user.totalPosts >= 50 && !userAchievements.includes('content_creator')) {
        newAchievements.push('content_creator');
      }
      break;

    case 'friend_added':
      const friendCount = user.friends?.length || 0;
      if (friendCount >= 10 && !userAchievements.includes('social_butterfly')) {
        newAchievements.push('social_butterfly');
      }
      break;

    case 'post_liked':
      if (metadata?.postLikes >= 100 && !userAchievements.includes('popular_post')) {
        newAchievements.push('popular_post');
      }
      break;

    case 'login_daily':
      const streak = user.dailyStreak || 0;
      if (streak >= 7 && !userAchievements.includes('daily_streak_7')) {
        newAchievements.push('daily_streak_7');
      }
      if (streak >= 30 && !userAchievements.includes('daily_streak_30')) {
        newAchievements.push('daily_streak_30');
      }
      break;
  }

  // Level-based achievements
  const currentLevel = calculateLevel(user.xp);
  if (currentLevel >= 10 && !userAchievements.includes('level_10')) {
    newAchievements.push('level_10');
  }
  if (currentLevel >= 25 && !userAchievements.includes('level_25')) {
    newAchievements.push('level_25');
  }

  // Follower-based achievements
  const followerCount = user.followers?.length || 0;
  if (followerCount >= 500 && !userAchievements.includes('influencer')) {
    newAchievements.push('influencer');
  }

  return newAchievements;
};

export const getBadgeForLevel = (level: number): BadgeDefinition | null => {
  if (level >= 25) return BADGE_DEFINITIONS.find(b => b.id === 'content_king') || null;
  if (level >= 15) return BADGE_DEFINITIONS.find(b => b.id === 'active_user') || null;
  if (level >= 5) return BADGE_DEFINITIONS.find(b => b.id === 'newcomer') || null;
  return null;
};

export const getBadgeForAchievements = (achievementCount: number): BadgeDefinition | null => {
  if (achievementCount >= 10) return BADGE_DEFINITIONS.find(b => b.id === 'creative_genius') || null;
  if (achievementCount >= 5) return BADGE_DEFINITIONS.find(b => b.id === 'trendsetter') || null;
  return null;
};

// Progress tracking
export const getAchievementProgress = (user: User, achievementId: string): AchievementProgress => {
  let current = 0;
  let required = 0;

  switch (achievementId) {
    case 'first_post':
      current = Math.min(user.totalPosts, 1);
      required = 1;
      break;
    case 'social_butterfly':
      current = user.friends?.length || 0;
      required = 10;
      break;
    case 'content_creator':
      current = user.totalPosts;
      required = 50;
      break;
    case 'daily_streak_7':
      current = user.dailyStreak || 0;
      required = 7;
      break;
    case 'daily_streak_30':
      current = user.dailyStreak || 0;
      required = 30;
      break;
    case 'level_10':
      current = calculateLevel(user.xp);
      required = 10;
      break;
    case 'level_25':
      current = calculateLevel(user.xp);
      required = 25;
      break;
    case 'influencer':
      current = user.followers?.length || 0;
      required = 500;
      break;
    default:
      current = 0;
      required = 1;
  }

  const percentage = Math.min(Math.floor((current / required) * 100), 100);
  const completed = current >= required;

  return {
    current,
    required,
    percentage,
    completed
  };
};

// Gamification utilities
export const formatXP = (xp: number): string => {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M XP`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K XP`;
  }
  return `${xp} XP`;
};

export const getNextLevelXP = (currentXP: number): number => {
  const currentLevel = calculateLevel(currentXP);
  return getXPForNextLevel(currentLevel) - currentXP;
};

export const getLevelColor = (level: number): string => {
  if (level >= 50) return '#FF6B6B'; // Red for masters
  if (level >= 25) return '#4ECDC4'; // Teal for experts
  if (level >= 10) return '#45B7D1'; // Blue for intermediates
  if (level >= 5) return '#96CEB4'; // Green for beginners
  return '#FFEAA7'; // Yellow for newcomers
};

export const getAchievementDefinition = (achievementId: string): AchievementDefinition | null => {
  return ACHIEVEMENT_DEFINITIONS.find(def => def.id === achievementId) || null;
};

export const getBadgeDefinition = (badgeId: string): BadgeDefinition | null => {
  return BADGE_DEFINITIONS.find(def => def.id === badgeId) || null;
};

// Challenge validation
export const validateChallengeCompletion = (
  challenge: DailyChallenge, 
  userActions: { [key: string]: number }
): boolean => {
  const actionCount = userActions[challenge.type] || 0;
  return actionCount >= challenge.requirement;
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