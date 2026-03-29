import React, { useState, useEffect } from 'react';
import { Platform, BackHandler } from 'react-native';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { addNotificationResponseListener } from '@/services/notificationService';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CombinedMessagesScreen from '../screens/CombinedMessagesScreen';
import PostsFeedScreen from '../screens/PostsFeedScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';
type Screen = 'login' | 'register' | 'home' | 'combined-messages' | 'posts-feed' | 'create-post' | 'achievements' | 'profile' | 'admin' | 'leaderboard';

const AuthNavigator: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [screenHistory, setScreenHistory] = useState<Screen[]>(['login']);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const navigateTo = (screen: Screen, options?: { replace?: boolean }) => {
    setCurrentScreen(screen);
    setScreenHistory((prev) => {
      if (options?.replace) {
        const base = prev.length > 0 ? prev.slice(0, -1) : [];
        return [...base, screen];
      }
      if (prev[prev.length - 1] === screen) {
        return prev;
      }
      return [...prev, screen];
    });
  };

  const goBack = () => {
    setScreenHistory((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.slice(0, -1);
      setCurrentScreen(next[next.length - 1]);
      return next;
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthState('authenticated');
        setCurrentScreen('home');
        setScreenHistory(['home']);
      } else {
        setUser(null);
        setAuthState('unauthenticated');
        setCurrentScreen('login');
        setScreenHistory(['login']);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const onHardwareBackPress = () => {
      if (authState !== 'authenticated') {
        if (currentScreen !== 'login') {
          goBack();
          return true;
        }
        return false;
      }

      if (screenHistory.length > 1) {
        goBack();
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => subscription.remove();
  }, [authState, currentScreen, screenHistory]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = (response.notification.request.content.data || {}) as { screen?: string; type?: string };

      if (data.screen === 'home' || data.type === 'daily_quest_completed') {
        navigateTo('home');
      }
    });

    return () => subscription.remove();
  }, []);

  const handleNavigateToRegister = () => {
    navigateTo('register');
  };

  const handleNavigateToLogin = () => {
    navigateTo('login');
  };

  const handleAuthSuccess = () => {
    // Firebase auth state listener will handle navigation
  };

  const handleNavigateToFriends = () => {
    navigateTo('combined-messages');
  };

  const handleNavigateToHome = () => {
    navigateTo('home');
  };

  const handleNavigateToPostsFeed = () => {
    navigateTo('posts-feed');
  };

  const handleNavigateToCreatePost = () => {
    navigateTo('create-post');
  };

  const handleNavigateToAchievements = () => {
    navigateTo('achievements');
  };

  const handleNavigateToProfile = (userId?: string) => {
    setProfileUserId(userId || null);
    navigateTo('profile');
  };

  const handlePostCreated = () => {
    navigateTo('posts-feed', { replace: true });
  };

  const handleBackFromPosts = () => {
    goBack();
  };

  const handleBackFromFriends = () => {
    goBack();
  };

  const handleBackFromAchievements = () => {
    goBack();
  };

  const handleBackFromProfile = () => {
    setProfileUserId(null);
    goBack();
  };

  const handleNavigateToAdmin = () => {
    navigateTo('admin');
  };

  const handleNavigateToLeaderboard = () => {
    navigateTo('leaderboard');
  };

  const handleBackFromAdmin = () => {
    goBack();
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
            onNavigateToCreatePost={handleNavigateToCreatePost}            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'combined-messages':
        return (
          <CombinedMessagesScreen
            onBack={handleBackFromFriends}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'posts-feed':
        return (
          <PostsFeedScreen
            onCreatePost={handleNavigateToCreatePost}
            onBack={handleBackFromPosts}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'create-post':
        return (
          <CreatePostScreen
            onBack={handleBackFromPosts}
            onPostCreated={handlePostCreated}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'achievements':
        return (
          <AchievementsScreen
            user={user}
            onBack={handleBackFromAchievements}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            userId={profileUserId}
            onBack={handleBackFromProfile}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToAdmin={handleNavigateToAdmin}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'admin':
        return (
          <AdminScreen
            onBack={handleBackFromAdmin}
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
          />
        );
      case 'leaderboard':
        return (
          <LeaderboardScreen
            onNavigateToHome={handleNavigateToHome}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
            onNavigateToAchievements={handleNavigateToAchievements}
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
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
            onNavigateToProfile={handleNavigateToProfile}
            onNavigateToLeaderboard={handleNavigateToLeaderboard}
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