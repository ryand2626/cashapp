import AsyncStorage from '@react-native-async-storage/async-storage';

import XeroApiClient from './XeroApiClient';

export interface ItemSyncOptions {
  direction: 'to_xero' | 'from_xero' | 'bidirectional';
  batchSize?: number;
  syncInventory?: boolean;
  conflictResolution?: 'xero_wins' | 'pos_wins' | 'latest_wins' | 'manual';
}

export interface ItemSyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsFailed: number;
  errors: ItemSyncError[];
  duration: number;
}

export interface ItemSyncError {
  entityId: string;
  entityType: 'item';
  operation: 'create' | 'update' | 'delete';
  error: string;
  data?: any;
}

export interface POSMenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  taxRate?: number;
  taxType?: string;
  isActive: boolean;
  isInventoryTracked: boolean;
  stockQuantity?: number;
  unitOfMeasure?: string;
  createdAt: Date;
  updatedAt: Date;
  xeroItemId?: string;
}

export interface XeroItem {
  ItemID?: string;
  Code?: string;
  Name: string;
  Description?: string;
  UnitPrice?: number;
  TaxType?: string;
  IsSold?: boolean;
  IsPurchased?: boolean;
  IsTrackedAsInventory?: boolean;
  InventoryAssetAccountCode?: string;
  COGSAccountCode?: string;
  SalesAccountCode?: string;
  PurchaseAccountCode?: string;
  QuantityOnHand?: number;
  TotalCostPool?: number;
  UpdatedDateUTC?: string;
  PurchaseDescription?: string;
  PurchasePrice?: number;
}

export interface ItemMapping {
  posItemId: string;
  xeroItemId: string;
  lastSyncedAt: Date;
  syncDirection: 'to_xero' | 'from_xero';
  conflictResolution?: string;
}

export interface CategoryMapping {
  posCategory: string;
  xeroAccountCode: string;
  lastSyncedAt: Date;
}

export class XeroItemsSyncService {
  private static instance: XeroItemsSyncService;
  private apiClient: XeroApiClient;
  private readonly STORAGE_PREFIX = 'xero_items_sync_';
  private readonly MAPPING_KEY = 'item_mappings';
  private readonly CATEGORY_MAPPING_KEY = 'category_mappings';
  private readonly LAST_SYNC_KEY = 'last_items_sync';

  // Default Xero account codes for different item types
  private readonly DEFAULT_ACCOUNTS = {
    SALES: '200', // Sales Revenue
    COGS: '310', // Cost of Goods Sold
    INVENTORY: '630', // Inventory Asset
    PURCHASE: '300', // Purchases
  };

  private constructor() {
    this.apiClient = XeroApiClient.getInstance();
  }

  public static getInstance(): XeroItemsSyncService {
    if (!XeroItemsSyncService.instance) {
      XeroItemsSyncService.instance = new XeroItemsSyncService();
    }
    return XeroItemsSyncService.instance;
  }

  /**
   * Sync menu items to Xero (POS -> Xero)
   */
  public async syncItemsToXero(
    items: POSMenuItem[],
    options: ItemSyncOptions = { direction: 'to_xero' }
  ): Promise<ItemSyncResult> {
    const startTime = Date.now();
    const result: ItemSyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const mappings = await this.getItemMappings();
      const categoryMappings = await this.getCategoryMappings();
      const batchSize = options.batchSize || 10;

      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        for (const item of batch) {
          try {
            result.recordsProcessed++;

            const existingMapping = mappings.find((m) => m.posItemId === item.id);

            if (existingMapping && existingMapping.xeroItemId) {
              // Update existing item
              await this.updateXeroItem(item, existingMapping.xeroItemId, categoryMappings);
              result.recordsUpdated++;
            } else {
              // Create new item
              const xeroItemId = await this.createXeroItem(item, categoryMappings);
              result.recordsCreated++;

              // Save mapping
              await this.saveItemMapping({
                posItemId: item.id,
                xeroItemId,
                lastSyncedAt: new Date(),
                syncDirection: 'to_xero',
              });
            }
          } catch (error) {
            console.error(`Failed to sync item ${item.id}:`, error);
            result.recordsFailed++;
            result.errors.push({
              entityId: item.id,
              entityType: 'item',
              operation: existingMapping ? 'update' : 'create',
              error: error instanceof Error ? error.message : 'Unknown error',
              data: item,
            });
          }
        }

        // Add delay between batches to respect rate limits
        if (i + batchSize < items.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      await this.updateLastSyncTime();
      result.success = result.recordsFailed === 0;
    } catch (error) {
      console.error('Items sync to Xero failed:', error);
      result.success = false;
      result.errors.push({
        entityId: 'batch',
        entityType: 'item',
        operation: 'create',
        error: error instanceof Error ? error.message : 'Batch sync failed',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync items from Xero (Xero -> POS)
   */
  public async syncItemsFromXero(
    options: ItemSyncOptions = { direction: 'from_xero' }
  ): Promise<{ result: ItemSyncResult; items: POSMenuItem[] }> {
    const startTime = Date.now();
    const result: ItemSyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };
    const items: POSMenuItem[] = [];

    try {
      const lastSync = await this.getLastSyncTime();
      const mappings = await this.getItemMappings();

      // Build where clause for modified items
      let whereClause = 'IsSold==true';
      if (lastSync) {
        const isoDate = lastSync.toISOString();
        whereClause += ` AND UpdatedDateUTC>DateTime(${isoDate})`;
      }

      // Fetch items from Xero
      const xeroResponse = await this.apiClient.getItems({
        where: whereClause,
        order: 'UpdatedDateUTC DESC',
      });

      const xeroItems = xeroResponse.Items || [];
      result.recordsProcessed = xeroItems.length;

      for (const xeroItem of xeroItems) {
        try {
          const existingMapping = mappings.find((m) => m.xeroItemId === xeroItem.ItemID);
          const posItem = this.transformXeroItemToPOSMenuItem(xeroItem, existingMapping?.posItemId);

          items.push(posItem);

          if (existingMapping) {
            result.recordsUpdated++;
          } else {
            result.recordsCreated++;

            // Save new mapping
            await this.saveItemMapping({
              posItemId: posItem.id,
              xeroItemId: xeroItem.ItemID!,
              lastSyncedAt: new Date(),
              syncDirection: 'from_xero',
            });
          }
        } catch (error) {
          console.error(`Failed to process Xero item ${xeroItem.ItemID}:`, error);
          result.recordsFailed++;
          result.errors.push({
            entityId: xeroItem.ItemID || 'unknown',
            entityType: 'item',
            operation: 'create',
            error: error instanceof Error ? error.message : 'Transform failed',
            data: xeroItem,
          });
        }
      }

      await this.updateLastSyncTime();
      result.success = result.recordsFailed === 0;
    } catch (error) {
      console.error('Items sync from Xero failed:', error);
      result.success = false;
      result.errors.push({
        entityId: 'batch',
        entityType: 'item',
        operation: 'create',
        error: error instanceof Error ? error.message : 'Batch sync failed',
      });
    }

    result.duration = Date.now() - startTime;
    return { result, items };
  }

  /**
   * Create new item in Xero
   */
  private async createXeroItem(
    item: POSMenuItem,
    categoryMappings: CategoryMapping[]
  ): Promise<string> {
    const xeroItem = this.transformPOSMenuItemToXeroItem(item, categoryMappings);

    const response = await this.apiClient.makeRequest('/Items', {
      method: 'POST',
      body: { Items: [xeroItem] },
    });

    if (!response.data.Items || response.data.Items.length === 0) {
      throw new Error('Failed to create item in Xero');
    }

    return response.data.Items[0].ItemID!;
  }

  /**
   * Update existing item in Xero
   */
  private async updateXeroItem(
    item: POSMenuItem,
    xeroItemId: string,
    categoryMappings: CategoryMapping[]
  ): Promise<void> {
    const xeroItem = this.transformPOSMenuItemToXeroItem(item, categoryMappings);
    xeroItem.ItemID = xeroItemId;

    await this.apiClient.makeRequest(`/Items/${xeroItemId}`, {
      method: 'POST',
      body: { Items: [xeroItem] },
    });
  }

  /**
   * Transform POS menu item to Xero item format
   */
  private transformPOSMenuItemToXeroItem(
    item: POSMenuItem,
    categoryMappings: CategoryMapping[]
  ): XeroItem {
    const categoryMapping = categoryMappings.find((cm) => cm.posCategory === item.category);

    const xeroItem: XeroItem = {
      Code: item.sku || item.id,
      Name: item.name,
      Description: item.description,
      UnitPrice: item.price,
      TaxType: this.mapTaxType(item.taxType, item.taxRate),
      IsSold: true,
      IsPurchased: true,
      IsTrackedAsInventory: item.isInventoryTracked,
    };

    // Set account codes based on category mapping or defaults
    if (categoryMapping) {
      xeroItem.SalesAccountCode = categoryMapping.xeroAccountCode;
    } else {
      xeroItem.SalesAccountCode = this.DEFAULT_ACCOUNTS.SALES;
    }

    // Set additional account codes for inventory tracking
    if (item.isInventoryTracked) {
      xeroItem.InventoryAssetAccountCode = this.DEFAULT_ACCOUNTS.INVENTORY;
      xeroItem.COGSAccountCode = this.DEFAULT_ACCOUNTS.COGS;
      xeroItem.PurchaseAccountCode = this.DEFAULT_ACCOUNTS.PURCHASE;

      if (item.stockQuantity !== undefined) {
        xeroItem.QuantityOnHand = item.stockQuantity;
      }

      if (item.cost !== undefined) {
        xeroItem.PurchasePrice = item.cost;
        xeroItem.TotalCostPool = item.cost * (item.stockQuantity || 0);
      }
    }

    return xeroItem;
  }

  /**
   * Transform Xero item to POS menu item format
   */
  private transformXeroItemToPOSMenuItem(xeroItem: XeroItem, existingId?: string): POSMenuItem {
    const item: POSMenuItem = {
      id: existingId || this.generateItemId(),
      name: xeroItem.Name,
      description: xeroItem.Description,
      category: this.mapXeroAccountToCategory(xeroItem.SalesAccountCode),
      price: xeroItem.UnitPrice || 0,
      cost: xeroItem.PurchasePrice,
      sku: xeroItem.Code,
      taxType: xeroItem.TaxType,
      isActive: true, // Xero doesn't have explicit active/inactive
      isInventoryTracked: xeroItem.IsTrackedAsInventory || false,
      stockQuantity: xeroItem.QuantityOnHand,
      unitOfMeasure: 'each', // Default unit
      createdAt: new Date(),
      updatedAt: new Date(xeroItem.UpdatedDateUTC || Date.now()),
      xeroItemId: xeroItem.ItemID,
    };

    return item;
  }

  /**
   * Map POS tax type to Xero tax type
   */
  private mapTaxType(taxType?: string, taxRate?: number): string {
    if (!taxType && !taxRate) {
      return 'NONE';
    }

    // Common UK VAT rates
    if (taxRate === 20) {
      return 'OUTPUT2'; // Standard VAT 20%
    }
    if (taxRate === 5) {
      return 'OUTPUT'; // Reduced VAT 5%
    }
    if (taxRate === 0) {
      return 'ZERORATEDOUTPUT'; // Zero-rated VAT
    }

    // Return the tax type as is if provided
    return taxType || 'NONE';
  }

  /**
   * Map Xero account code to POS category
   */
  private mapXeroAccountToCategory(accountCode?: string): string {
    const categoryMap: Record<string, string> = {
      '200': 'Food',
      '260': 'Beverages',
      '270': 'Alcohol',
      '280': 'Desserts',
    };

    return categoryMap[accountCode || ''] || 'General';
  }

  /**
   * Get item mappings from storage
   */
  private async getItemMappings(): Promise<ItemMapping[]> {
    try {
      const mappingsJson = await AsyncStorage.getItem(`${this.STORAGE_PREFIX}${this.MAPPING_KEY}`);
      return mappingsJson ? JSON.parse(mappingsJson) : [];
    } catch (error) {
      console.error('Failed to get item mappings:', error);
      return [];
    }
  }

  /**
   * Save item mapping
   */
  private async saveItemMapping(mapping: ItemMapping): Promise<void> {
    try {
      const mappings = await this.getItemMappings();
      const existingIndex = mappings.findIndex((m) => m.posItemId === mapping.posItemId);

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
      console.error('Failed to save item mapping:', error);
      throw error;
    }
  }

  /**
   * Get category mappings from storage
   */
  private async getCategoryMappings(): Promise<CategoryMapping[]> {
    try {
      const mappingsJson = await AsyncStorage.getItem(
        `${this.STORAGE_PREFIX}${this.CATEGORY_MAPPING_KEY}`
      );
      return mappingsJson ? JSON.parse(mappingsJson) : [];
    } catch (error) {
      console.error('Failed to get category mappings:', error);
      return [];
    }
  }

  /**
   * Save category mapping
   */
  public async saveCategoryMapping(mapping: CategoryMapping): Promise<void> {
    try {
      const mappings = await this.getCategoryMappings();
      const existingIndex = mappings.findIndex((m) => m.posCategory === mapping.posCategory);

      if (existingIndex >= 0) {
        mappings[existingIndex] = mapping;
      } else {
        mappings.push(mapping);
      }

      await AsyncStorage.setItem(
        `${this.STORAGE_PREFIX}${this.CATEGORY_MAPPING_KEY}`,
        JSON.stringify(mappings)
      );
    } catch (error) {
      console.error('Failed to save category mapping:', error);
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
   * Generate unique item ID
   */
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate item data
   */
  public validateItemData(item: POSMenuItem): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!item.name || item.name.trim().length === 0) {
      errors.push('Item name is required');
    }

    if (item.price < 0) {
      errors.push('Price cannot be negative');
    }

    if (item.isInventoryTracked && (item.stockQuantity === undefined || item.stockQuantity < 0)) {
      errors.push('Stock quantity must be specified for tracked items');
    }

    if (item.taxRate !== undefined && (item.taxRate < 0 || item.taxRate > 100)) {
      errors.push('Tax rate must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get available Xero accounts for category mapping
   */
  public async getXeroAccounts(): Promise<any[]> {
    try {
      const response = await this.apiClient.makeRequest('/Accounts');
      return response.data.Accounts || [];
    } catch (error) {
      console.error('Failed to fetch Xero accounts:', error);
      return [];
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
    categoryMappings: number;
    lastSyncTime: Date | null;
    pendingSync: number;
  }> {
    const mappings = await this.getItemMappings();
    const categoryMappings = await this.getCategoryMappings();
    const lastSync = await this.getLastSyncTime();

    return {
      totalMappings: mappings.length,
      categoryMappings: categoryMappings.length,
      lastSyncTime: lastSync,
      pendingSync: 0, // Would need to calculate based on local changes
    };
  }

  /**
   * Bulk update inventory levels in Xero
   */
  public async updateInventoryLevels(
    inventoryUpdates: { itemId: string; quantity: number; cost?: number }[]
  ): Promise<ItemSyncResult> {
    const startTime = Date.now();
    const result: ItemSyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const mappings = await this.getItemMappings();

      for (const update of inventoryUpdates) {
        try {
          result.recordsProcessed++;

          const mapping = mappings.find((m) => m.posItemId === update.itemId);
          if (!mapping) {
            throw new Error('Item not mapped to Xero');
          }

          const xeroItem: Partial<XeroItem> = {
            ItemID: mapping.xeroItemId,
            QuantityOnHand: update.quantity,
          };

          if (update.cost !== undefined) {
            xeroItem.PurchasePrice = update.cost;
            xeroItem.TotalCostPool = update.cost * update.quantity;
          }

          await this.apiClient.makeRequest(`/Items/${mapping.xeroItemId}`, {
            method: 'POST',
            body: { Items: [xeroItem] },
          });

          result.recordsUpdated++;
        } catch (error) {
          console.error(`Failed to update inventory for item ${update.itemId}:`, error);
          result.recordsFailed++;
          result.errors.push({
            entityId: update.itemId,
            entityType: 'item',
            operation: 'update',
            error: error instanceof Error ? error.message : 'Unknown error',
            data: update,
          });
        }
      }

      result.success = result.recordsFailed === 0;
    } catch (error) {
      console.error('Bulk inventory update failed:', error);
      result.success = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export default XeroItemsSyncService;
