/**
 * Subscription Context for managing subscription state and feature access
 *
 * This context provides subscription information, feature gating, and usage
 * tracking throughout the application.
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { DataService } from '../services/DataService';

// Types
export interface SubscriptionPlan {
  id: number;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_orders_per_month: number | null;
  max_staff_accounts: number | null;
  max_menu_items: number | null;
  features: Record<string, any>;
  yearly_savings?: number;
  yearly_discount_percentage?: number;
}

export interface RestaurantSubscription {
  id: number;
  restaurant_id: number;
  plan_id: number;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  trial_end_date: string | null;
  current_period_start: string;
  current_period_end: string;
  plan: SubscriptionPlan;
  is_active: boolean;
  is_trial: boolean;
  is_expired: boolean;
  days_until_renewal: number;
}

export interface SubscriptionUsage {
  id: number;
  restaurant_id: number;
  month_year: string;
  orders_count: number;
  staff_count: number;
  menu_items_count: number;
  limits: {
    orders: number | null;
    staff: number | null;
    menu_items: number | null;
  };
  orders_percentage: number;
  staff_percentage: number;
  menu_items_percentage: number;
}

export interface FeatureGateResult {
  hasAccess: boolean;
  reason?: string;
  currentPlan?: string;
  requiredPlans?: string[];
  upgradeRequired?: boolean;
}

export interface UsageLimitResult {
  atLimit: boolean;
  overLimit: boolean;
  currentUsage: number;
  limit: number | null;
  percentageUsed: number;
  remaining: number | null;
}

interface SubscriptionContextType {
  // State
  subscription: RestaurantSubscription | null;
  usage: SubscriptionUsage | null;
  availablePlans: SubscriptionPlan[];
  loading: boolean;
  error: string | null;

  // Feature gating
  hasFeature: (featureName: string) => Promise<FeatureGateResult>;
  checkUsageLimit: (limitType: string, increment?: number) => Promise<UsageLimitResult>;

  // Subscription management
  loadSubscription: (restaurantId: number) => Promise<void>;
  subscribeToPlan: (planId: number, startTrial?: boolean) => Promise<boolean>;
  changePlan: (newPlanId: number, immediate?: boolean) => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;

  // Usage tracking
  incrementUsage: (usageType: string, amount?: number) => Promise<boolean>;
  refreshUsage: () => Promise<void>;

  // Utility
  formatPrice: (price: number) => string;
  getPlanByName: (planName: string) => SubscriptionPlan | null;
  isUnlimited: (limitType: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
  restaurantId?: number;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({
  children,
  restaurantId,
}) => {
  const [subscription, setSubscription] = useState<RestaurantSubscription | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load subscription data when restaurant ID changes
  useEffect(() => {
    if (restaurantId) {
      loadSubscription(restaurantId);
      loadAvailablePlans();
    }
  }, [restaurantId]);

  const loadSubscription = async (id: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await DataService.getInstance().getCurrentSubscription(id);
      if (response.success) {
        setSubscription(response.data.subscription);
        setUsage(response.data.usage);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to load subscription information');
      console.error('Subscription load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const response = await DataService.getInstance().getSubscriptionPlans();
      if (response.success) {
        setAvailablePlans(response.data);
      }
    } catch (err) {
      console.error('Failed to load subscription plans:', err);
    }
  };

  const hasFeature = async (featureName: string): Promise<FeatureGateResult> => {
    if (!subscription || !subscription.is_active) {
      return {
        hasAccess: false,
        reason: 'No active subscription',
        upgradeRequired: true,
        requiredPlans: ['basic', 'professional', 'enterprise'],
      };
    }

    const hasAccess = subscription.plan.features[featureName] === true;

    if (hasAccess) {
      return { hasAccess: true };
    }

    // Determine which plans include this feature
    const plansWithFeature = availablePlans
      .filter((plan) => plan.features[featureName] === true)
      .map((plan) => plan.name);

    return {
      hasAccess: false,
      reason: `Feature '${featureName}' not available in ${subscription.plan.display_name}`,
      currentPlan: subscription.plan.name,
      requiredPlans: plansWithFeature,
      upgradeRequired: true,
    };
  };

  const checkUsageLimit = async (limitType: string, increment = 0): Promise<UsageLimitResult> => {
    if (!subscription || !usage) {
      return {
        atLimit: true,
        overLimit: true,
        currentUsage: 0,
        limit: 0,
        percentageUsed: 100,
        remaining: 0,
      };
    }

    const limitMap = {
      orders: subscription.plan.max_orders_per_month,
      staff: subscription.plan.max_staff_accounts,
      menu_items: subscription.plan.max_menu_items,
    };

    const usageMap = {
      orders: usage.orders_count,
      staff: usage.staff_count,
      menu_items: usage.menu_items_count,
    };

    const limit = limitMap[limitType as keyof typeof limitMap];
    const currentUsage = usageMap[limitType as keyof typeof usageMap] || 0;

    // Unlimited plan
    if (limit === null) {
      return {
        atLimit: false,
        overLimit: false,
        currentUsage,
        limit: null,
        percentageUsed: 0,
        remaining: null,
      };
    }

    const futureUsage = currentUsage + increment;
    const percentageUsed = limit > 0 ? (currentUsage / limit) * 100 : 0;
    const remaining = Math.max(0, limit - currentUsage);

    return {
      atLimit: currentUsage >= limit,
      overLimit: futureUsage > limit,
      currentUsage,
      limit,
      percentageUsed: Math.min(100, percentageUsed),
      remaining,
    };
  };

  const subscribeToPlan = async (planId: number, startTrial = true): Promise<boolean> => {
    if (!restaurantId) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await DataService.getInstance().createSubscription({
        restaurant_id: restaurantId,
        plan_id: planId,
        start_trial: startTrial,
      });

      if (response.success) {
        await loadSubscription(restaurantId);
        return true;
      } else {
        setError(response.message);
        return false;
      }
    } catch (err) {
      setError('Failed to create subscription');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const changePlan = async (newPlanId: number, immediate = true): Promise<boolean> => {
    if (!restaurantId) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await DataService.getInstance().changeSubscriptionPlan({
        restaurant_id: restaurantId,
        new_plan_id: newPlanId,
        immediate,
      });

      if (response.success) {
        await loadSubscription(restaurantId);
        return true;
      } else {
        setError(response.message);
        return false;
      }
    } catch (err) {
      setError('Failed to change subscription plan');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async (): Promise<boolean> => {
    if (!restaurantId) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await DataService.getInstance().cancelSubscription(restaurantId);

      if (response.success) {
        await loadSubscription(restaurantId);
        return true;
      } else {
        setError(response.message);
        return false;
      }
    } catch (err) {
      setError('Failed to cancel subscription');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const incrementUsage = async (usageType: string, amount = 1): Promise<boolean> => {
    if (!restaurantId) return false;

    try {
      const response = await DataService.getInstance().incrementUsage(
        restaurantId,
        usageType,
        amount
      );

      if (response.success) {
        // Update local usage state
        setUsage((prevUsage) => {
          if (!prevUsage) return null;

          const updatedUsage = { ...prevUsage };
          switch (usageType) {
            case 'orders':
              updatedUsage.orders_count += amount;
              break;
            case 'staff':
              updatedUsage.staff_count += amount;
              break;
            case 'menu_items':
              updatedUsage.menu_items_count += amount;
              break;
          }
          return updatedUsage;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to increment usage:', err);
      return false;
    }
  };

  const refreshUsage = async () => {
    if (restaurantId) {
      await loadSubscription(restaurantId);
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(price);
  };

  const getPlanByName = (planName: string): SubscriptionPlan | null => {
    return availablePlans.find((plan) => plan.name === planName) || null;
  };

  const isUnlimited = (limitType: string): boolean => {
    if (!subscription) return false;

    const limitMap = {
      orders: subscription.plan.max_orders_per_month,
      staff: subscription.plan.max_staff_accounts,
      menu_items: subscription.plan.max_menu_items,
    };

    return limitMap[limitType as keyof typeof limitMap] === null;
  };

  const value: SubscriptionContextType = {
    // State
    subscription,
    usage,
    availablePlans,
    loading,
    error,

    // Feature gating
    hasFeature,
    checkUsageLimit,

    // Subscription management
    loadSubscription,
    subscribeToPlan,
    changePlan,
    cancelSubscription,

    // Usage tracking
    incrementUsage,
    refreshUsage,

    // Utility
    formatPrice,
    getPlanByName,
    isUnlimited,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
