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
  likes: number;
  comments: number;
  shares: number;
  likedBy: string[];
  hasImages?: boolean;
  imageCount?: number;
  hasMultipleImages?: boolean;
  firstImage?: PostImage;
  createdAt: Date;
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
  createdAt: Date;
  isLocal?: boolean;
  synced?: boolean;
}

export interface Achievement {
  id: string;
  unlockedAt: Date;
}

export interface Badge {
  id: string;
  awardedAt: Date;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  requirement: number;
  type: 'post' | 'like' | 'comment' | 'interaction' | 'view';
  xpReward: number;
}

export interface Challenge {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  title: string;
  description: string;
  participants: string[];
  completions: ChallengeCompletion[];
  createdAt: Date;
  expiresAt: Date;
}

export interface ChallengeCompletion {
  userId: string;
  completedAt: Date;
}

export interface Tournament {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  participants: string[];
  status: 'upcoming' | 'active' | 'completed';
  createdAt: Date;
  startDate?: Date;
  endDate?: Date;
}

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