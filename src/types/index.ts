export interface User {
  id: string;
  displayName: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  xp: number;
  level: number;
  badges: Badge[];
  achievements: Achievement[];
  friends: string[];
  following: string[];
  followers: string[];
  totalPosts: number;
  totalLikes: number;
  totalFollowers?: number;
  totalFollowing?: number;
  totalFriends?: number;
  dailyStreak?: number;
  lastLoginDate?: Date;
  totalDaysActive?: number;
  isOnline: boolean;
  createdAt: Date;
  lastActive: Date;
  suspended?: boolean;
  suspensionEnd?: Date;
  suspensionReason?: string;
  suspendedBy?: string;
  suspendedAt?: Date;
  blockedUsers?: string[];
  privacySettings?: PrivacySettings;
  virtualCurrency?: { [key: string]: number };
  lastCurrencyUpdate?: Date;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  images?: PostImage[];
  tags?: string[];
  likes: number;
  comments: number;
  shares: number;
  likedBy: string[];
  hasImages?: boolean;
  imageCount?: number;
  hasMultipleImages?: boolean;
  firstImage?: PostImage;
  createdAt: Date;
  updatedAt?: Date;
  isLocal?: boolean;
  synced?: boolean;
  isLocallyModified?: boolean;
  moderationStatus?: 'approved' | 'rejected' | 'flagged';
  moderatedBy?: string;
  moderationReason?: string;
  moderatedAt?: Date;
}

export interface PostImage {
  data: string; // Base64 image data
  width: number;
  height: number;
  size: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  likes: number;
  likedBy: string[];
  replies: Reply[];
  repliesCount: number;
  parentId?: string; // For nested replies
  createdAt: Date;
  updatedAt?: Date;
  isLocal?: boolean;
  synced?: boolean;
}

export interface Reply {
  id: string;
  commentId: string;
  userId: string;
  text: string;
  likes: number;
  likedBy: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface Tag {
  id: string;
  name: string;
  postsCount: number;
  trending?: boolean;
  createdAt: Date;
  lastUsed: Date;
}

export interface Achievement {
  id: string;
  unlockedAt: Date;
}

export interface Badge {
  id: string;
  awardedAt: Date;
}

// Level System Definitions
export interface LevelDefinition {
  level: number;
  title: string;
  xpRequired: number;
  xpToNext: number;
  icon: string;
  color: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  category: 'social' | 'content' | 'engagement' | 'special';
  requirement: {
    type: 'friends' | 'posts' | 'likes' | 'comments' | 'followers' | 'streak';
    count: number;
  };
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// XP Sources
export interface XPSource {
  action: 'create_post' | 'receive_like_post' | 'receive_comment' | 'receive_like_comment' | 'add_friend' | 'daily_login';
  xpAmount: number;
}

// Level Tiers
export type LevelTier = 'newcomer' | 'regular' | 'active' | 'power' | 'elite' | 'legendary';

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'friend_accepted' | 'new_follower' | 'post_liked' | 'comment_added' | 'achievement_unlocked';
  fromUserId?: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  acceptedAt?: Date;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Date;
  [key: `unreadCount_${string}`]: number;
}

export interface Report {
  id: string;
  reporterId: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'user';
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  postVisibility: 'public' | 'friends' | 'private';
  allowMessages: 'everyone' | 'friends' | 'none';
  allowFriendRequests: boolean;
  showOnlineStatus: boolean;
  allowTagging: boolean;
  updatedAt: Date;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  type: 'identity' | 'business' | 'creator';
  documents: string[]; // Base64 encoded documents
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
}

export interface XPTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  timestamp: Date;
  previousXP: number;
  newXP: number;
}

export interface UserAction {
  id: string;
  userId: string;
  action: string;
  metadata?: any;
  timestamp: Date;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  type: 'post_created' | 'achievement_unlocked' | 'level_up' | 'friend_added';
  metadata: any;
  createdAt: Date;
}

export interface LeaderboardUser extends User {
  rank: number;
}

export interface LevelProgress {
  currentLevel: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressInLevel: number;
  progressPercentage: number;
  xpNeeded: number;
}

export interface NetworkState {
  isConnected: boolean;
  connectionType: string;
}

export interface SyncStatus {
  pendingActions: number;
  lastSyncTime: number;
  syncInProgress: boolean;
  isConnected: boolean;
}

export interface OfflineAction {
  id: string;
  type: string;
  userId: string;
  data: any;
  timestamp: number;
  postId?: string;
  text?: string;
  updates?: any;
  amount?: number;
  reason?: string;
}

export interface ImagePickerResult {
  base64: string;
  width: number;
  height: number;
  size: number;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface PasswordValidation {
  isValid: boolean;
  score: {
    length: boolean;
    upperCase: boolean;
    lowerCase: boolean;
    numbers: boolean;
    specialChar: boolean;
  };
}

export interface AchievementProgress {
  current: number;
  required: number;
  percentage: number;
  completed: boolean;
}

// Predefined Levels (1-25)
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  { level: 1, title: 'Newcomer', xpRequired: 0, xpToNext: 50, icon: '🌱', color: '#A8E6CF' },
  { level: 2, title: 'Explorer', xpRequired: 50, xpToNext: 100, icon: '🔍', color: '#A8E6CF' },
  { level: 3, title: 'Contributor', xpRequired: 150, xpToNext: 150, icon: '✍️', color: '#A8E6CF' },
  { level: 4, title: 'Socializer', xpRequired: 300, xpToNext: 200, icon: '💬', color: '#A8E6CF' },
  { level: 5, title: 'Friend Maker', xpRequired: 500, xpToNext: 250, icon: '🤝', color: '#DCEDC8' },
  { level: 6, title: 'Regular', xpRequired: 750, xpToNext: 250, icon: '⭐', color: '#DCEDC8' },
  { level: 7, title: 'Engaged User', xpRequired: 1000, xpToNext: 300, icon: '🎯', color: '#DCEDC8' },
  { level: 8, title: 'Connector', xpRequired: 1300, xpToNext: 350, icon: '🔗', color: '#DCEDC8' },
  { level: 9, title: 'Community Member', xpRequired: 1650, xpToNext: 350, icon: '👥', color: '#DCEDC8' },
  { level: 10, title: 'Active User', xpRequired: 2000, xpToNext: 400, icon: '🔥', color: '#FFE0B2' },
  { level: 11, title: 'Dedicated', xpRequired: 2400, xpToNext: 450, icon: '💎', color: '#FFE0B2' },
  { level: 12, title: 'Influencer', xpRequired: 2850, xpToNext: 500, icon: '📢', color: '#FFE0B2' },
  { level: 13, title: 'Content Pro', xpRequired: 3350, xpToNext: 550, icon: '🎨', color: '#FFE0B2' },
  { level: 14, title: 'Trendsetter', xpRequired: 3900, xpToNext: 600, icon: '🌟', color: '#FFE0B2' },
  { level: 15, title: 'Power User', xpRequired: 4500, xpToNext: 750, icon: '⚡', color: '#FFCCBC' },
  { level: 16, title: 'Elite', xpRequired: 5250, xpToNext: 900, icon: '👑', color: '#FFCCBC' },
  { level: 17, title: 'Champion', xpRequired: 6150, xpToNext: 1050, icon: '🏆', color: '#FFCCBC' },
  { level: 18, title: 'Master', xpRequired: 7200, xpToNext: 1200, icon: '🎖️', color: '#FFCCBC' },
  { level: 19, title: 'Legend', xpRequired: 8400, xpToNext: 1400, icon: '🌠', color: '#F8BBD0' },
  { level: 20, title: 'Icon', xpRequired: 9800, xpToNext: 1700, icon: '💫', color: '#F8BBD0' },
  { level: 21, title: 'Superstar', xpRequired: 11500, xpToNext: 2000, icon: '🌟', color: '#E1BEE7' },
  { level: 22, title: 'Guru', xpRequired: 13500, xpToNext: 2500, icon: '🧙', color: '#E1BEE7' },
  { level: 23, title: 'Virtuoso', xpRequired: 16000, xpToNext: 3000, icon: '🎭', color: '#D1C4E9' },
  { level: 24, title: 'Mythic', xpRequired: 19000, xpToNext: 4000, icon: '🔮', color: '#D1C4E9' },
  { level: 25, title: 'Legendary', xpRequired: 23000, xpToNext: 0, icon: '🏅', color: '#FFD700' },
];

// Achievement Definitions
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // First Steps
  { id: 'first_post', title: 'First Post', description: 'Create your first post', icon: '📝', xpReward: 25, category: 'content', requirement: { type: 'posts', count: 1 } },
  { id: 'first_friend', title: 'First Friend', description: 'Add your first friend', icon: '👋', xpReward: 25, category: 'social', requirement: { type: 'friends', count: 1 } },
  { id: 'first_like', title: 'First Like', description: 'Receive your first like', icon: '❤️', xpReward: 10, category: 'engagement', requirement: { type: 'likes', count: 1 } },
  
  // Social Achievements
  { id: 'friend_circle', title: 'Friend Circle', description: 'Add 5 friends', icon: '👥', xpReward: 50, category: 'social', requirement: { type: 'friends', count: 5 } },
  { id: 'social_butterfly', title: 'Social Butterfly', description: 'Add 10 friends', icon: '🦋', xpReward: 100, category: 'social', requirement: { type: 'friends', count: 10 } },
  { id: 'friend_collector', title: 'Friend Collector', description: 'Add 25 friends', icon: '🎯', xpReward: 200, category: 'social', requirement: { type: 'friends', count: 25 } },
  { id: 'networking_pro', title: 'Networking Pro', description: 'Add 50 friends', icon: '🌐', xpReward: 500, category: 'social', requirement: { type: 'friends', count: 50 } },
  { id: 'super_connector', title: 'Super Connector', description: 'Add 100 friends', icon: '🔗', xpReward: 1000, category: 'social', requirement: { type: 'friends', count: 100 } },
  
  // Content Creator Achievements
  { id: 'getting_started', title: 'Getting Started', description: 'Create 5 posts', icon: '✍️', xpReward: 50, category: 'content', requirement: { type: 'posts', count: 5 } },
  { id: 'content_creator', title: 'Content Creator', description: 'Create 10 posts', icon: '📱', xpReward: 100, category: 'content', requirement: { type: 'posts', count: 10 } },
  { id: 'regular_poster', title: 'Regular Poster', description: 'Create 25 posts', icon: '📸', xpReward: 250, category: 'content', requirement: { type: 'posts', count: 25 } },
  { id: 'prolific_writer', title: 'Prolific Writer', description: 'Create 50 posts', icon: '📚', xpReward: 500, category: 'content', requirement: { type: 'posts', count: 50 } },
  { id: 'content_machine', title: 'Content Machine', description: 'Create 100 posts', icon: '🚀', xpReward: 1000, category: 'content', requirement: { type: 'posts', count: 100 } },
  { id: 'legendary_creator', title: 'Legendary Creator', description: 'Create 250 posts', icon: '🎨', xpReward: 2500, category: 'content', requirement: { type: 'posts', count: 250 } },
  
  // Engagement Achievements
  { id: 'liked', title: 'Liked', description: 'Receive 10 likes', icon: '💖', xpReward: 50, category: 'engagement', requirement: { type: 'likes', count: 10 } },
  { id: 'popular', title: 'Popular', description: 'Receive 50 likes', icon: '🌟', xpReward: 100, category: 'engagement', requirement: { type: 'likes', count: 50 } },
  { id: 'crowd_favorite', title: 'Crowd Favorite', description: 'Receive 100 likes', icon: '⭐', xpReward: 200, category: 'engagement', requirement: { type: 'likes', count: 100 } },
  { id: 'viral', title: 'Viral', description: 'Receive 500 likes', icon: '🔥', xpReward: 500, category: 'engagement', requirement: { type: 'likes', count: 500 } },
  { id: 'internet_sensation', title: 'Internet Sensation', description: 'Receive 1000 likes', icon: '💫', xpReward: 1000, category: 'engagement', requirement: { type: 'likes', count: 1000 } },
  { id: 'megastar', title: 'Megastar', description: 'Receive 5000 likes', icon: '🌠', xpReward: 5000, category: 'engagement', requirement: { type: 'likes', count: 5000 } },
  
  // Conversation Achievements
  { id: 'conversation_starter', title: 'Conversation Starter', description: 'Receive 10 comments', icon: '💬', xpReward: 50, category: 'engagement', requirement: { type: 'comments', count: 10 } },
  { id: 'discussion_leader', title: 'Discussion Leader', description: 'Receive 25 comments', icon: '🗣️', xpReward: 100, category: 'engagement', requirement: { type: 'comments', count: 25 } },
  { id: 'community_voice', title: 'Community Voice', description: 'Receive 50 comments', icon: '📣', xpReward: 250, category: 'engagement', requirement: { type: 'comments', count: 50 } },
  { id: 'thought_leader', title: 'Thought Leader', description: 'Receive 100 comments', icon: '💡', xpReward: 500, category: 'engagement', requirement: { type: 'comments', count: 100 } },
  
  // Follower Achievements
  { id: 'gaining_traction', title: 'Gaining Traction', description: 'Get 10 followers', icon: '📈', xpReward: 50, category: 'social', requirement: { type: 'followers', count: 10 } },
  { id: 'rising_star', title: 'Rising Star', description: 'Get 25 followers', icon: '🌟', xpReward: 125, category: 'social', requirement: { type: 'followers', count: 25 } },
  { id: 'influencer_status', title: 'Influencer Status', description: 'Get 50 followers', icon: '👑', xpReward: 250, category: 'social', requirement: { type: 'followers', count: 50 } },
  { id: 'celebrity', title: 'Celebrity', description: 'Get 100 followers', icon: '⭐', xpReward: 500, category: 'social', requirement: { type: 'followers', count: 100 } },
  
  // Special Achievements
  { id: 'week_streak', title: 'Week Warrior', description: 'Log in for 7 days in a row', icon: '🔥', xpReward: 100, category: 'special', requirement: { type: 'streak', count: 7 } },
  { id: 'month_streak', title: 'Monthly Master', description: 'Log in for 30 days in a row', icon: '📅', xpReward: 500, category: 'special', requirement: { type: 'streak', count: 30 } },
];

// XP Rewards Configuration
export const XP_REWARDS: Record<XPSource['action'], number> = {
  create_post: 10,
  receive_like_post: 2,
  receive_comment: 5,
  receive_like_comment: 1,
  add_friend: 20,
  daily_login: 5,
};