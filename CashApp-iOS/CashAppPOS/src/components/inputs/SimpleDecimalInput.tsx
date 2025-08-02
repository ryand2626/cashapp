import React, { useState, useRef } from 'react';

import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

interface SimpleDecimalInputProps {
  value: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  suffix?: string;
  maxValue?: number;
  minValue?: number;
  decimalPlaces?: number;
  label?: string;
  style?: any;
  disabled?: boolean;
}

const SimpleDecimalInput: React.FC<SimpleDecimalInputProps> = ({
  value,
  onValueChange,
  placeholder = '0.00',
  suffix = '',
  maxValue = 999.99,
  minValue = 0,
  decimalPlaces = 2,
  label,
  style,
  disabled = false,
}) => {
  const [internalValue, setInternalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleTextChange = (text: string) => {
    // CRITICAL: Don't call onValueChange during typing - only update internal state
    setInternalValue(text);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Set internal value to the current prop value when focusing
    setInternalValue(value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);

    // Clean and validate the input
    let cleaned = internalValue.replace(/[^0-9.]/g, '');

    // Handle multiple decimal points
    const decimalIndex = cleaned.indexOf('.');
    if (decimalIndex !== -1) {
      const beforeDecimal = cleaned.substring(0, decimalIndex);
      const afterDecimal = cleaned.substring(decimalIndex + 1).replace(/\./g, '');
      cleaned = beforeDecimal + '.' + afterDecimal;
    }

    // Convert to number
    const numericValue = parseFloat(cleaned) || 0;
    const clampedValue = Math.max(minValue, Math.min(maxValue, numericValue));

    // Update internal value with formatted result
    setInternalValue(clampedValue.toString());

    // ONLY call onValueChange on blur - this prevents keyboard dismissal
    onValueChange(clampedValue);
  };

  const handleClear = () => {
    setInternalValue('');
    inputRef.current?.focus();
  };

  // Display value: show internal value while focused, formatted value when not focused
  const displayValue = isFocused
    ? internalValue
    : value % 1 === 0
    ? value.toString()
    : value.toFixed(decimalPlaces);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          disabled && styles.inputContainerDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, disabled && styles.inputDisabled]}
          value={displayValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          editable={!disabled}
          maxLength={10}
          selectTextOnFocus={true}
        />

        {displayValue !== '' && !disabled && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Icon name="clear" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {suffix && <Text style={[styles.suffix, disabled && styles.suffixDisabled]}>{suffix}</Text>}
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
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    padding: 0,
    textAlign: 'left',
  },
  inputDisabled: {
    color: '#999',
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  suffix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  suffixDisabled: {
    color: '#999',
  },
});

export default SimpleDecimalInput;
