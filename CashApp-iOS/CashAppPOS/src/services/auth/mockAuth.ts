/**
 * Mock Authentication Service
 * Temporary solution for development while backend auth is being fixed
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface MockUser {
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
}

class MockAuthService {
  private mockUsers = [
    // Mock users removed - app should use real authentication
    // Users should sign in with their actual Supabase credentials
  ];

  async signIn({ email, password }: { email: string; password: string }) {
    logger.info('🔐 Mock sign in for:', email);

    const mockUser = this.mockUsers.find((u) => u.email === email && u.password === password);

    if (!mockUser) {
      throw new Error('Invalid credentials');
    }

    // Generate mock session
    const mockSession = {
      access_token: `mock-jwt-${mockUser.user.id}-${Date.now()}`,
      refresh_token: `mock-refresh-${mockUser.user.id}`,
      expires_in: 3600,
      user: mockUser.user,
    };

    // Store user info and session
    await AsyncStorage.setItem('userInfo', JSON.stringify(mockUser.user));
    await AsyncStorage.setItem('mock_session', JSON.stringify(mockSession));
    await AsyncStorage.setItem('auth_token', mockSession.access_token);

    logger.info('✅ Mock sign in successful');

    return {
      user: mockUser.user,
      session: mockSession,
    };
  }

  async signOut() {
    logger.info('👋 Mock sign out');
    await AsyncStorage.multiRemove([
      'userInfo',
      'mock_session',
      'auth_token',
      '@auth_user',
      '@auth_business',
    ]);
  }

  async getSession() {
    const sessionStr = await AsyncStorage.getItem('mock_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      // Check if expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return null;
      }
      return session;
    }
    return null;
  }

  async getStoredUser() {
    const userInfo = await AsyncStorage.getItem('userInfo');
    if (userInfo) {
      return JSON.parse(userInfo);
    }
    return null;
  }

  async refreshSession() {
    const session = await this.getSession();
    if (!session) {
      throw new Error('No session to refresh');
    }

    // Extend expiration
    session.expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
    await AsyncStorage.setItem('mock_session', JSON.stringify(session));

    return session;
  }

  onAuthStateChange(_callback: (event: string, session: unknown) => void) {
    // Mock implementation - just return unsubscribe function
    return {
      data: { subscription: null },
      error: null,
    };
  }
}

export const mockAuthService = new MockAuthService();
