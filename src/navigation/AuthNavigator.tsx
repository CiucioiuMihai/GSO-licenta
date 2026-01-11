import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/services/firebase';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';
type Screen = 'login' | 'register' | 'home';

const AuthNavigator: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<FirebaseUser | null>(null);

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

  // Show loading screen while checking auth state
  if (authState === 'loading') {
    return null; // You can add a loading spinner here later
  }

  // Show authenticated screens
  if (authState === 'authenticated') {
    return <HomeScreen user={user} />;
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