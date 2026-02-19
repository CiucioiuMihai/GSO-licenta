import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import FriendsScreen from '../screens/FriendsScreen';
import DirectMessagesScreen from '../screens/DirectMessagesScreen';
import PostsFeedScreen from '../screens/PostsFeedScreen';
import CreatePostScreen from '../screens/CreatePostScreen';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';
type Screen = 'login' | 'register' | 'home' | 'friends' | 'messages' | 'posts-feed' | 'create-post';

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
    setCurrentScreen('friends');
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
            onNavigateToCreatePost={handleNavigateToCreatePost}
          />
        );
      case 'friends':
        return (
          <FriendsScreen
            onStartChat={handleStartChat}
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
          />
        );
      default:
        return (
          <HomeScreen
            user={user}
            onNavigateToFriends={handleNavigateToFriends}
            onNavigateToPostsFeed={handleNavigateToPostsFeed}
            onNavigateToCreatePost={handleNavigateToCreatePost}
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