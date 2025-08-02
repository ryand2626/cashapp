/**
 * Subscription Status Badge Component
 * Displays the current subscription plan and status
 */

import React from 'react';

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../../design-system/ThemeProvider';
import { useAuthStore } from '../../store/useAuthStore';

interface SubscriptionPlan {
  name: string;
  displayName: string;
  color: string;
  icon: string;
  features: string[];
}

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  alpha: {
    name: 'alpha',
    displayName: 'Alpha',
    color: '#95a5a6',
    icon: 'flash-outline',
    features: ['Basic POS', 'Orders', 'Payments', 'Daily Reports'],
  },
  beta: {
    name: 'beta',
    displayName: 'Beta',
    color: '#3498db',
    icon: 'flash',
    features: [
      'Everything in Alpha',
      'Inventory',
      'Staff Management',
      'Advanced Reports',
      'Tables',
      'Customers',
    ],
  },
  omega: {
    name: 'omega',
    displayName: 'Omega',
    color: '#9b59b6',
    icon: 'flash-sharp',
    features: [
      'Everything in Beta',
      'Multi-location',
      'API Access',
      'Custom Branding',
      'Analytics',
      'Unlimited Features',
    ],
  },
};

export const SubscriptionStatusBadge: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const subscriptionPlan = user?.subscription_plan || 'alpha';
  const subscriptionStatus = user?.subscription_status || 'trial';
  const plan = SUBSCRIPTION_PLANS[subscriptionPlan] || SUBSCRIPTION_PLANS.alpha;

  const handlePress = () => {
    Alert.alert(
      `${plan.displayName} Plan`,
      `Status: ${
        subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)
      }\n\nFeatures:\n${plan.features.join('\n')}`,
      [
        {
          text: 'Upgrade Plan',
          onPress: () => {
            Alert.alert(
              'Upgrade Subscription',
              'To upgrade your subscription plan, please visit the Fynlo web portal at portal.fynlo.com',
              [{ text: 'OK' }]
            );
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: plan.color }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Icon name={plan.icon} size={16} color="#fff" />
      <Text style={styles.planText}>{plan.displayName}</Text>
      {subscriptionStatus === 'trial' && <Text style={styles.trialText}>TRIAL</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  planText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  trialText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.8,
    marginLeft: 4,
  },
});

// Larger variant for settings screens
export const SubscriptionStatusCard: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuthStore();

  const subscriptionPlan = user?.subscription_plan || 'alpha';
  const subscriptionStatus = user?.subscription_status || 'trial';
  const plan = SUBSCRIPTION_PLANS[subscriptionPlan] || SUBSCRIPTION_PLANS.alpha;

  return (
    <View style={[cardStyles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={[cardStyles.planHeader, { backgroundColor: plan.color }]}>
        <Icon name={plan.icon} size={24} color="#fff" />
        <Text style={cardStyles.planTitle}>{plan.displayName} Plan</Text>
        {subscriptionStatus === 'trial' && (
          <View style={cardStyles.trialBadge}>
            <Text style={cardStyles.trialBadgeText}>TRIAL</Text>
          </View>
        )}
      </View>

      <View style={cardStyles.cardContent}>
        <Text style={[cardStyles.statusLabel, { color: theme.colors.text }]}>
          Status:{' '}
          <Text style={cardStyles.statusValue}>
            {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
          </Text>
        </Text>

        <View style={cardStyles.featuresSection}>
          <Text style={[cardStyles.featuresTitle, { color: theme.colors.text }]}>
            Included Features:
          </Text>
          {plan.features.map((feature, index) => (
            <View key={index} style={cardStyles.featureRow}>
              <Icon name="checkmark-circle" size={16} color={plan.color} />
              <Text style={[cardStyles.featureText, { color: theme.colors.textSecondary }]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[cardStyles.upgradeButton, { borderColor: plan.color }]}
          onPress={() => {
            Alert.alert(
              'Manage Subscription',
              'To manage or upgrade your subscription, please visit the Fynlo web portal at portal.fynlo.com',
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={[cardStyles.upgradeButtonText, { color: plan.color }]}>
            Manage Subscription
          </Text>
          <Icon name="open-outline" size={16} color={plan.color} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  planTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  trialBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trialBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 16,
  },
  statusLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  statusValue: {
    fontWeight: '600',
  },
  featuresSection: {
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 13,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
