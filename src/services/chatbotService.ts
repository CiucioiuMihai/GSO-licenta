import { GoogleGenerativeAI } from '@google/generative-ai';
import { User } from '@/types';

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Bot user ID constant
export const BOT_USER_ID = 'system_bot_assistant';

// Bot user data
export const BOT_USER: User = {
  id: BOT_USER_ID,
  displayName: 'GSO Assistant',
  email: 'bot@gso.app',
  profilePicture: 'https://via.placeholder.com/100/667eea/ffffff?text=BOT',
  bio: 'Your friendly AI assistant here to help you with the app!',
  xp: 9999,
  level: 99,
  badges: [],
  achievements: [],
  friends: [],
  following: [],
  followers: [],
  totalPosts: 0,
  totalLikes: 0,
  totalComments: 0,
  totalFollowers: 0,
  totalFollowing: 0,
  totalFriends: 0,
  isOnline: true,
  createdAt: new Date(),
  lastActive: new Date(),
};

/**
 * Generate a response from the chatbot based on user message and context
 */
export const getBotResponse = async (
  message: string,
  userData?: User | null
): Promise<string> => {
  try {
    if (!genAI) {
      throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Build context about the user and app
    let contextPrompt = `You are GSO Assistant, a friendly and helpful AI assistant for a gamified social media app called GSO (Gamified Social Outreach).

Your personality:
- Friendly, encouraging, and genuinely supportive
- You understand the gamification system (XP, levels, achievements, badges)
- You help users navigate the app, maximize their experience, and overcome challenges
- You celebrate user achievements and milestones with enthusiasm
- You provide practical tips and strategies for engaging with the community
- Keep responses concise (2-3 sentences max unless explaining something complex)
- Use emojis occasionally to be friendly and approachable 😊
- Be conversational and natural, not robotic

XP & Leveling System (explain when asked):
- Creating posts: +10 XP
- Receiving likes on posts: +2 XP per like
- Receiving comments: +1 XP per comment
- Adding friends: +5 XP per friend
- Daily login bonus: +5 XP (daily streak bonus increases over time)
- Total levels go from 1-100+
- Level milestones unlock new features and achievements

Achievement System:
- Social achievements: Friend milestones (5, 10, 25, 50 friends)
- Content achievements: Post milestones (10, 25, 100, 250 posts)
- Engagement achievements: Like/comment milestones (50, 100, 500, 1000 likes/comments)
- Streak achievements: Login streaks and daily consistency
- Special achievements: Hidden unlocks for unique behaviors

App Features & Navigation:
- Posts: Create rich content with images, descriptions, and tags
- Comments & Replies: Engage with content, build discussions
- Direct Messaging: Private conversations with other users
- Friend System: Connect with people, build network
- Leaderboard: See global rankings and your position
- Profile: Showcase your stats, achievements, and content
- Feed filtering: View "All" posts, "Following" updates, "Friends" content, or specific tags
- Themes & Personalization: Customize your experience
- Offline Mode: Create posts and draft messages offline, sync when reconnected
- Notifications: Get alerts for interactions with your content

Tips for New Users:
- Engage authentically - quality interactions beat volume
- Create varied content to stay interesting
- Comment on others' posts to build relationships
- Aim for consistent daily activity (5 XP daily bonus)
- Join conversations in popular tags to grow visibility
- Help others - communities thrive on support

Common Questions to Anticipate:
- How to make more friends (engagement, activity, genuine interaction)
- How to gain followers (consistency, quality content, community participation)
- How to get achievements (work toward specific milestones)
- How to recover from offline sync issues (manual refresh, check connection)
- How to report issues or provide feedback (app support features)

`;

    if (userData) {
      contextPrompt += `Current user info:
- Name: ${userData.displayName}
- Level: ${userData.level}
- XP: ${userData.xp}
- Friends: ${userData.totalFriends || userData.friends?.length || 0}
- Total Posts: ${userData.totalPosts || 0}
- Total Likes Received: ${userData.totalLikes || 0}
- Following: ${userData.totalFollowing || userData.following?.length || 0}
- Followers: ${userData.totalFollowers || userData.followers?.length || 0}
- Daily Streak: ${userData.dailyStreak || 0} days
- Achievements: ${userData.achievements?.length || 0} unlocked

`;
    }

    contextPrompt += `User message: ${message}

Respond helpfully and concisely. If asked about their stats, use the info above. If asked how to gain XP or level up, explain the XP system. If they need help with features, guide them.`;

    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    const isMissingKeyError =
      error instanceof Error && error.message.includes('Missing EXPO_PUBLIC_GEMINI_API_KEY');

    // Missing key is an expected deploy/config state; avoid noisy red-box style logging.
    if (!isMissingKeyError) {
      console.error('Error getting bot response:', error);
    }
    
    // Comprehensive fallback responses if API fails
    const lowerMessage = message.toLowerCase();

    // XP & Leveling questions
    if (lowerMessage.includes('level') || lowerMessage.includes('xp')) {
      return `You gain XP through:\n• Posts (+10 XP each)\n• Likes received (+2 per like)\n• Comments received (+1 per comment)\n• Friends added (+5 per friend)\n• Daily login (+5 XP)\n\nLevel up to unlock achievements and new features! 🚀`;
    }

    // Friend & Network questions
    if (lowerMessage.includes('friend') || lowerMessage.includes('follow')) {
      return `To grow your network:\n• Engage authentically with content\n• Comment on posts to show interest\n• Find users through tags and interests\n• Join communities around topics you love\n• Be genuine - people connect with real you!\n\nYou earn +5 XP per new friend! 👥`;
    }

    // Achievement questions
    if (lowerMessage.includes('achievement') || lowerMessage.includes('badge')) {
      return `Achievements unlock through milestones:\n• Social: Friend counts (5, 10, 25, 50)\n• Content: Post counts (10, 25, 100, 250)\n• Engagement: Likes/comments (50, 100, 500+)\n• Streaks: Daily consistency\n• Hidden: Special behaviors\n\nKeep playing to unlock them all! 🏆`;
    }

    // Content & Posting questions
    if (lowerMessage.includes('post') || lowerMessage.includes('create') || lowerMessage.includes('content')) {
      return `Tips for great posts:\n• Make your title eye-catching\n• Add images to increase engagement\n• Use relevant tags for discoverability\n• Be authentic and genuine\n• Respond to comments to build community\n• Create varied content types\n\nEach post earns +10 XP! ✨`;
    }

    // Engagement & Interaction questions
    if (lowerMessage.includes('comment') || lowerMessage.includes('like') || lowerMessage.includes('interact')) {
      return `Building engagement:\n• Comment thoughtfully on posts you enjoy\n• Reply to comments on your posts quickly\n• Use tags to find content in your interests\n• Support new creators\n• Start conversations with questions\n• Share genuine reactions\n\nEvery interaction grows the community! 💬`;
    }

    // Messaging & DM questions
    if (lowerMessage.includes('message') || lowerMessage.includes('dm') || lowerMessage.includes('chat')) {
      return `Direct Messages:\n• Send private messages to any user\n• Have real-time conversations\n• Share images and media\n• Messages sync offline - send anytime!\n• See active status of friends\n• Start meaningful one-on-ones\n\nConnect deeper with direct chats! 💌`;
    }

    // Profile & Personalization
    if (lowerMessage.includes('profile') || lowerMessage.includes('personalize') || lowerMessage.includes('customize')) {
      return `Personalize your profile:\n• Add a bio about yourself\n• Set a profile picture\n• Showcase your achievements\n• Display recent posts\n• Set your preferences\n• Share your interests through tags\n\nMake your profile uniquely YOU! 🎨`;
    }

    // Offline mode
    if (lowerMessage.includes('offline')) {
      return `Offline Features:\n• Create posts offline (queued for sync)\n• Draft messages\n• View downloaded content\n• Check your local data\n• Changes sync automatically when online\n• No need to worry - nothing is lost!\n\nGSO works even without internet! 📡`;
    }

    // Performance & Technical
    if (lowerMessage.includes('slow') || lowerMessage.includes('lag') || lowerMessage.includes('crash') || lowerMessage.includes('bug')) {
      return `Having technical issues? Try:\n• Restart the app\n• Check your internet connection\n• Clear app cache\n• Update to the latest version\n• Disable offline mode if stuck\n• Contact support if persistent\n\nMost issues resolve with a fresh start! 🔧`;
    }

    // Leaderboard & Ranking
    if (lowerMessage.includes('leaderboard') || lowerMessage.includes('rank') || lowerMessage.includes('leader')) {
      return `Leaderboard Basics:\n• Shows top 50 players by XP\n• See your global rank\n• Compare your level/XP\n• View others' achievements\n• Your position updates in real-time\n• Aim to climb the ranks! 📊`;
    }

    // Tips & Strategy
    if (lowerMessage.includes('tip') || lowerMessage.includes('strategy') || lowerMessage.includes('how to')) {
      return `Pro Tips for GSO:\n• Log in daily for +5 XP bonus\n• Create posts consistently\n• Engage with trending content\n• Build genuine friendships\n• Comment meaningfully, not spam\n• Share your authentic interests\n• Help newer users learn\n\nSmall consistent actions > big efforts! 💡`;
    }

    // Features overview
    if (lowerMessage.includes('feature') || lowerMessage.includes('what can i')) {
      return `GSO Features:\n✅ Posts with images & tags\n✅ Comments & threaded discussions\n✅ Direct messaging\n✅ Friend system\n✅ Achievements & leaderboard\n✅ Offline post creation\n✅ Notifications\n✅ Feed filtering\n\nExplore and have fun! 🎮`;
    }

    // General help
    if (lowerMessage.includes('help') || lowerMessage.includes('what do you')) {
      return `I can help with:\n• XP & leveling strategies\n• Achievement hunting\n• Growing your network\n• Content creation tips\n• Feature navigation\n• Technical issues\n• App tips & tricks\n\nWhat would you like to know? 😊`;
    }

    // Congratulations / Celebrations
    if (lowerMessage.includes('thank') || lowerMessage.includes('awesome') || lowerMessage.includes('great')) {
      return `Happy to help! 🎉 You're doing great with GSO. Keep crushing those XP milestones and leveling up! Your dedication is inspiring! 💪`;
    }

    // Default fallback
    return "That's a great question! I'm having trouble connecting right now, but you can explore these topics: leveling, friendships, achievements, posts, or just ask for tips! 🤖";
  }
};

/**
 * Get a welcome message for new users chatting with the bot
 */
export const getWelcomeMessage = (userData?: User | null): string => {
  if (userData) {
    let message = `Hey ${userData.displayName}! 👋 I'm GSO Assistant, your AI helper.\n\n`;
    message += `You're Level ${userData.level} with ${userData.xp} XP. `;

    // Context-specific messages
    if (userData.level < 5) {
      message += `You're just getting started - awesome! 🚀 Keep creating posts and connecting with friends to level up fast!`;
    } else if (userData.level < 15) {
      message += `Great progress! You're building momentum. 💪 Keep it up to unlock more achievements!`;
    } else if (userData.level < 30) {
      message += `You're an emerging GSO power user! 🌟 Your dedication is showing - aim for the leaderboard!`;
    } else if (userData.level < 50) {
      message += `Wow, you're an advanced player! 🏆 You're crushing the game - keep the momentum going!`;
    } else {
      message += `You're a GSO legend! 👑 Your expertise is incredible - you're inspiring others!`;
    }

    message += `\n\nI can help with leveling strategies, achievements, content tips, or anything else. What's on your mind?`;
    return message;
  }

  return `Hello! 👋 I'm GSO Assistant, here to help you make the most of the app.\n\nI can help with:\n• Growing your XP and levels\n• Unlocking achievements\n• Finding friends and building your network\n• Content creation tips\n• Understanding app features\n• Strategy and pro tips\n\nWhat would you like to know? 😊`;
};

/**
 * Get quick reply suggestions based on user state
 */
export const getQuickReplySuggestions = (userData?: User | null): string[] => {
  const baseSuggestions = [
    'How do I level up?',
    'What are achievements?',
    'Tips for posts',
    'How to find friends?',
  ];

  // Personalized suggestions based on user progress
  if (userData) {
    const suggestions: string[] = [];

    // Early game (levels 1-10)
    if (userData.level < 10) {
      suggestions.push('How do I gain XP fast?');
      suggestions.push('Getting started guide');
    }

    // New to friends (< 5 friends)
    if ((userData.totalFriends || 0) < 5) {
      suggestions.push('How to find friends?');
      suggestions.push('Engagement tips');
    }

    // Low post count (< 10 posts)
    if ((userData.totalPosts || 0) < 10) {
      suggestions.push('Tips for creating posts');
      suggestions.push('Content ideas');
    }

    // Mid-level player (10-30)
    if (userData.level >= 10 && userData.level < 30) {
      suggestions.push('What are badges?');
      suggestions.push('Leaderboard ranking');
    }

    // Advanced player (30+)
    if (userData.level >= 30) {
      suggestions.push('Secret achievements');
      suggestions.push('Pro strategies');
    }

    // Active user with good engagement
    if ((userData.totalLikes || 0) > 50) {
      suggestions.push('Growing my network');
      suggestions.push('Community tips');
    }

    // New user with low activity
    if (userData.totalPosts === 0 && userData.totalFriends === 0) {
      suggestions.push('Getting started');
      suggestions.push('First post tips');
    }

    // Mix in base suggestions and limit to 4
    return [...new Set([...suggestions, ...baseSuggestions])].slice(0, 4);
  }

  return baseSuggestions.slice(0, 4);
};

/**
 * Check if a message is from the bot
 */
export const isBotMessage = (userId: string): boolean => {
  return userId === BOT_USER_ID;
};

/**
 * Get typing delay to simulate realistic bot response
 */
export const getTypingDelay = (messageLength: number): number => {
  // Base delay + length-based delay (simulate reading/typing)
  const baseDelay = 500;
  const lengthDelay = Math.min(messageLength * 20, 2000); // Max 2 seconds
  return baseDelay + lengthDelay;
};
