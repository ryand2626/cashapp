import AsyncStorage from '@react-native-async-storage/async-storage';

import XeroApiClient from './XeroApiClient';
import XeroCustomerSyncService from './XeroCustomerSyncService';
import XeroItemsSyncService from './XeroItemsSyncService';

export interface SalesSyncOptions {
  syncPayments?: boolean;
  createContacts?: boolean;
  batchSize?: number;
  dateRange?: { start: Date; end: Date };
}

export interface SalesSyncResult {
  success: boolean;
  invoicesProcessed: number;
  invoicesCreated: number;
  invoicesFailed: number;
  paymentsProcessed: number;
  paymentsCreated: number;
  paymentsFailed: number;
  errors: SalesSyncError[];
  duration: number;
}

export interface SalesSyncError {
  entityId: string;
  entityType: 'invoice' | 'payment' | 'contact';
  operation: 'create' | 'update';
  error: string;
  data?: any;
}

export interface POSOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  items: POSOrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  tipAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'contactless' | 'mobile' | 'other';
  paymentReference?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
  notes?: string;
  xeroInvoiceId?: string;
  xeroPaymentId?: string;
}

export interface POSOrderItem {
  id: string;
  itemId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  modifiers?: POSOrderModifier[];
}

export interface POSOrderModifier {
  id: string;
  name: string;
  price: number;
}

export interface XeroInvoice {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Reference?: string;
  Type: 'ACCREC' | 'ACCPAY';
  Contact: {
    ContactID?: string;
    Name: string;
    EmailAddress?: string;
  };
  Date: string;
  DueDate: string;
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  LineItems: XeroLineItem[];
  SubTotal?: number;
  TotalTax?: number;
  Total?: number;
  Status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  CurrencyCode?: string;
  UpdatedDateUTC?: string;
}

export interface XeroLineItem {
  ItemCode?: string;
  Description: string;
  Quantity: number;
  UnitAmount: number;
  LineAmount?: number;
  TaxType?: string;
  TaxAmount?: number;
  DiscountRate?: number;
  AccountCode?: string;
}

export interface XeroPayment {
  PaymentID?: string;
  Invoice: {
    InvoiceID: string;
  };
  Account: {
    AccountID?: string;
    Code?: string;
  };
  Date: string;
  Amount: number;
  Reference?: string;
  IsReconciled?: boolean;
  Status?: 'AUTHORISED' | 'DELETED';
}

export interface SalesMapping {
  posOrderId: string;
  xeroInvoiceId?: string;
  xeroPaymentId?: string;
  lastSyncedAt: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export class XeroSalesSyncService {
  private static instance: XeroSalesSyncService;
  private apiClient: XeroApiClient;
  private customerSyncService: XeroCustomerSyncService;
  private itemsSyncService: XeroItemsSyncService;

  private readonly STORAGE_PREFIX = 'xero_sales_sync_';
  private readonly MAPPING_KEY = 'sales_mappings';
  private readonly LAST_SYNC_KEY = 'last_sales_sync';

  // Default Xero account codes
  private readonly DEFAULT_ACCOUNTS = {
    SALES: '200', // Sales Revenue
    CASH: '090', // Cash at Bank
    CARD: '091', // Card Payments
    ROUNDING: '860', // Rounding Account
  };

  private constructor() {
    this.apiClient = XeroApiClient.getInstance();
    this.customerSyncService = XeroCustomerSyncService.getInstance();
    this.itemsSyncService = XeroItemsSyncService.getInstance();
  }

  public static getInstance(): XeroSalesSyncService {
    if (!XeroSalesSyncService.instance) {
      XeroSalesSyncService.instance = new XeroSalesSyncService();
    }
    return XeroSalesSyncService.instance;
  }

  /**
   * Sync completed orders to Xero as invoices
   */
  public async syncOrdersToXero(
    orders: POSOrder[],
    options: SalesSyncOptions = {}
  ): Promise<SalesSyncResult> {
    const startTime = Date.now();
    const result: SalesSyncResult = {
      success: true,
      invoicesProcessed: 0,
      invoicesCreated: 0,
      invoicesFailed: 0,
      paymentsProcessed: 0,
      paymentsCreated: 0,
      paymentsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const mappings = await this.getSalesMappings();
      const batchSize = options.batchSize || 10;

      // Filter orders that haven't been synced yet
      const completedOrders = orders.filter(
        (order) =>
          order.status === 'completed' &&
          !mappings.find((m) => m.posOrderId === order.id && m.syncStatus === 'synced')
      );

      // Process orders in batches
      for (let i = 0; i < completedOrders.length; i += batchSize) {
        const batch = completedOrders.slice(i, i + batchSize);

        for (const order of batch) {
          try {
            result.invoicesProcessed++;

            // Create invoice in Xero
            const invoiceId = await this.createInvoiceFromOrder(order, options);
            result.invoicesCreated++;

            let paymentId: string | undefined;

            // Create payment if order is paid
            if (options.syncPayments !== false && order.status === 'completed') {
              try {
                result.paymentsProcessed++;
                paymentId = await this.createPaymentForOrder(order, invoiceId);
                result.paymentsCreated++;
              } catch (paymentError) {
                console.error(`Failed to create payment for order ${order.id}:`, paymentError);
                result.paymentsFailed++;
                result.errors.push({
                  entityId: order.id,
                  entityType: 'payment',
                  operation: 'create',
                  error:
                    paymentError instanceof Error
                      ? paymentError.message
                      : 'Payment creation failed',
                  data: order,
                });
              }
            }

            // Save mapping
            await this.saveSalesMapping({
              posOrderId: order.id,
              xeroInvoiceId: invoiceId,
              xeroPaymentId: paymentId,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
            });
          } catch (error) {
            console.error(`Failed to sync order ${order.id}:`, error);
            result.invoicesFailed++;
            result.errors.push({
              entityId: order.id,
              entityType: 'invoice',
              operation: 'create',
              error: error instanceof Error ? error.message : 'Unknown error',
              data: order,
            });

            // Mark as failed in mapping
            await this.saveSalesMapping({
              posOrderId: order.id,
              lastSyncedAt: new Date(),
              syncStatus: 'failed',
            });
          }
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < completedOrders.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      await this.updateLastSyncTime();
      result.success = result.invoicesFailed === 0 && result.paymentsFailed === 0;
    } catch (error) {
      console.error('Sales sync to Xero failed:', error);
      result.success = false;
      result.errors.push({
        entityId: 'batch',
        entityType: 'invoice',
        operation: 'create',
        error: error instanceof Error ? error.message : 'Batch sync failed',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Create invoice from POS order
   */
  private async createInvoiceFromOrder(
    order: POSOrder,
    options: SalesSyncOptions
  ): Promise<string> {
    // Get or create contact
    const contactId = await this.getOrCreateContact(order, options);

    // Transform order to Xero invoice
    const xeroInvoice = await this.transformOrderToXeroInvoice(order, contactId);

    // Create invoice in Xero
    const response = await this.apiClient.createInvoice({
      Invoices: [xeroInvoice],
    });

    if (!response.Invoices || response.Invoices.length === 0) {
      throw new Error('Failed to create invoice in Xero');
    }

    return response.Invoices[0].InvoiceID!;
  }

  /**
   * Create payment for order
   */
  private async createPaymentForOrder(order: POSOrder, invoiceId: string): Promise<string> {
    const accountCode = this.getPaymentAccountCode(order.paymentMethod);

    const xeroPayment: XeroPayment = {
      Invoice: {
        InvoiceID: invoiceId,
      },
      Account: {
        Code: accountCode,
      },
      Date: (order.completedAt || order.createdAt).toISOString().split('T')[0],
      Amount: order.totalAmount,
      Reference: order.paymentReference || `POS-${order.orderNumber}`,
      IsReconciled: false,
    };

    const response = await this.apiClient.makeRequest('/Payments', {
      method: 'POST',
      body: { Payments: [xeroPayment] },
    });

    if (!response.data.Payments || response.data.Payments.length === 0) {
      throw new Error('Failed to create payment in Xero');
    }

    return response.data.Payments[0].PaymentID!;
  }

  /**
   * Get or create contact for order
   */
  private async getOrCreateContact(order: POSOrder, options: SalesSyncOptions): Promise<string> {
    // If customer exists, try to find their Xero contact ID
    if (order.customerId) {
      const customerMappings = await this.customerSyncService.getCustomerMappings();
      const mapping = customerMappings.find((m) => m.posCustomerId === order.customerId);

      if (mapping?.xeroContactId) {
        return mapping.xeroContactId;
      }
    }

    // Create cash customer or use provided customer info
    const contactName = order.customerName || 'Cash Customer';
    const contactEmail = order.customerEmail;

    // Check if we should create contacts
    if (options.createContacts === false) {
      // Use default cash customer
      return await this.getOrCreateCashCustomer();
    }

    // Create new contact in Xero
    const xeroContact = {
      Name: contactName,
      EmailAddress: contactEmail,
      IsCustomer: true,
      IsSupplier: false,
    };

    const response = await this.apiClient.createContact({
      Contacts: [xeroContact],
    });

    if (!response.Contacts || response.Contacts.length === 0) {
      throw new Error('Failed to create contact in Xero');
    }

    return response.Contacts[0].ContactID!;
  }

  /**
   * Get or create default cash customer
   */
  private async getOrCreateCashCustomer(): Promise<string> {
    try {
      // Try to find existing cash customer
      const response = await this.apiClient.getContacts({ where: 'Name=="Cash Customer"' });

      if (response.Contacts && response.Contacts.length > 0) {
        return response.Contacts[0].ContactID!;
      }

      // Create cash customer
      const cashContact = {
        Name: 'Cash Customer',
        IsCustomer: true,
        IsSupplier: false,
      };

      const createResponse = await this.apiClient.createContact({
        Contacts: [cashContact],
      });

      return createResponse.Contacts[0].ContactID!;
    } catch (error) {
      console.error('Failed to get or create cash customer:', error);
      throw error;
    }
  }

  /**
   * Transform POS order to Xero invoice
   */
  private async transformOrderToXeroInvoice(
    order: POSOrder,
    contactId: string
  ): Promise<XeroInvoice> {
    const lineItems: XeroLineItem[] = [];

    // Add order items as line items
    for (const item of order.items) {
      const lineItem: XeroLineItem = {
        Description: item.name + (item.description ? ` - ${item.description}` : ''),
        Quantity: item.quantity,
        UnitAmount: item.unitPrice,
        LineAmount: item.totalPrice,
        TaxType: this.getTaxType(item.taxRate),
        AccountCode: this.DEFAULT_ACCOUNTS.SALES,
      };

      // Add item code if available
      if (item.itemId) {
        lineItem.ItemCode = item.itemId;
      }

      // Add discount if applicable
      if (item.discountAmount && item.discountAmount > 0) {
        const discountRate = (item.discountAmount / (item.quantity * item.unitPrice)) * 100;
        lineItem.DiscountRate = Math.round(discountRate * 100) / 100; // Round to 2 decimal places
      }

      lineItems.push(lineItem);

      // Add modifiers as separate line items
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          lineItems.push({
            Description: `${item.name} - ${modifier.name}`,
            Quantity: item.quantity,
            UnitAmount: modifier.price,
            LineAmount: modifier.price * item.quantity,
            TaxType: this.getTaxType(item.taxRate),
            AccountCode: this.DEFAULT_ACCOUNTS.SALES,
          });
        }
      }
    }

    // Add discount as separate line item if applicable
    if (order.discountAmount && order.discountAmount > 0) {
      lineItems.push({
        Description: 'Discount',
        Quantity: 1,
        UnitAmount: -order.discountAmount,
        LineAmount: -order.discountAmount,
        TaxType: 'NONE',
        AccountCode: this.DEFAULT_ACCOUNTS.SALES,
      });
    }

    // Add tip as separate line item if applicable
    if (order.tipAmount && order.tipAmount > 0) {
      lineItems.push({
        Description: 'Tip',
        Quantity: 1,
        UnitAmount: order.tipAmount,
        LineAmount: order.tipAmount,
        TaxType: 'NONE',
        AccountCode: this.DEFAULT_ACCOUNTS.SALES,
      });
    }

    const invoice: XeroInvoice = {
      Type: 'ACCREC',
      Contact: {
        ContactID: contactId,
        Name: order.customerName || 'Cash Customer',
      },
      Date: order.createdAt.toISOString().split('T')[0],
      DueDate: order.createdAt.toISOString().split('T')[0], // Due immediately
      LineAmountTypes: 'Inclusive',
      LineItems: lineItems,
      Reference: `POS-${order.orderNumber}`,
      Status: 'AUTHORISED',
      CurrencyCode: 'GBP', // Default to GBP, should be configurable
    };

    return invoice;
  }

  /**
   * Get tax type based on tax rate
   */
  private getTaxType(taxRate?: number): string {
    if (!taxRate || taxRate === 0) {
      return 'NONE';
    }

    // Common UK VAT rates
    if (taxRate === 20) {
      return 'OUTPUT2'; // Standard VAT 20%
    }
    if (taxRate === 5) {
      return 'OUTPUT'; // Reduced VAT 5%
    }

    return 'NONE';
  }

  /**
   * Get payment account code based on payment method
   */
  private getPaymentAccountCode(paymentMethod: string): string {
    const accountMap: Record<string, string> = {
      cash: this.DEFAULT_ACCOUNTS.CASH,
      card: this.DEFAULT_ACCOUNTS.CARD,
      contactless: this.DEFAULT_ACCOUNTS.CARD,
      mobile: this.DEFAULT_ACCOUNTS.CARD,
      other: this.DEFAULT_ACCOUNTS.CASH,
    };

    return accountMap[paymentMethod] || this.DEFAULT_ACCOUNTS.CASH;
  }

  /**
   * Handle refunds by creating credit notes
   */
  public async createCreditNote(order: POSOrder, refundAmount?: number): Promise<string> {
    try {
      const mapping = (await this.getSalesMappings()).find((m) => m.posOrderId === order.id);

      if (!mapping?.xeroInvoiceId) {
        throw new Error('Original invoice not found in Xero');
      }

      // Create credit note
      const creditNote = {
        Type: 'ACCRECCREDIT',
        Contact: {
          ContactID: await this.getOrCreateCashCustomer(),
        },
        Date: new Date().toISOString().split('T')[0],
        LineAmountTypes: 'Inclusive',
        LineItems: [
          {
            Description: `Refund for Order ${order.orderNumber}`,
            Quantity: 1,
            UnitAmount: refundAmount || order.totalAmount,
            AccountCode: this.DEFAULT_ACCOUNTS.SALES,
          },
        ],
        Reference: `REFUND-${order.orderNumber}`,
        Status: 'AUTHORISED',
      };

      const response = await this.apiClient.makeRequest('/CreditNotes', {
        method: 'POST',
        body: { CreditNotes: [creditNote] },
      });

      if (!response.data.CreditNotes || response.data.CreditNotes.length === 0) {
        throw new Error('Failed to create credit note in Xero');
      }

      return response.data.CreditNotes[0].CreditNoteID!;
    } catch (error) {
      console.error('Failed to create credit note:', error);
      throw error;
    }
  }

  /**
   * Generate daily sales summary
   */
  public async generateDailySummary(date: Date): Promise<{
    totalSales: number;
    totalTax: number;
    totalTransactions: number;
    paymentBreakdown: Record<string, number>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // This would typically query the local POS database
    // For now, returning a mock summary structure
    return {
      totalSales: 0,
      totalTax: 0,
      totalTransactions: 0,
      paymentBreakdown: {
        cash: 0,
        card: 0,
        contactless: 0,
        mobile: 0,
      },
    };
  }

  /**
   * Get sales mappings from storage
   */
  private async getSalesMappings(): Promise<SalesMapping[]> {
    try {
      const mappingsJson = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${this.MAPPING_KEY}`);
      return mappingsJson ? JSON.parse(mappingsJson) : [];
    } catch (error) {
      console.error('Failed to get sales mappings:', error);
      return [];
    }
  }

  /**
   * Save sales mapping
   */
  private async saveSalesMapping(mapping: SalesMapping): Promise<void> {
    try {
      const mappings = await this.getSalesMappings();
      const existingIndex = mappings.findIndex((m) => m.posOrderId === mapping.posOrderId);

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
      console.error('Failed to save sales mapping:', error);
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
      console.error('Failed to get last sync time:', error);
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
      console.error('Failed to update last sync time:', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get sync statistics
   */
  public async getSyncStatistics(): Promise<{
    totalMappings: number;
    syncedOrders: number;
    failedOrders: number;
    pendingOrders: number;
    lastSyncTime: Date | null;
  }> {
    const mappings = await this.getSalesMappings();
    const lastSync = await this.getLastSyncTime();

    return {
      totalMappings: mappings.length,
      syncedOrders: mappings.filter((m) => m.syncStatus === 'synced').length,
      failedOrders: mappings.filter((m) => m.syncStatus === 'failed').length,
      pendingOrders: mappings.filter((m) => m.syncStatus === 'pending').length,
      lastSyncTime: lastSync,
    };
  }

  /**
   * Retry failed syncs
   */
  public async retryFailedSyncs(orders: POSOrder[]): Promise<SalesSyncResult> {
    const mappings = await this.getSalesMappings();
    const failedMappings = mappings.filter((m) => m.syncStatus === 'failed');

    const failedOrders = orders.filter((order) =>
      failedMappings.some((m) => m.posOrderId === order.id)
    );

    return this.syncOrdersToXero(failedOrders);
  }
}

export default XeroSalesSyncService;
