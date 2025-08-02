import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import RestaurantDataService from '../services/RestaurantDataService';
// TODO: Unused import - import API_CONFIG from '../config/api';
import { useAuthStore } from '../store/useAuthStore';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'platform_owner' | 'restaurant_owner' | 'manager' | 'employee';
  photo?: string;
  pin: string;
  employeeId: string;
  businessId: string;
  startDate: Date;
  lastLogin: Date;
  permissions: string[];
  isActive: boolean;
  platformId?: string; // For platform owners
  managedRestaurants?: string[]; // Array of restaurant IDs for platform owners
}

export interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  vatNumber: string;
  registrationNumber: string;
  type: 'restaurant' | 'retail' | 'service' | 'other';
  currency: string;
  timezone: string;
  ownerId: string;
  platformOwnerId?: string; // For multi-tenant support
  subscriptionTier?: 'basic' | 'premium' | 'enterprise';
  isActive?: boolean;
  joinedDate?: Date;
  lastActivity?: Date;
  monthlyRevenue?: number;
  commissionRate?: number;
}

export interface Platform {
  id: string;
  name: string;
  ownerId: string;
  createdDate: Date;
  totalRestaurants: number;
  totalRevenue: number;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  platform: Platform | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformOwner: boolean;
  managedRestaurants: Business[];
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  signUp: (
    userData: Partial<User>,
    businessData: Partial<Business>,
    password: string
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updateBusiness: (businessData: Partial<Business>) => Promise<void>;
  validatePin: (pin: string) => boolean;
  checkBiometric: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  loadPlatformData: () => Promise<void>;
  switchRestaurant: (restaurantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@auth_user',
  BUSINESS: '@auth_business',
  REMEMBER_ME: '@auth_remember_me',
  BIOMETRIC_ENABLED: '@auth_biometric',
};

// Removed all mock data - now using Supabase authentication

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get auth state from Zustand store
  const authStoreUser = useAuthStore((state) => state.user);
  const _isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const _authLoading = useAuthStore((state) => state.isLoading);
  const signInStore = useAuthStore((state) => state.signIn);
  const _signOutStore = useAuthStore((state) => state.signOut);
  const checkAuthStore = useAuthStore((state) => state.checkAuth);

  // Legacy state for compatibility
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [managedRestaurants, setManagedRestaurants] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync auth store user with legacy user format
  useEffect(() => {
    if (authStoreUser) {
      const legacyUser: User = {
        id: authStoreUser.id,
        firstName: authStoreUser.name.split(' ')[0] || 'User',
        lastName: authStoreUser.name.split(' ')[1] || '',
        email: authStoreUser.email,
        phone: '',
        role: authStoreUser.role as unknown,
        pin: '0000',
        employeeId: `EMP${authStoreUser.id}`,
        businessId: authStoreUser.restaurant_id || '',
        startDate: new Date(),
        lastLogin: new Date(),
        permissions: ['*'],
        isActive: true,
        platformId: authStoreUser.is_platform_owner ? authStoreUser.id : undefined,
        managedRestaurants: [],
      };
      setUser(legacyUser);

      // Set business if available
      if (authStoreUser.restaurant_id && authStoreUser.restaurant_name) {
        setBusiness({
          id: authStoreUser.restaurant_id,
          name: authStoreUser.restaurant_name,
          address: '',
          phone: '',
          email: '',
          vatNumber: '',
          registrationNumber: '',
          type: 'restaurant',
          currency: 'GBP',
          timezone: 'Europe/London',
          ownerId: authStoreUser.id,
          subscriptionTier: 'premium',
          isActive: true,
        });
      }
    } else {
      setUser(null);
      setBusiness(null);
    }
  }, [authStoreUser]);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      setIsLoading(true);

      // Check auth state from Supabase
      logger.info('🔐 Checking Supabase authentication state...');
      await checkAuthStore();
    } catch (error) {
      logger.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      // Use Supabase auth store
      await signInStore(email, password);

      if (rememberMe) {
        await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      }

      return true;
    } catch (error) {
      logger.error('Sign in error:', error);
      return false;
    }
  };

  const signUp = async (
    userData: Partial<User>,
    businessData: Partial<Business>,
    _password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check if email already exists
      const existingUser = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === userData.email?.toLowerCase()
      );
      if (existingUser) {
        return false;
      }

      // Create new user
      const newUser: User = {
        id: Date.now().toString(),
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: 'owner', // First user is always owner
        pin: userData.pin || '1234',
        employeeId: `EMP${Date.now()}`,
        businessId: Date.now().toString(),
        startDate: new Date(),
        lastLogin: new Date(),
        permissions: ['*'],
        isActive: true,
      };

      // Create new business
      const newBusiness: Business = {
        id: Date.now().toString(),
        name: businessData.name || '',
        address: businessData.address || '',
        phone: businessData.phone || '',
        email: businessData.email || newUser.email,
        vatNumber: businessData.vatNumber || '',
        registrationNumber: businessData.registrationNumber || '',
        type: businessData.type || 'retail',
        currency: 'GBP',
        timezone: 'Europe/London',
        ownerId: newUser.id,
      };

      newUser.businessId = newBusiness.id;

      setUser(newUser);
      setBusiness(newBusiness);

      // Store authentication data
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(newBusiness));
      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');

      return true;
    } catch (error) {
      logger.error('Error signing up:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Clear stored data including JWT token
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.BUSINESS),
        AsyncStorage.removeItem(STORAGE_KEYS.REMEMBER_ME),
        AsyncStorage.removeItem('auth_token'), // Clear JWT token for API calls
      ]);

      setUser(null);
      setBusiness(null);
    } catch (error) {
      logger.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    } catch (error) {
      logger.error('Error updating user:', error);
    }
  };

  const updateBusiness = async (businessData: Partial<Business>): Promise<void> => {
    if (!business) return;

    try {
      const updatedBusiness = { ...business, ...businessData };
      setBusiness(updatedBusiness);
      await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(updatedBusiness));
    } catch (error) {
      logger.error('Error updating business:', error);
    }
  };

  const validatePin = (pin: string): boolean => {
    return user?.pin === pin;
  };

  const checkBiometric = async (): Promise<boolean> => {
    try {
      // In a real app, this would use biometric authentication
      // For now, we'll simulate a successful biometric check
      const biometricEnabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return biometricEnabled === 'true';
    } catch (error) {
      logger.error('Error checking biometric:', error);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if email exists
      const userExists = MOCK_CREDENTIALS.find(
        (cred) => cred.email.toLowerCase() === email.toLowerCase()
      );

      return !!userExists;
    } catch (error) {
      logger.error('Error resetting password:', error);
      return false;
    }
  };

  const loadPlatformData = async (): Promise<void> => {
    try {
      if (user?.role === 'platform_owner') {
        logger.info('🏢 Loading REAL platform data for platform owner');

        // Load REAL restaurant data first
        const restaurantDataService = RestaurantDataService.getInstance();
        const realRestaurants = await restaurantDataService.getPlatformRestaurants(
          'platform_owner_1'
        );
        const businesses = realRestaurants.map((r) => restaurantDataService.toBusinessType(r));
        setManagedRestaurants(businesses);

        // Generate REAL platform data based on actual restaurants
        const totalRevenue = realRestaurants.reduce((sum, r) => sum + (r.monthlyRevenue || 0), 0);
        const realPlatformData: Platform = {
          id: 'platform1',
          name: 'Fynlo POS Platform',
          ownerId: 'platform_owner_1',
          createdDate: new Date(2024, 0, 1),
          totalRestaurants: realRestaurants.length, // REAL count from backend
          totalRevenue, // REAL revenue from backend
          isActive: true,
        };

        setPlatform(realPlatformData);
        logger.info(
          `✅ Platform data loaded: ${realRestaurants.length} restaurants, £${totalRevenue} total revenue`
        );
      }
    } catch (error) {
      logger.error('Error loading platform data:', error);
    }
  };

  const switchRestaurant = async (restaurantId: string): Promise<void> => {
    try {
      if (user?.role === 'platform_owner') {
        logger.info(`🔄 Switching to restaurant: ${restaurantId}`);

        // Find restaurant in the REAL managed restaurants data
        const restaurant = managedRestaurants.find((r) => r.id === restaurantId);
        if (restaurant) {
          setBusiness(restaurant);
          await AsyncStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(restaurant));
          logger.info(`✅ Switched to restaurant: ${restaurant.name}`);
        } else {
          logger.error(`❌ Restaurant ${restaurantId} not found in managed restaurants`);
        }
      }
    } catch (error) {
      logger.error('Error switching restaurant:', error);
    }
  };

  // Subscribe to real-time restaurant updates for platform owners
  useEffect(() => {
    if (user?.role === 'platform_owner') {
      const restaurantDataService = RestaurantDataService.getInstance();

      // Subscribe to platform restaurants changes
      const unsubscribe = restaurantDataService.subscribeToPlatformRestaurants(
        'platform_owner_1',
        (updatedRestaurants) => {
          logger.info('🔄 Platform restaurants updated in real-time:', updatedRestaurants.length);
          const businesses = updatedRestaurants.map((r) => restaurantDataService.toBusinessType(r));
          setManagedRestaurants(businesses);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [user?.role]);

  const value: AuthContextType = {
    user,
    business,
    platform,
    isLoading,
    isAuthenticated: !!user,
    isPlatformOwner: user?.role === 'platform_owner',
    managedRestaurants,
    signIn,
    signUp,
    signOut,
    updateUser,
    updateBusiness,
    validatePin,
    checkBiometric,
    resetPassword,
    loadPlatformData,
    switchRestaurant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
