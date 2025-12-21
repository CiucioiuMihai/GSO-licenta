import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { auth } from './firebase';
import { createUser, getUser, updateUserOnlineStatus } from './firestore';
import { User } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Authentication functions
export const signUp = async (userData: SignUpData): Promise<AuthResult> => {
  try {
    const { email, password, displayName } = userData;
    
    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update Firebase profile
    await updateProfile(firebaseUser, { displayName });
    
    // Send email verification
    await sendEmailVerification(firebaseUser);
    
    // Create user document in Firestore
    await createUser(firebaseUser.uid, {
      id: firebaseUser.uid,
      email,
      displayName,
      createdAt: new Date(),
      lastActive: new Date(),
      isOnline: true,
      xp: 0,
      level: 1,
      badges: [],
      achievements: [],
      friends: [],
      following: [],
      followers: [],
      totalPosts: 0,
      totalLikes: 0
    });
    
    // Get the created user
    const user = await getUser(firebaseUser.uid);
    
    return {
      success: true,
      user: user || undefined
    };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError.code)
    };
  }
};

export const signIn = async (credentials: SignInData): Promise<AuthResult> => {
  try {
    const { email, password } = credentials;
    
    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update online status
    await updateUserOnlineStatus(firebaseUser.uid, true);
    
    // Get user data
    const user = await getUser(firebaseUser.uid);
    
    return {
      success: true,
      user: user || undefined
    };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError.code)
    };
  }
};

export const signOut = async (): Promise<AuthResult> => {
  try {
    const currentUser = auth.currentUser;
    
    // Update online status before signing out
    if (currentUser) {
      await updateUserOnlineStatus(currentUser.uid, false);
    }
    
    await firebaseSignOut(auth);
    
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError.code)
    };
  }
};

export const resetPassword = async (email: string): Promise<AuthResult> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError.code)
    };
  }
};

export const resendVerificationEmail = async (): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return {
        success: false,
        error: 'No user is currently signed in'
      };
    }
    
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError.code)
    };
  }
};

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      // Update online status
      await updateUserOnlineStatus(firebaseUser.uid, true);
      
      // Get user data from Firestore
      const user = await getUser(firebaseUser.uid);
      callback(user);
    } else {
      callback(null);
    }
  });
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  return await getUser(firebaseUser.uid);
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

// Get current Firebase user
export const getCurrentFirebaseUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

// Helper function to convert Firebase auth error codes to user-friendly messages
const getAuthErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    'auth/operation-not-allowed': 'This sign-in method is not allowed.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email address but different sign-in credentials.',
    'auth/credential-already-in-use': 'This credential is already associated with a different user account.',
    'auth/timeout': 'The operation has timed out. Please try again.',
    'auth/missing-email': 'Please enter an email address.',
    'auth/missing-password': 'Please enter a password.',
    'auth/invalid-verification-code': 'Invalid verification code.',
    'auth/invalid-verification-id': 'Invalid verification ID.',
    'auth/code-expired': 'The verification code has expired.',
    'auth/session-cookie-expired': 'The session has expired. Please sign in again.',
    'auth/session-cookie-revoked': 'The session has been revoked. Please sign in again.',
    'auth/uid-already-exists': 'The provided user ID is already in use.',
    'auth/email-change-needs-verification': 'Please verify your new email address.',
    'auth/phone-number-already-exists': 'The provided phone number is already in use.',
    'auth/invalid-phone-number': 'Please enter a valid phone number.',
    'auth/missing-phone-number': 'Please enter a phone number.',
    'auth/quota-exceeded': 'Quota exceeded. Please try again later.',
    'auth/project-not-found': 'Project not found.',
    'auth/insufficient-permission': 'Insufficient permissions.',
    'auth/internal-error': 'An internal error occurred. Please try again.',
    'auth/tenant-id-mismatch': 'The tenant ID does not match.',
    'auth/unsupported-tenant-operation': 'This operation is not supported for multi-tenant use.',
    'auth/admin-restricted-operation': 'This operation is restricted to administrators only.',
    'auth/argument-error': 'Invalid arguments provided.',
    'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication.',
    'auth/app-not-installed': 'The app is not installed on this device.',
    'auth/captcha-check-failed': 'The captcha verification failed.',
    'auth/custom-token-mismatch': 'The custom token corresponds to a different audience.',
    'auth/dependent-sdk-initialized-before-auth': 'Another Firebase SDK was initialized before Auth.',
    'auth/dynamic-link-not-activated': 'Please activate Dynamic Links in the Firebase Console.',
    'auth/email-already-exists': 'The provided email is already in use by an existing user.',
    'auth/firebase-rules': 'Firebase Rules error.',
    'auth/invalid-api-key': 'Your API key is invalid.',
    'auth/invalid-cert-hash': 'The SHA-1 certificate hash provided is invalid.',
    'auth/invalid-continue-uri': 'The continue URL provided is invalid.',
    'auth/invalid-creation-time': 'The creation time must be a valid UTC date string.',
    'auth/invalid-disabled-field': 'The provided value for the disabled user property is invalid.',
    'auth/invalid-display-name': 'The provided value for the displayName user property is invalid.',
    'auth/invalid-email-verified': 'The provided value for the emailVerified user property is invalid.',
    'auth/invalid-hash-algorithm': 'The hash algorithm must match one of the strings in the list.',
    'auth/invalid-hash-block-size': 'The hash block size must be a valid number.',
    'auth/invalid-hash-derived-key-length': 'The hash derived key length must be a valid number.',
    'auth/invalid-hash-key': 'The hash key must be a valid byte buffer.',
    'auth/invalid-hash-memory-cost': 'The hash memory cost must be a valid number.',
    'auth/invalid-hash-parallelization': 'The hash parallelization must be a valid number.',
    'auth/invalid-hash-rounds': 'The hash rounds must be a valid number.',
    'auth/invalid-hash-salt-separator': 'The hashing algorithm salt separator field must be a valid byte buffer.',
    'auth/invalid-id-token': 'The provided ID token is not a valid Firebase ID token.',
    'auth/invalid-last-sign-in-time': 'The last sign-in time must be a valid UTC date string.',
    'auth/invalid-page-token': 'The provided next page token is invalid.',
    'auth/invalid-password': 'The provided value for the password user property is invalid.',
    'auth/invalid-password-hash': 'The password hash must be a valid byte buffer.',
    'auth/invalid-password-salt': 'The password salt must be a valid byte buffer.',
    'auth/invalid-photo-url': 'The provided value for the photoURL user property is invalid.',
    'auth/invalid-provider-data': 'The provided value for the providerData user property is invalid.',
    'auth/invalid-provider-id': 'The provided value for the providerId is invalid.',
    'auth/invalid-oauth-responsetype': 'Only exactly one OAuth responseType should be set to true.',
    'auth/invalid-session-cookie-duration': 'The session cookie duration must be a valid number in milliseconds.',
    'auth/invalid-uid': 'The provided value for the uid user property is invalid.',
    'auth/invalid-user-import': 'The user record to import is invalid.',
    'auth/invalid-provider-uid': 'The provided provider user identifier is invalid.',
    'auth/invalid-oauth-client-id': 'The provided OAuth client ID is invalid.',
    'auth/maximum-user-count-exceeded': 'The maximum allowed number of users to import has been exceeded.',
    'auth/missing-android-pkg-name': 'An Android Package Name is required when the Android App is required to be installed.',
    'auth/missing-continue-uri': 'A valid continue URL must be provided.',
    'auth/missing-hash-algorithm': 'Importing users with password hashes requires that the hash algorithm and its parameters be provided.',
    'auth/missing-ios-bundle-id': 'An iOS Bundle ID is required when the iOS App is required to be installed.',
    'auth/missing-uid': 'A uid identifier is required for the current operation.',
    'auth/missing-oauth-client-secret': 'The OAuth configuration client secret is required.',
    'auth/operation-not-supported-in-this-environment': 'This operation is not supported in the environment this application is running on.',
    'auth/popup-blocked': 'Unable to establish a connection with the popup.',
    'auth/popup-closed-by-user': 'The popup has been closed by the user before finalizing the operation.',
    'auth/provider-already-linked': 'User has already been linked to the given provider.',
    'auth/redirect-cancelled-by-user': 'The redirect operation has been cancelled by the user.',
    'auth/redirect-operation-pending': 'A redirect sign-in operation is already pending.',
    'auth/rejected-credential': 'The request contains malformed or mismatching credentials.',
    'auth/second-factor-already-in-use': 'The second factor is already enrolled on this account.',
    'auth/maximum-second-factor-count-exceeded': 'The maximum allowed number of second factors on a user has been exceeded.',
    'auth/tenant-not-found': 'There is no tenant corresponding to the provided identifier.',
    'auth/unhandled-error': 'An unhandled error occurred.',
    'auth/unauthorized-continue-uri': 'The domain of the continue URL is not whitelisted.',
    'auth/unsupported-first-factor': 'Enrolling a second factor or signing in with a multi-factor account requires sign-in with a supported first factor.',
    'auth/unsupported-persistence-type': 'The current environment does not support the specified persistence type.',
    'auth/user-token-expired': 'The user\'s credential is no longer valid.',
    'auth/web-storage-unsupported': 'This browser is not supported or 3rd party cookies and data may be disabled.',
    'auth/already-initialized': 'Firebase has already been initialized.',
  };

  return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
};