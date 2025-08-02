import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../utils/logger';

/**
 * Clear all authentication-related storage
 * Use this to fix corrupted auth state
 */
export async function clearAuthStorage() {
  try {
    logger.info('🧹 Clearing auth storage...');

    // Clear auth-related keys
    await AsyncStorage.removeItem('auth-storage');
    await AsyncStorage.removeItem('userInfo');
    await AsyncStorage.removeItem('supabase_session');
    await AsyncStorage.removeItem('supabase.auth.token');

    // Clear any other auth-related keys
    const allKeys = await AsyncStorage.getAllKeys();
    const authKeys = allKeys.filter(
      (key) =>
        key.includes('auth') ||
        key.includes('user') ||
        key.includes('session') ||
        key.includes('supabase')
    );

    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys);
    }

    logger.info('✅ Auth storage cleared successfully');
  } catch (error) {
    logger.error('❌ Error clearing auth storage:', error);
  }
}
