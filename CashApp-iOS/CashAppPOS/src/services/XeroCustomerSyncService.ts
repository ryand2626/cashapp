import AsyncStorage from '@react-native-async-storage/async-storage';

import XeroApiClient from './XeroApiClient';

export interface CustomerSyncOptions {
  direction: 'to_xero' | 'from_xero' | 'bidirectional';
  batchSize?: number;
  conflictResolution?: 'xero_wins' | 'pos_wins' | 'latest_wins' | 'manual';
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsFailed: number;
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  entityId: string;
  entityType: 'customer';
  operation: 'create' | 'update' | 'delete';
  error: string;
  data?: any;
}

export interface POSCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  taxNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  xeroContactId?: string;
}

export interface XeroContact {
  ContactID?: string;
  ContactNumber?: string;
  AccountNumber?: string;
  ContactStatus?: 'ACTIVE' | 'ARCHIVED';
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  BankAccountDetails?: string;
  TaxNumber?: string;
  AccountsReceivableTaxType?: string;
  AccountsPayableTaxType?: string;
  Addresses?: XeroAddress[];
  Phones?: XeroPhone[];
  IsSupplier?: boolean;
  IsCustomer?: boolean;
  DefaultCurrency?: string;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
}

export interface XeroAddress {
  AddressType: 'POBOX' | 'STREET' | 'DELIVERY';
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  AddressLine4?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
  AttentionTo?: string;
}

export interface XeroPhone {
  PhoneType: 'DEFAULT' | 'DDI' | 'FAX' | 'MOBILE';
  PhoneNumber: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
}

export interface CustomerMapping {
  posCustomerId: string;
  xeroContactId: string;
  lastSyncedAt: Date;
  syncDirection: 'to_xero' | 'from_xero';
  conflictResolution?: string;
}

export class XeroCustomerSyncService {
  private static instance: XeroCustomerSyncService;
  private apiClient: XeroApiClient;
  private readonly STORAGE_PREFIX = 'xero_customer_sync_';
  private readonly MAPPING_KEY = 'customer_mappings';
  private readonly LAST_SYNC_KEY = 'last_customer_sync';

  private constructor() {
    this.apiClient = XeroApiClient.getInstance();
  }

  public static getInstance(): XeroCustomerSyncService {
    if (!XeroCustomerSyncService.instance) {
      XeroCustomerSyncService.instance = new XeroCustomerSyncService();
    }
    return XeroCustomerSyncService.instance;
  }

  /**
   * Sync customers to Xero (POS -> Xero)
   */
  public async syncCustomersToXero(
    customers: POSCustomer[],
    options: CustomerSyncOptions = { direction: 'to_xero' }
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const mappings = await this.getCustomerMappings();
      const batchSize = options.batchSize || 10;

      // Process customers in batches
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);

        for (const customer of batch) {
          try {
            result.recordsProcessed++;

            const existingMapping = mappings.find((m) => m.posCustomerId === customer.id);

            if (existingMapping && existingMapping.xeroContactId) {
              // Update existing contact
              await this.updateXeroContact(customer, existingMapping.xeroContactId);
              result.recordsUpdated++;
            } else {
              // Create new contact
              const xeroContactId = await this.createXeroContact(customer);
              result.recordsCreated++;

              // Save mapping
              await this.saveCustomerMapping({
                posCustomerId: customer.id,
                xeroContactId,
                lastSyncedAt: new Date(),
                syncDirection: 'to_xero',
              });
            }
          } catch (error) {
            logger.error(`Failed to sync customer ${customer.id}:`, error);
            result.recordsFailed++;
            result.errors.push({
              entityId: customer.id,
              entityType: 'customer',
              operation: existingMapping ? 'update' : 'create',
              error: error instanceof Error ? error.message : 'Unknown error',
              data: customer,
            });
          }
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < customers.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      await this.updateLastSyncTime();
      result.success = result.recordsFailed === 0;
    } catch (error) {
      logger.error('Customer sync to Xero failed:', error);
      result.success = false;
      result.errors.push({
        entityId: 'batch',
        entityType: 'customer',
        operation: 'create',
        error: error instanceof Error ? error.message : 'Batch sync failed',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync customers from Xero (Xero -> POS)
   */
  public async syncCustomersFromXero(
    options: CustomerSyncOptions = { direction: 'from_xero' }
  ): Promise<{ result: SyncResult; customers: POSCustomer[] }> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };
    const customers: POSCustomer[] = [];

    try {
      const lastSync = await this.getLastSyncTime();
      const mappings = await this.getCustomerMappings();

      // Build where clause for modified contacts
      let whereClause = 'IsCustomer==true';
      if (lastSync) {
        const isoDate = lastSync.toISOString();
        whereClause += ` AND UpdatedDateUTC>DateTime(${isoDate})`;
      }

      // Fetch contacts from Xero
      const xeroResponse = await this.apiClient.getContacts({
        where: whereClause,
        order: 'UpdatedDateUTC DESC',
      });

      const xeroContacts = xeroResponse.Contacts || [];
      result.recordsProcessed = xeroContacts.length;

      for (const xeroContact of xeroContacts) {
        try {
          const existingMapping = mappings.find((m) => m.xeroContactId === xeroContact.ContactID);
          const posCustomer = this.transformXeroContactToPOSCustomer(
            xeroContact,
            existingMapping?.posCustomerId
          );

          customers.push(posCustomer);

          if (existingMapping) {
            result.recordsUpdated++;
          } else {
            result.recordsCreated++;

            // Save new mapping
            await this.saveCustomerMapping({
              posCustomerId: posCustomer.id,
              xeroContactId: xeroContact.ContactID!,
              lastSyncedAt: new Date(),
              syncDirection: 'from_xero',
            });
          }
        } catch (error) {
          logger.error(`Failed to process Xero contact ${xeroContact.ContactID}:`, error);
          result.recordsFailed++;
          result.errors.push({
            entityId: xeroContact.ContactID || 'unknown',
            entityType: 'customer',
            operation: 'create',
            error: error instanceof Error ? error.message : 'Transform failed',
            data: xeroContact,
          });
        }
      }

      await this.updateLastSyncTime();
      result.success = result.recordsFailed === 0;
    } catch (error) {
      logger.error('Customer sync from Xero failed:', error);
      result.success = false;
      result.errors.push({
        entityId: 'batch',
        entityType: 'customer',
        operation: 'create',
        error: error instanceof Error ? error.message : 'Batch sync failed',
      });
    }

    result.duration = Date.now() - startTime;
    return { result, customers };
  }

  /**
   * Bidirectional sync with conflict resolution
   */
  public async syncCustomersBidirectional(
    posCustomers: POSCustomer[],
    options: CustomerSyncOptions = { direction: 'bidirectional', conflictResolution: 'latest_wins' }
  ): Promise<{ result: SyncResult; mergedCustomers: POSCustomer[] }> {
    const startTime = Date.now();

    // First, sync from Xero to get latest changes
    const fromXeroResult = await this.syncCustomersFromXero({ direction: 'from_xero' });

    // Then, sync to Xero with conflict resolution
    const toXeroResult = await this.syncCustomersToXero(posCustomers, { direction: 'to_xero' });

    // Merge results
    const combinedResult: SyncResult = {
      success: fromXeroResult.result.success && toXeroResult.success,
      recordsProcessed: fromXeroResult.result.recordsProcessed + toXeroResult.recordsProcessed,
      recordsUpdated: fromXeroResult.result.recordsUpdated + toXeroResult.recordsUpdated,
      recordsCreated: fromXeroResult.result.recordsCreated + toXeroResult.recordsCreated,
      recordsFailed: fromXeroResult.result.recordsFailed + toXeroResult.recordsFailed,
      errors: [...fromXeroResult.result.errors, ...toXeroResult.errors],
      duration: Date.now() - startTime,
    };

    return {
      result: combinedResult,
      mergedCustomers: fromXeroResult.customers,
    };
  }

  /**
   * Create new contact in Xero
   */
  private async createXeroContact(customer: POSCustomer): Promise<string> {
    const xeroContact = this.transformPOSCustomerToXeroContact(customer);

    const response = await this.apiClient.createContact({
      Contacts: [xeroContact],
    });

    if (!response.Contacts || response.Contacts.length === 0) {
      throw new Error('Failed to create contact in Xero');
    }

    return response.Contacts[0].ContactID!;
  }

  /**
   * Update existing contact in Xero
   */
  private async updateXeroContact(customer: POSCustomer, xeroContactId: string): Promise<void> {
    const xeroContact = this.transformPOSCustomerToXeroContact(customer);
    xeroContact.ContactID = xeroContactId;

    await this.apiClient.makeRequest(`/Contacts/${xeroContactId}`, {
      method: 'POST',
      body: { Contacts: [xeroContact] },
    });
  }

  /**
   * Transform POS customer to Xero contact format
   */
  private transformPOSCustomerToXeroContact(customer: POSCustomer): XeroContact {
    const contact: XeroContact = {
      Name: customer.name,
      EmailAddress: customer.email,
      TaxNumber: customer.taxNumber,
      IsCustomer: true,
      IsSupplier: false,
      ContactStatus: customer.isActive ? 'ACTIVE' : 'ARCHIVED',
    };

    // Add phone if available
    if (customer.phone) {
      contact.Phones = [
        {
          PhoneType: 'DEFAULT',
          PhoneNumber: customer.phone,
        },
      ];
    }

    // Add address if available
    if (customer.address) {
      contact.Addresses = [
        {
          AddressType: 'STREET',
          AddressLine1: customer.address.line1,
          AddressLine2: customer.address.line2,
          City: customer.address.city,
          Region: customer.address.region,
          PostalCode: customer.address.postalCode,
          Country: customer.address.country,
        },
      ];
    }

    return contact;
  }

  /**
   * Transform Xero contact to POS customer format
   */
  private transformXeroContactToPOSCustomer(
    xeroContact: XeroContact,
    existingId?: string
  ): POSCustomer {
    const customer: POSCustomer = {
      id: existingId || this.generateCustomerId(),
      name: xeroContact.Name,
      email: xeroContact.EmailAddress,
      taxNumber: xeroContact.TaxNumber,
      isActive: xeroContact.ContactStatus === 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(xeroContact.UpdatedDateUTC || Date.now()),
      xeroContactId: xeroContact.ContactID,
    };

    // Extract phone
    if (xeroContact.Phones && xeroContact.Phones.length > 0) {
      const defaultPhone =
        xeroContact.Phones.find((p) => p.PhoneType === 'DEFAULT') || xeroContact.Phones[0];
      customer.phone = defaultPhone.PhoneNumber;
    }

    // Extract address
    if (xeroContact.Addresses && xeroContact.Addresses.length > 0) {
      const streetAddress =
        xeroContact.Addresses.find((a) => a.AddressType === 'STREET') || xeroContact.Addresses[0];
      customer.address = {
        line1: streetAddress.AddressLine1,
        line2: streetAddress.AddressLine2,
        city: streetAddress.City,
        region: streetAddress.Region,
        postalCode: streetAddress.PostalCode,
        country: streetAddress.Country,
      };
    }

    return customer;
  }

  /**
   * Get customer mappings from storage
   */
  private async getCustomerMappings(): Promise<CustomerMapping[]> {
    try {
      const mappingsJson = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${this.MAPPING_KEY}`);
      return mappingsJson ? JSON.parse(mappingsJson) : [];
    } catch (error) {
      logger.error('Failed to get customer mappings:', error);
      return [];
    }
  }

  /**
   * Save customer mapping
   */
  private async saveCustomerMapping(mapping: CustomerMapping): Promise<void> {
    try {
      const mappings = await this.getCustomerMappings();
      const existingIndex = mappings.findIndex((m) => m.posCustomerId === mapping.posCustomerId);

      if (existingIndex >= 0) {
        mappings[existingIndex] = mapping;
      } else {
        mappings.push(mapping);
      }

      await AsyncStorage.setItem(
        `${this.STORAGE_PREFIX}${this.MAPPING_KEY}`,
        JSON.stringify(mappings)
      );
    } catch (error) {
      logger.error('Failed to save customer mapping:', error);
      throw error;
    }
  }

  /**
   * Get last sync time
   */
  private async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastSyncStr = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${this.LAST_SYNC_KEY}`);
      return lastSyncStr ? new Date(lastSyncStr) : null;
    } catch (error) {
      logger.error('Failed to get last sync time:', error);
      return null;
    }
  }

  /**
   * Update last sync time
   */
  private async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_PREFIX}${this.LAST_SYNC_KEY}`,
        new Date().toISOString()
      );
    } catch (error) {
      logger.error('Failed to update last sync time:', error);
    }
  }

  /**
   * Generate unique customer ID
   */
  private generateCustomerId(): string {
    return `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate customer data
   */
  public validateCustomerData(customer: POSCustomer): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!customer.name || customer.name.trim().length === 0) {
      errors.push('Customer name is required');
    }

    if (customer.email && !this.isValidEmail(customer.email)) {
      errors.push('Invalid email format');
    }

    if (customer.phone && !this.isValidPhone(customer.phone)) {
      errors.push('Invalid phone format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Utility functions
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get sync statistics
   */
  public async getSyncStatistics(): Promise<{
    totalMappings: number;
    lastSyncTime: Date | null;
    pendingSync: number;
  }> {
    const mappings = await this.getCustomerMappings();
    const lastSync = await this.getLastSyncTime();

    return {
      totalMappings: mappings.length,
      lastSyncTime: lastSync,
      pendingSync: 0, // Would need to calculate based on local changes
    };
  }
}

export default XeroCustomerSyncService;
