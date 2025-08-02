import React from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface UserSettingsItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  value?: string;
}

const UserSettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const userSettings: UserSettingsItem[] = [
    {
      id: 'user-profile',
      title: 'User Profile',
      description: 'Personal information and PIN settings',
      icon: 'account-circle',
      route: 'UserProfile',
      value: 'John Doe',
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      description: 'Sound alerts and popup preferences',
      icon: 'notifications',
      route: 'NotificationSettings',
      value: 'Enabled',
    },
    {
      id: 'theme-options',
      title: 'Theme & Display',
      description: 'Dark mode, colors, and visual preferences',
      icon: 'palette',
      route: 'ThemeOptions',
      value: 'Light Mode',
    },
  ];

  const handleSettingPress = (item: UserSettingsItem) => {
    navigation.navigate(item.route as never);
  };

  const renderSettingItem = ({ item }: { item: UserSettingsItem }) => (
    <TouchableOpacity
      style={styles.settingCard}
      onPress={() => handleSettingPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${Colors.warning}15` }]}>
        <Icon name={item.icon} size={24} color={Colors.warning} />
      </View>

      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        <Text style={styles.settingDescription}>{item.description}</Text>
        {item.value && <Text style={styles.settingValue}>{item.value}</Text>}
      </View>

      <Icon name="chevron-right" size={24} color={Colors.lightGray} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.warning} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>User Preferences</Text>
          <Text style={styles.headerSubtitle}>Personalize your experience</Text>
        </View>

        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* User Profile Summary */}
      <View style={styles.profileSummary}>
        <View style={styles.profileAvatar}>
          <Icon name="person" size={32} color={Colors.white} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>John Doe</Text>
          <Text style={styles.profileRole}>Store Manager</Text>
          <Text style={styles.profileLastLogin}>Last login: Today at 9:15 AM</Text>
        </View>
        <TouchableOpacity style={styles.profileEditButton}>
          <Icon name="edit" size={20} color={Colors.warning} />
        </TouchableOpacity>
      </View>

      {/* User Settings List */}
      <FlatList
        data={userSettings}
        renderItem={renderSettingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.settingsList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="logout" size={20} color={Colors.danger} />
          <Text style={[styles.footerButtonText, { color: Colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton}>
          <Icon name="lock-reset" size={20} color={Colors.secondary} />
          <Text style={styles.footerButtonText}>Change PIN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.warning,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  helpButton: {
    padding: 8,
  },
  profileSummary: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
    marginBottom: 2,
  },
  profileLastLogin: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  profileEditButton: {
    padding: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  settingsList: {
    padding: 16,
  },
  settingCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: '500',
  },
  separator: {
    height: 12,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    gap: 8,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondary,
  },
});

export default UserSettingsScreen;
