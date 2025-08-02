/**
 * Component Registry - Prevents tree-shaking of essential React Native components
 *
 * This file ensures that critical React Native components are not removed
 * by the Metro bundler's tree-shaking optimization, which can cause
 * ReferenceError issues in production iOS builds.
 */

import { TextInput, ScrollView, KeyboardAvoidingView, FlatList } from 'react-native';

import { logger } from '../utils/logger';

// Global registry to prevent tree-shaking
const ComponentRegistry = {
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  FlatList,
};

// Force references to prevent removal during optimization
export const ensureComponentsLoaded = () => {
  const components = ['TextInput', 'ScrollView', 'KeyboardAvoidingView', 'FlatList'];

  components.forEach((name) => {
    if (ComponentRegistry[name as keyof typeof ComponentRegistry]) {
      logger.info(`✅ ${name} component registered`);
    } else {
      console.error(`❌ ${name} component not found!`);
    }
  });
};

// Export registry for potential future use
export default ComponentRegistry;
