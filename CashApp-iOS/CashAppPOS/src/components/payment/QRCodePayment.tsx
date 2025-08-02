import React, { useState, useEffect, useRef } from 'react';

import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';

import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../../constants/Colors';
import PaymentService from '../../services/PaymentService';
import { logger } from '../../utils/logger';

import QRPaymentErrorBoundary from './QRPaymentErrorBoundary';

import type { PaymentRequest, QRPaymentData } from '../../services/PaymentService';

// Error-safe QR Code Wrapper Component
const QRCodeWrapper: React.FC<{ qrCodeData: string }> = ({ qrCodeData }) => {
  const [hasError, setHasError] = useState(false);
  const wrapperStyles = createQRWrapperStyles();

  try {
    if (!qrCodeData || qrCodeData.length === 0) {
      throw new Error('Invalid QR code data');
    }

    if (hasError) {
      return (
        <View style={wrapperStyles.errorContainer}>
          <Icon name="error" size={60} color={Colors.danger} />
          <Text style={wrapperStyles.errorText}>QR Error</Text>
        </View>
      );
    }

    return (
      <QRCode
        value={qrCodeData}
        size={180}
        color={Colors.text}
        backgroundColor={Colors.white}
        onError={() => setHasError(true)}
      />
    );
  } catch (error) {
    logger.error('QR Code generation error:', error);
    return (
      <View style={wrapperStyles.unavailableContainer}>
        <Icon name="qr-code" size={60} color={Colors.lightText} />
        <Text style={wrapperStyles.unavailableText}>QR Unavailable</Text>
      </View>
    );
  }
};

interface QRCodePaymentProps {
  request: PaymentRequest;
  onPaymentComplete: (result: unknown) => void;
  onCancel: () => void;
}

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

export const QRCodePayment: React.FC<QRCodePaymentProps> = ({
  request,
  onPaymentComplete,
  onCancel,
}) => {
  const [status, setStatus] = useState<
    'generating' | 'waiting' | 'completed' | 'expired' | 'error'
  >('generating');
  const [qrData, setQrData] = useState<QRPaymentData | null>(null);
  const [error, setError] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    generateQRPayment();

    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;

      // Clean up all timers
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (qrData && status === 'waiting' && isMountedRef.current) {
      // Clean up existing timers
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      // Start polling for payment status
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          checkPaymentStatus();
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 3000);

      // Setup expiration timer
      const expiryTime = new Date(qrData.expiresAt).getTime();
      const now = Date.now();
      const timeLeft = Math.max(0, expiryTime - now);

      if (isMountedRef.current) {
        setRemainingTime(Math.floor(timeLeft / 1000));
      }

      countdownRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return;
        }

        setRemainingTime((prev) => {
          if (prev <= 1) {
            setStatus('expired');

            // Clean up timers
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [qrData, status]);

  const generateQRPayment = async () => {
    try {
      if (!isMountedRef.current) return;

      setStatus('generating');
      setError('');

      const data = await PaymentService.generateQRPayment(request);

      if (!isMountedRef.current) return;

      setQrData(data);
      setStatus('waiting');
    } catch (err) {
      logger.error('❌ QR Payment generation failed:', err);

      if (isMountedRef.current) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to generate QR code');
      }
    }
  };

  const checkPaymentStatus = async () => {
    if (!qrData || !isMountedRef.current) return;

    try {
      const statusResult = await PaymentService.checkQRPaymentStatus(qrData.qrPaymentId);

      if (!isMountedRef.current) return;

      if (statusResult.status === 'completed') {
        setStatus('completed');

        // Clean up timers
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }

        // Confirm the payment
        const result = await PaymentService.confirmQRPayment(qrData.qrPaymentId);

        if (isMountedRef.current) {
          onPaymentComplete(result);
        }
      } else if (statusResult.expired) {
        if (isMountedRef.current) {
          setStatus('expired');
        }
      }
    } catch (err) {
      logger.error('❌ Failed to check QR payment status:', err);

      if (isMountedRef.current) {
        setError('Failed to check payment status');
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQRContent = () => {
    switch (status) {
      case 'generating':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.statusText}>Generating QR Code...</Text>
          </View>
        );

      case 'waiting':
        return qrData ? (
          <View style={styles.qrContainer}>
            <View style={styles.qrCodeWrapper}>
              <QRCodeWrapper qrCodeData={qrData.qrCodeData} />
            </View>

            <Text style={styles.qrInstructions}>Scan this QR code with your banking app</Text>

            <View style={styles.timeContainer}>
              <Icon name="access-time" size={16} color={Colors.warning} />
              <Text style={styles.timeText}>Expires in {formatTime(remainingTime)}</Text>
            </View>

            <View style={styles.paymentDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Amount:</Text>
                <Text style={styles.detailValue}>£{qrData.amount.toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fee:</Text>
                <Text style={styles.detailValue}>£{qrData.feeAmount.toFixed(2)} (1.2%)</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>You receive:</Text>
                <Text style={[styles.detailValue, styles.netAmount]}>
                  £{qrData.netAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.benefits}>
              <Text style={styles.benefitsTitle}>Why QR Payment?</Text>
              <View style={styles.benefitRow}>
                <Icon name="security" size={16} color={Colors.success} />
                <Text style={styles.benefitText}>Secure & Safe</Text>
              </View>
              <View style={styles.benefitRow}>
                <Icon name="speed" size={16} color={Colors.success} />
                <Text style={styles.benefitText}>Instant Payment</Text>
              </View>
              <View style={styles.benefitRow}>
                <Icon name="money-off" size={16} color={Colors.success} />
                <Text style={styles.benefitText}>Lowest Fees (1.2%)</Text>
              </View>
            </View>
          </View>
        ) : null;

      case 'completed':
        return (
          <View style={styles.statusContainer}>
            <Icon name="check-circle" size={64} color={Colors.success} />
            <Text style={styles.statusText}>Payment Received!</Text>
            <Text style={styles.subText}>Processing your order...</Text>
          </View>
        );

      case 'expired':
        return (
          <View style={styles.statusContainer}>
            <Icon name="access-time" size={64} color={Colors.warning} />
            <Text style={styles.statusText}>QR Code Expired</Text>
            <Text style={styles.subText}>Please generate a new QR code</Text>
            <TouchableOpacity style={styles.retryButton} onPress={generateQRPayment}>
              <Text style={styles.retryButtonText}>Generate New QR</Text>
            </TouchableOpacity>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Icon name="error" size={64} color={Colors.danger} />
            <Text style={styles.statusText}>Error</Text>
            <Text style={styles.subText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={generateQRPayment}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <QRPaymentErrorBoundary
      onReset={() => {
        // Reset component state and regenerate QR
        setStatus('generating');
        setError('');
        setQrData(null);
        generateQRPayment();
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>QR Code Payment</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.darkGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>Amount Due</Text>
          <Text style={styles.amountValue}>£{request.amount.toFixed(2)}</Text>
        </View>

        {renderQRContent()}

        {status === 'waiting' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.simulateButton}
              onPress={() => {
                // For testing - simulate successful payment
                setStatus('completed');
                setTimeout(() => {
                  onPaymentComplete({
                    success: true,
                    transactionId: qrData?.qrPaymentId,
                    provider: 'qr_code',
                    amount: request.amount,
                    fee: qrData?.feeAmount || 0,
                  });
                }, 2000);
              }}
            >
              <Text style={styles.simulateButtonText}>Simulate Payment (Test)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </QRPaymentErrorBoundary>
  );
};

// QR Wrapper component styles
const qrWrapperStyles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 8,
  },
  unavailableText: {
    color: Colors.lightText,
    fontSize: 12,
    marginTop: 8,
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    maxHeight: '90%',
    width: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  amountContainer: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  amountLabel: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statusContainer: {
    alignItems: 'center',
    padding: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrCodeWrapper: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    ...require('../../utils/ShadowUtils').createOptimizedShadow('medium', Colors.white),
  },
  qrInstructions: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 4,
    fontWeight: '500',
  },
  paymentDetails: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  netAmount: {
    color: Colors.primary,
    fontWeight: '600',
  },
  benefits: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  simulateButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  simulateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

const createQRWrapperStyles = () =>
  StyleSheet.create({
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 180,
      height: 180,
    },
    errorText: {
      color: Colors.danger,
      fontSize: 12,
      marginTop: 8,
    },
    unavailableContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 180,
      height: 180,
    },
    unavailableText: {
      color: Colors.lightText,
      fontSize: 12,
      marginTop: 8,
    },
  });

export default QRCodePayment;
