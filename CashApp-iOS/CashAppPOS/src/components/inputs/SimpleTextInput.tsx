import React, { useState, useRef } from 'react';

import type { KeyboardTypeOptions } from 'react-native';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

interface SimpleTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  style?: any;
  disabled?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  maxLength?: number;
  numberOfLines?: number;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  clearButtonMode?: 'never' | 'while-editing' | 'unless-editing' | 'always';
}

const SimpleTextInput: React.FC<SimpleTextInputProps> = ({
  value,
  onValueChange,
  placeholder = '',
  label,
  style,
  disabled = false,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  secureTextEntry = false,
  maxLength,
  numberOfLines = 1,
  returnKeyType = 'done',
  onSubmitEditing,
  clearButtonMode = 'while-editing',
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleTextChange = (text: string) => {
    // FIXED: Update both internal state AND parent immediately
    setInternalValue(text);
    if (onValueChange) {
      onValueChange(text);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Set internal value to the current prop value when focusing
    setInternalValue(value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // No need to call onValueChange here since it's already called during typing
  };

  const handleClear = () => {
    setInternalValue('');
    if (onValueChange) {
      onValueChange('');
    }
    inputRef.current?.focus();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Display value: show internal value while focused, prop value when not focused
  const displayValue = isFocused ? internalValue : value;
  const showClearButton =
    clearButtonMode !== 'never' &&
    ((clearButtonMode === 'while-editing' && isFocused && displayValue !== '') ||
      (clearButtonMode === 'unless-editing' && !isFocused && displayValue !== '') ||
      (clearButtonMode === 'always' && displayValue !== ''));

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          disabled && styles.inputContainerDisabled,
          multiline && styles.inputContainerMultiline,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            disabled && styles.inputDisabled,
            multiline && styles.inputMultiline,
          ]}
          value={displayValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          autoCorrect={autoCorrect}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !showPassword}
          editable={!disabled}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          selectTextOnFocus={!multiline}
          onSubmitEditing={onSubmitEditing}
          textAlignVertical={multiline ? 'top' : 'center'}
        />

        {/* Password visibility toggle */}
        {secureTextEntry && !disabled && (
          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.passwordToggle}>
            <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* Clear button */}
        {showClearButton && !disabled && !secureTextEntry && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Icon name="clear" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  inputContainerFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#F8F9FF',
  },
  inputContainerDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D1D1D1',
  },
  inputContainerMultiline: {
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 80,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
    textAlign: 'left',
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    color: '#999',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  passwordToggle: {
    padding: 8,
    marginLeft: 8,
  },
});

export default SimpleTextInput;
