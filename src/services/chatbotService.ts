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
- Friendly, encouraging, and supportive
- You understand the gamification system (XP, levels, achievements, badges)
- You help users navigate the app and maximize their experience
- You celebrate user achievements and progress
- Keep responses concise (2-3 sentences max unless explaining something complex)
- Use emojis occasionally to be friendly 😊

App features you can help with:
- Leveling system: Users gain XP from posts (+10), likes received (+2), comments received (+1), friends added (+5), daily logins (+5)
- Achievements and badges for milestones
- Posts with images, tags, and comments
- Friend system and following users
- Direct messaging
- Feed filtering (All, Following, Friends, Tags)
- Offline mode

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
    console.error('Error getting bot response:', error);
    
    // Fallback responses if API fails
    if (message.toLowerCase().includes('level') || message.toLowerCase().includes('xp')) {
      return `To gain XP and level up:\n• Create posts (+10 XP)\n• Receive likes on posts (+2 XP each)\n• Get comments (+1 XP each)\n• Add friends (+5 XP each)\n• Login daily (+5 XP)`;
    }
    
    if (message.toLowerCase().includes('help')) {
      return `I can help you with:\n• Understanding the leveling system\n• Finding friends and connecting\n• Creating posts and content\n• Tracking achievements\n• App features and navigation\n\nWhat would you like to know? 😊`;
    }
    
    return "I'm having trouble connecting right now. Please try again in a moment! 🤖";
  }
};

/**
 * Get a welcome message for new users chatting with the bot
 */
export const getWelcomeMessage = (userData?: User | null): string => {
  if (userData) {
    return `Hey ${userData.displayName}! 👋 I'm GSO Assistant, your AI helper.\n\nYou're currently Level ${userData.level} with ${userData.xp} XP. ${
      userData.level < 5 
        ? "Keep creating posts and connecting with friends to level up!" 
        : "Great progress! You're becoming a GSO expert!"
    }\n\nHow can I help you today?`;
  }
  
  return `Hello! 👋 I'm GSO Assistant, here to help you make the most of the app.\n\nI can answer questions about:\n• Leveling up and earning XP\n• Achievements and badges\n• App features\n• Tips for growing your network\n\nWhat would you like to know?`;
};

/**
 * Get quick reply suggestions based on user state
 */
export const getQuickReplySuggestions = (userData?: User | null): string[] => {
  const suggestions = ['How do I level up?', 'What are achievements?', 'Help'];
  
  if (userData) {
    if (userData.level < 5) {
      suggestions.unshift('How do I gain XP fast?');
    }
    
    if ((userData.totalFriends || 0) < 5) {
      suggestions.push('How do I find friends?');
    }
    
    if ((userData.totalPosts || 0) < 10) {
      suggestions.push('Tips for creating posts');
    }
  }
  
  return suggestions.slice(0, 4); // Return max 4 suggestions
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
