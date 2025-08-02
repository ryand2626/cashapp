/**
 * Authentication Store using Zustand
 * Manages authentication state with Supabase integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { authService } from '../services/auth/unifiedAuthService';
import tokenManager from '../utils/tokenManager';

interface User {
  id: string;
  email: string;
  name: string;
  is_platform_owner: boolean;
  role: string;
  restaurant_id?: string;
  restaurant_name?: string;
  subscription_plan?: 'alpha' | 'beta' | 'omega';
  subscription_status?: string;
  enabled_features?: string[];
  needs_onboarding?: boolean;
  onboarding_progress?: {
    current_step: number;
    completed_steps: number[];
    total_steps: number;
    resume_at_step: number;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: unknown | null;
  error: string | null;
  tokenRefreshListenerSetup: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, restaurantName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  hasFeature: (feature: string) => boolean;
  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => boolean;
  setupTokenListeners: () => void;
  handleTokenRefresh: () => Promise<void>;
}

// Store handler functions at module level to maintain consistent references
let tokenRefreshedHandler: (() => Promise<void>) | null = null;
let tokenClearedHandler: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  session: null,
  error: null,
  tokenRefreshListenerSetup: false,

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      const { user, session } = await authService.signIn({ email, password });

      set({
        user,
        session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Ensure token listeners are set up after successful sign-in
      get().setupTokenListeners();
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: error.message || 'Failed to sign in',
        isAuthenticated: false,
        user: null,
        session: null,
      });
      throw error;
    }
  },

  signUp: async (email: string, password: string, restaurantName?: string) => {
    try {
      set({ isLoading: true, error: null });

      const result = await authService.signUp({
        email,
        password,
        restaurantName,
      });

      // After signup, sign them in if we have a session
      if (result.session) {
        await get().signIn(email, password);
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: error.message || 'Failed to sign up',
      });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });

      await authService.signOut();

      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      set({
        isLoading: false,
        error: error.message || 'Failed to sign out',
      });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      // TEMPORARY: Clear any stored mock authentication
      // This ensures users start at the login screen
      const hasMockAuth = await AsyncStorage.getItem('mock_session');
      if (hasMockAuth) {
        logger.info('Clearing stored mock authentication...');
        await AsyncStorage.multiRemove([
          'userInfo',
          'mock_session',
          'auth_token',
          '@auth_user',
          '@auth_business',
        ]);
      }

      const session = await authService.getSession();

      if (session) {
        // Try to get stored user info first
        const storedUser = await authService.getStoredUser();

        if (storedUser) {
          // Use stored user info if available
          set({
            user: storedUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        // If no stored user, session is invalid
        await authService.signOut();
        set({
          isAuthenticated: false,
          user: null,
          session: null,
          isLoading: false,
        });
      } else {
        set({
          isAuthenticated: false,
          user: null,
          session: null,
          isLoading: false,
        });
      }
    } catch (error: unknown) {
      // Don't log error for missing session - this is normal on first launch
      set({
        isAuthenticated: false,
        user: null,
        session: null,
        isLoading: false,
        error: error.message,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  hasFeature: (feature: string) => {
    const { user } = get();
    if (!user) return false;

    // Platform owners have all features
    if (user.is_platform_owner) return true;

    // Check if feature is in enabled features list
    return user.enabled_features?.includes(feature) || false;
  },

  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => {
    const { user } = get();
    if (!user) return false;

    // Platform owners have access to all plans
    if (user.is_platform_owner) return true;

    // Check plan hierarchy
    const planHierarchy = { alpha: 1, beta: 2, omega: 3 };
    const userPlanLevel = planHierarchy[user.subscription_plan || 'alpha'];
    const requiredLevel = planHierarchy[plan];

    return userPlanLevel >= requiredLevel;
  },

  setupTokenListeners: () => {
    logger.info('🎧 Setting up token event listeners...');

    // Remove any existing listeners first to prevent duplicates
    if (tokenRefreshedHandler) {
      tokenManager.off('token:refreshed', tokenRefreshedHandler);
      tokenRefreshedHandler = null;
    }
    if (tokenClearedHandler) {
      tokenManager.off('token:cleared', tokenClearedHandler);
      tokenClearedHandler = null;
    }

    // Create new handler functions with current store references
    tokenRefreshedHandler = async () => {
      logger.info('🔄 Token refreshed, updating auth state...');
      await get().handleTokenRefresh();
    };

    tokenClearedHandler = () => {
      logger.info('🔒 Tokens cleared, updating auth state...');
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        error: null,
      });
    };

    // Add fresh listeners
    tokenManager.on('token:refreshed', tokenRefreshedHandler);
    tokenManager.on('token:cleared', tokenClearedHandler);

    // Mark listeners as set up
    set({ tokenRefreshListenerSetup: true });
    logger.info('✅ Token listeners successfully set up');
  },

  handleTokenRefresh: async () => {
    try {
      // Get the current session after token refresh
      const session = await authService.getSession();

      if (session) {
        // Update session in store
        set({ session });
        logger.info('✅ Auth store session updated after token refresh');
      } else {
        // No valid session after refresh - user needs to log in again
        logger.info('⚠️ No valid session after token refresh');
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          error: 'Session expired - please log in again',
        });
      }
    } catch (error) {
      logger.error('❌ Error handling token refresh in auth store:', error);
    }
  },
}));
