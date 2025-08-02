// Xero Integration Types and Models

export enum XeroSyncDirection {
  TO_XERO = 'to_xero',
  FROM_XERO = 'from_xero',
  BIDIRECTIONAL = 'bidirectional',
}

export enum XeroSyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum XeroEntityType {
  CONTACT = 'contact',
  ITEM = 'item',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
  CREDIT_NOTE = 'credit_note',
}

export enum XeroConflictResolution {
  XERO_WINS = 'xero_wins',
  POS_WINS = 'pos_wins',
  LATEST_WINS = 'latest_wins',
  MANUAL = 'manual',
}

// Base Sync Interfaces
export interface BaseSyncOptions {
  direction?: XeroSyncDirection;
  batchSize?: number;
  conflictResolution?: XeroConflictResolution;
  dryRun?: boolean;
}

export interface BaseSyncResult {
  success: boolean;
  status: XeroSyncStatus;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsFailed: number;
  errors: XeroSyncError[];
  warnings: XeroSyncWarning[];
  duration: number;
  startTime: Date;
  endTime: Date;
}

export interface XeroSyncError {
  id: string;
  entityId: string;
  entityType: XeroEntityType;
  operation: 'create' | 'update' | 'delete' | 'sync';
  errorCode?: string;
  error: string;
  data?: any;
  timestamp: Date;
  retryable: boolean;
}

export interface XeroSyncWarning {
  id: string;
  entityId: string;
  entityType: XeroEntityType;
  message: string;
  data?: any;
  timestamp: Date;
}

// Entity Mapping Models
export interface BaseEntityMapping {
  id: string;
  posEntityId: string;
  xeroEntityId: string;
  entityType: XeroEntityType;
  lastSyncedAt: Date;
  syncDirection: XeroSyncDirection;
  syncStatus: XeroSyncStatus;
  conflictResolution?: XeroConflictResolution;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMapping extends BaseEntityMapping {
  entityType: XeroEntityType.CONTACT;
  posCustomerId: string;
  xeroContactId: string;
}

export interface ItemMapping extends BaseEntityMapping {
  entityType: XeroEntityType.ITEM;
  posItemId: string;
  xeroItemId: string;
  categoryMapping?: string;
}

export interface InvoiceMapping extends BaseEntityMapping {
  entityType: XeroEntityType.INVOICE;
  posOrderId: string;
  xeroInvoiceId: string;
  xeroPaymentId?: string;
  orderTotal: number;
  invoiceTotal: number;
  reconciled: boolean;
}

// Sync Configuration Models
export interface XeroSyncConfiguration {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  entityType: XeroEntityType;
  syncDirection: XeroSyncDirection;
  schedule?: XeroSyncSchedule;
  options: BaseSyncOptions;
  filters?: XeroSyncFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface XeroSyncSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  interval?: number; // For custom intervals
  time?: string; // HH:MM format for daily/weekly/monthly
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  timezone?: string;
  lastRun?: Date;
  nextRun?: Date;
}

export interface XeroSyncFilters {
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  status?: string[];
  categories?: string[];
  customFilters?: Record<string, any>;
}

// Sync Session Models
export interface XeroSyncSession {
  id: string;
  sessionType: 'manual' | 'scheduled' | 'realtime';
  entityType: XeroEntityType;
  syncDirection: XeroSyncDirection;
  status: XeroSyncStatus;
  result?: BaseSyncResult;
  configuration?: XeroSyncConfiguration;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string; // User ID or 'system'
  metadata?: Record<string, any>;
}

// Audit and Logging Models
export interface XeroSyncAuditLog {
  id: string;
  sessionId: string;
  entityId: string;
  entityType: XeroEntityType;
  operation: 'create' | 'read' | 'update' | 'delete' | 'sync';
  status: 'success' | 'warning' | 'error';
  changes?: XeroSyncChange[];
  errorDetails?: XeroSyncError;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface XeroSyncChange {
  field: string;
  oldValue: any;
  newValue: any;
  source: 'pos' | 'xero';
}

// Statistics and Monitoring Models
export interface XeroSyncStatistics {
  entityType?: XeroEntityType;
  totalMappings: number;
  syncedEntities: number;
  pendingEntities: number;
  failedEntities: number;
  lastSyncTime?: Date;
  lastSuccessfulSync?: Date;
  averageSyncDuration: number;
  successRate: number; // Percentage
  errorRate: number; // Percentage
  apiUsage: {
    requestsToday: number;
    requestsThisMonth: number;
    remainingRequests: number;
    dailyLimit: number;
    monthlyLimit: number;
  };
  recentErrors: XeroSyncError[];
  performance: {
    averageResponseTime: number;
    slowestEndpoint: string;
    fastestEndpoint: string;
  };
}

// Real-time Sync Models
export interface XeroWebhookEvent {
  id: string;
  tenantId: string;
  eventCategory: string;
  eventType: string;
  resourceUrl: string;
  resourceId: string;
  eventDateUtc: Date;
  signature?: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

// Data Validation Models
export interface XeroValidationRule {
  id: string;
  entityType: XeroEntityType;
  field: string;
  rule: 'required' | 'format' | 'range' | 'custom';
  parameters?: any;
  errorMessage: string;
  isActive: boolean;
}

export interface XeroValidationResult {
  isValid: boolean;
  errors: XeroValidationError[];
  warnings: XeroValidationWarning[];
}

export interface XeroValidationError {
  field: string;
  rule: string;
  message: string;
  value?: any;
}

export interface XeroValidationWarning {
  field: string;
  message: string;
  value?: any;
}

// Cache Models
export interface XeroCacheEntry {
  key: string;
  entityType: XeroEntityType;
  data: any;
  timestamp: Date;
  expiresAt: Date;
  size: number; // In bytes
  hitCount: number;
  lastAccessed: Date;
}

export interface XeroCacheStatistics {
  totalEntries: number;
  totalSize: number; // In bytes
  hitRate: number; // Percentage
  missRate: number; // Percentage
  expiredEntries: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  byEntityType: Record<
    XeroEntityType,
    {
      count: number;
      size: number;
      hitRate: number;
    }
  >;
}

// Integration Health Models
export interface XeroIntegrationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  lastCheck: Date;
  authentication: {
    status: 'valid' | 'expired' | 'invalid';
    tokenExpiry?: Date;
    lastRefresh?: Date;
  };
  apiConnectivity: {
    status: 'connected' | 'disconnected' | 'limited';
    responseTime?: number;
    lastSuccessfulCall?: Date;
    errorRate: number;
  };
  dataIntegrity: {
    status: 'consistent' | 'inconsistent' | 'unknown';
    lastValidation?: Date;
    discrepancies: number;
  };
  syncStatus: {
    status: XeroSyncStatus;
    lastSync?: Date;
    pendingOperations: number;
    failedOperations: number;
  };
  resourceUsage: {
    apiCallsToday: number;
    storageUsed: number; // In bytes
    cacheSize: number; // In bytes
  };
  alerts: XeroHealthAlert[];
}

export interface XeroHealthAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'authentication' | 'api' | 'sync' | 'data' | 'performance';
  message: string;
  details?: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// User Preferences and Settings
export interface XeroUserPreferences {
  userId: string;
  notifications: {
    syncCompletion: boolean;
    syncErrors: boolean;
    dailySummary: boolean;
    weeklyReport: boolean;
    systemAlerts: boolean;
  };
  defaultSyncOptions: BaseSyncOptions;
  dashboardLayout: {
    widgets: string[];
    refreshInterval: number;
  };
  reportPreferences: {
    defaultDateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
    includeGraphics: boolean;
    includeDetails: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Export interfaces for external use
export type {
  BaseSyncOptions,
  BaseSyncResult,
  XeroSyncError,
  XeroSyncWarning,
  BaseEntityMapping,
  CustomerMapping,
  ItemMapping,
  InvoiceMapping,
  XeroSyncConfiguration,
  XeroSyncSchedule,
  XeroSyncFilters,
  XeroSyncSession,
  XeroSyncAuditLog,
  XeroSyncChange,
  XeroSyncStatistics,
  XeroWebhookEvent,
  XeroValidationRule,
  XeroValidationResult,
  XeroValidationError,
  XeroValidationWarning,
  XeroCacheEntry,
  XeroCacheStatistics,
  XeroIntegrationHealth,
  XeroHealthAlert,
  XeroUserPreferences,
};

// Export enums for external use
export { XeroSyncDirection, XeroSyncStatus, XeroEntityType, XeroConflictResolution };
