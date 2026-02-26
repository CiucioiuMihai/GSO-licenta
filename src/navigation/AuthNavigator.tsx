import React, { useState, useEffect } from 'react';
import { Platform, Dimensions } from 'react-native';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import FriendsScreen from '../screens/FriendsScreen';
import DirectMessagesScreen from '../screens/DirectMessagesScreen';
import CombinedMessagesScreen from '../screens/CombinedMessagesScreen';
import PostsFeedScreen from '../screens/PostsFeedScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import AchievementsScreen from '../screens/AchievementsScreen';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';
type Screen = 'login' | 'register' | 'home' | 'friends' | 'messages' | 'combined-messages' | 'posts-feed' | 'create-post' | 'achievements';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth > 768;

interface MessageScreenParams {
  conversationId: string;
  otherUserId: string;
}

const AuthNavigator: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [messageParams, setMessageParams] = useState<MessageScreenParams | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthState('authenticated');
        setCurrentScreen('home');
      } else {
        setUser(null);
        setAuthState('unauthenticated');
        setCurrentScreen('login');
      }
    });

    return unsubscribe;
  }, []);

  const handleNavigateToRegister = () => {
    setCurrentScreen('register');
  };

  const handleNavigateToLogin = () => {
    setCurrentScreen('login');
  };

  const handleAuthSuccess = () => {
    // Firebase auth state listener will handle navigation
  };

  const handleNavigateToFriends = () => {
    // Use combined screen for web/tablet, separate screens for mobile
    if (isWeb || isTablet) {
      setCurrentScreen('combined-messages');
    } else {
      setCurrentScreen('friends');
    }
  };

  const handleNavigateToHome = () => {
    setCurrentScreen('home');
  };

  const handleNavigateToPostsFeed = () => {
    setCurrentScreen('posts-feed');
  };

  const handleNavigateToCreatePost = () => {
    setCurrentScreen('create-post');
  };

  const handleNavigateToAchievements = () => {
    setCurrentScreen('achievements');
  };

  const handlePostCreated = () => {
    setCurrentScreen('posts-feed');
  };

  const handleBackFromPosts = () => {
    setCurrentScreen('home');
  };

  const handleStartChat = (otherUserId: string, conversationId: string) => {
    setMessageParams({ conversationId, otherUserId });
    setCurrentScreen('messages');
  };

  const handleBackFromMessages = () => {
    setMessageParams(null);
    setCurrentScreen('friends');
  };

  const handleBackFromFriends = () => {
    setCurrentScreen('home');
  };

  const handleBackFromAchievements = () => {
    setCurrentScreen('home');
  };

  // Show loading screen while checking auth state
  if (authState === 'loading') {
    return null; // You can add a loading spinner here later
  }

  // Show authenticated screens
  if (authState === 'authenticated') {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            user={user}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}            onNavigateToAchievements={handleNavigateToAchievements}          />
        );
      case 'friends':
        return (
          <FriendsScreen
            onStartChat={handleStartChat}
            onBack={handleBackFromFriends}
          />
        );
      case 'combined-messages':
        return (
          <CombinedMessagesScreen
            onBack={handleBackFromFriends}
          />
        );
      case 'posts-feed':
        return (
          <PostsFeedScreen
            onCreatePost={handleNavigateToCreatePost}
            onBack={handleBackFromPosts}
          />
        );
      case 'create-post':
        return (
          <CreatePostScreen
            onBack={handleBackFromPosts}
            onPostCreated={handlePostCreated}
          />
        );
      case 'messages':
        return messageParams ? (
          <DirectMessagesScreen
            conversationId={messageParams.conversationId}
            otherUserId={messageParams.otherUserId}
            onBack={handleBackFromMessages}
          />
        ) : (
          <HomeScreen
            user={user}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
          />
        );
      case 'achievements':
        return (
          <AchievementsScreen
            user={user}
            onBack={handleBackFromAchievements}
          />
        );
      default:
        return (
          <HomeScreen
            user={user}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
          />
        );
    }
  }

  // Show authentication screens
  switch (currentScreen) {
    case 'login':
      return (
        <LoginScreen
          onNavigateToRegister={handleNavigateToRegister}
          onLoginSuccess={handleAuthSuccess}
        />
      );
    case 'register':
      return (
        <RegisterScreen
          onNavigateToLogin={handleNavigateToLogin}
          onRegisterSuccess={handleAuthSuccess}
        />
      );
    default:
      return (
        <LoginScreen
          onNavigateToRegister={handleNavigateToRegister}
          onLoginSuccess={handleAuthSuccess}
        />
      );
  }
};

export default AuthNavigator;