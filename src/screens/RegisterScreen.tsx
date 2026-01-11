import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { User } from '@/types';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
  onRegisterSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!email || !password || !confirmPassword || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    if (displayName.length < 2) {
      Alert.alert('Error', 'Display name must be at least 2 characters');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update user profile with display name
      await updateProfile(firebaseUser, {
        displayName: displayName,
      });

      // Create user document in Firestore
      const userData: Omit<User, 'id'> = {
        email: email,
        displayName: displayName,
        profilePicture: '',
        bio: '',
        xp: 0,
        level: 1,
        badges: [],
        achievements: [],
        friends: [],
        following: [],
        followers: [],
        totalPosts: 0,
        totalLikes: 0,
        totalFollowers: 0,
        totalFollowing: 0,
        totalFriends: 0,
        dailyStreak: 0,
        lastLoginDate: new Date(),
        totalDaysActive: 1,
        isOnline: true,
        createdAt: new Date(),
        lastActive: new Date(),
        suspended: false,
        blockedUsers: [],
        virtualCurrency: {},
        lastCurrencyUpdate: new Date(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData);

      Alert.alert('Success', 'Account created successfully!');
      onRegisterSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.logo}>🎮 GSO</Text>
                <Text style={styles.subtitle}>Gamified Social Media</Text>
                <Text style={styles.welcome}>Join the Community!</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Display Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Choose your username"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password (min. 6 characters)"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#667eea" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <TouchableOpacity onPress={onNavigateToLogin}>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 700,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 20,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 5,
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;