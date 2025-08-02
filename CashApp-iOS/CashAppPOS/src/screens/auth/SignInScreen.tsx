import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
  _Image,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { SimpleTextInput } from '../../components/inputs';
import Logo from '../../components/Logo';
import { isFeatureEnabled } from '../../config/featureFlags';
import { useAuth } from '../../contexts/AuthContext';

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

interface SignInScreenProps {
  onSwitchToSignUp: () => void;
}

const SignInScreen: React.FC<SignInScreenProps> = ({ onSwitchToSignUp }) => {
  const { signIn, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [_showPassword, _setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const success = await signIn(email.trim(), password, rememberMe);

      if (!success) {
        Alert.alert(
          'Sign In Failed',
          'Invalid email or password. Please check your credentials and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (_error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address first, then tap "Forgot Password".',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      const success = await resetPassword(email.trim());

      if (success) {
        Alert.alert(
          'Password Reset',
          'Password reset instructions have been sent to your email address.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Email Not Found', 'No account found with this email address.', [
          { text: 'OK' },
        ]);
      }
    } catch (_error) {
      Alert.alert('Error', 'Unable to send password reset email. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const showDemoCredentials = () => {
    Alert.alert(
      'Quick Sign In',
      'Select an account to sign in:\n\n' +
        '🏢 Platform Owner (Full Control):\n' +
        'See all restaurants, platform analytics, and settings\n\n' +
        '🍴 Restaurant Owner:\n' +
        'Manage your restaurant\n' +
        'Full restaurant control and analytics\n\n' +
        '👩‍💼 Restaurant Manager (Sarah):\n' +
        'Day-to-day operations and staff management\n\n' +
        '🎯 Demo Account:\n' +
        'General manager access for testing',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Platform Owner',
          onPress: () => {
            setEmail('owner@fynlopos.com');
            setPassword('platformowner123');
          },
        },
        {
          text: 'Restaurant Owner',
          onPress: () => {
            setEmail('carlos@casaestrella.co.uk');
            setPassword('password123');
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Logo size="large" showText={false} />
          <Text style={styles.subtitle}>Professional Point of Sale System</Text>
        </View>

        {/* Sign In Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Sign in to your account</Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <SimpleTextInput
              label="Email Address"
              value={email}
              onValueChange={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <SimpleTextInput
              label="Password"
              value={password}
              onValueChange={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Enter your password"
              secureTextEntry={true} // Fixed prop name
              autoComplete="password"
            />
            {/* Note: Password visibility toggle icon is removed */}
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
                style={styles.switch}
              />
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Icon name="login" size={20} color={Colors.white} />
                <Text style={styles.signInButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Quick Sign In Button */}
          {isFeatureEnabled('QUICK_SIGNIN_ENABLED') && (
            <TouchableOpacity
              style={styles.demoButton}
              onPress={showDemoCredentials}
              disabled={isLoading}
            >
              <Icon name="flash-on" size={20} color={Colors.secondary} />
              <Text style={styles.demoButtonText}>Quick Sign In</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onSwitchToSignUp} disabled={isLoading}>
              <Text style={styles.signUpLinkText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Why Choose Fynlo POS?</Text>

          <View style={styles.featureRow}>
            <Icon name="speed" size={24} color={Colors.primary} />
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Lightning Fast</Text>
              <Text style={styles.featureDescription}>Process transactions in seconds</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Icon name="analytics" size={24} color={Colors.secondary} />
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Real-time Analytics</Text>
              <Text style={styles.featureDescription}>Track sales and performance instantly</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <Icon name="security" size={24} color={Colors.success} />
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Bank-level Security</Text>
              <Text style={styles.featureDescription}>Your data is always protected</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 16,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  rememberMeText: {
    fontSize: 14,
    color: Colors.text,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  demoButton: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
    marginBottom: 24,
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 14,
    color: Colors.mediumGray,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    color: Colors.lightText,
  },
  signUpLinkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  featuresContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  featureText: {
    flex: 1,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
});

export default SignInScreen;
