/**
 * OrderService - Handle order persistence and management
 *
 * Features:
 * - Save orders to backend with customer metadata
 * - Retrieve orders with filtering and sorting
 * - Real-time order updates via WebSocket
 * - Email receipt generation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import API_CONFIG from '../config/api';

import type { Order, OrderItem } from '../types';
// TEMPORARY: WebSocketService import commented out until file is created
// import { webSocketService } from './websocket/WebSocketService';

export interface CustomerMetadata {
  name: string;
  email: string;
  phone?: string;
}

export interface OrderCreateRequest {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  serviceCharge?: number;
  transactionFee?: number;
  tipAmount?: number;
  customerMetadata: CustomerMetadata;
  tableNumber?: number;
  paymentMethod: string;
  paymentTransactionId?: string;
  paymentProvider?: string;
  notes?: string;
}

export interface OrderFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customerEmail?: string;
  paymentMethod?: string;
  limit?: number;
  offset?: number;
}

class OrderService {
  private static instance: OrderService;

  private constructor() {
    // WebSocket service is accessed as a singleton export
  }

  static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Save order to backend and emit WebSocket event
   */
  async saveOrder(orderData: OrderCreateRequest): Promise<Order> {
    try {
      logger.info('💾 Saving order to backend...', {
        items: orderData.items.length,
        total: orderData.total,
        customer: orderData.customerMetadata.email,
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: orderData.items,
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          total: orderData.total,
          service_charge: orderData.serviceCharge || 0,
          transaction_fee: orderData.transactionFee || 0,
          tip_amount: orderData.tipAmount || 0,
          customer_name: orderData.customerMetadata.name,
          customer_email: orderData.customerMetadata.email,
          customer_phone: orderData.customerMetadata.phone,
          table_number: orderData.tableNumber,
          payment_method: orderData.paymentMethod,
          payment_transaction_id: orderData.paymentTransactionId,
          payment_provider: orderData.paymentProvider,
          notes: orderData.notes,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save order: ${response.status} ${response.statusText}`);
      }

      const savedOrder = await response.json();
      logger.info('✅ Order saved successfully:', savedOrder.id);

      // Convert backend response to frontend Order format
      const order: Order = {
        id: savedOrder.id,
        items: orderData.items,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        customerId: savedOrder.customer_id,
        customerName: orderData.customerMetadata.name,
        customerEmail: orderData.customerMetadata.email,
        customerPhone: orderData.customerMetadata.phone,
        tableNumber: orderData.tableNumber,
        createdAt: new Date(savedOrder.created_at),
        status: savedOrder.status,
        paymentMethod: orderData.paymentMethod as unknown,
        paymentTransactionId: orderData.paymentTransactionId,
        paymentProvider: orderData.paymentProvider,
        serviceCharge: orderData.serviceCharge,
        transactionFee: orderData.transactionFee,
        tipAmount: orderData.tipAmount,
        notes: orderData.notes,
      };

      // Emit WebSocket event for real-time updates
      // TEMPORARY: WebSocket disabled until service is created
      // webSocketService.send({ type: 'order_created', data: order });

      // Save to local storage for offline access
      await this.cacheOrder(order);

      // Trigger email receipt if customer email provided
      if (orderData.customerMetadata.email) {
        await this.sendEmailReceipt(order);
      }

      return order;
    } catch (error) {
      logger.error('❌ Failed to save order:', error);

      // Fallback: Save to local storage for later sync
      const fallbackOrder: Order = {
        id: Date.now(), // Temporary ID
        items: orderData.items,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        customerName: orderData.customerMetadata.name,
        customerEmail: orderData.customerMetadata.email,
        customerPhone: orderData.customerMetadata.phone,
        tableNumber: orderData.tableNumber,
        createdAt: new Date(),
        status: 'confirmed',
        paymentMethod: orderData.paymentMethod as unknown,
        paymentTransactionId: orderData.paymentTransactionId,
        serviceCharge: orderData.serviceCharge,
        transactionFee: orderData.transactionFee,
        tipAmount: orderData.tipAmount,
        notes: orderData.notes,
      };

      await this.cacheOrder(fallbackOrder);
      await this.saveToSyncQueue(orderData);

      logger.info('💾 Order saved locally for later sync');
      return fallbackOrder;
    }
  }

  /**
   * Get orders with filtering
   */
  async getOrders(filters?: OrderFilters): Promise<Order[]> {
    try {
      logger.info('📋 Fetching orders...', filters);

      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.dateFrom) params.append('date_from', filters.dateFrom.toISOString());
      if (filters?.dateTo) params.append('date_to', filters.dateTo.toISOString());
      if (filters?.customerEmail) params.append('customer_email', filters.customerEmail);
      if (filters?.paymentMethod) params.append('payment_method', filters.paymentMethod);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/orders?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      const orders: Order[] = data.orders.map((o: unknown) => ({
        id: o.id,
        items: o.items || [],
        subtotal: o.subtotal,
        tax: o.tax,
        total: o.total,
        customerId: o.customer_id,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerPhone: o.customer_phone,
        tableNumber: o.table_number,
        createdAt: new Date(o.created_at),
        status: o.status,
        paymentMethod: o.payment_method,
        paymentTransactionId: o.payment_transaction_id,
        paymentProvider: o.payment_provider,
        serviceCharge: o.service_charge,
        transactionFee: o.transaction_fee,
        tipAmount: o.tip_amount,
        notes: o.notes,
      }));

      logger.info(`✅ Fetched ${orders.length} orders`);
      return orders;
    } catch (error) {
      logger.error('❌ Failed to fetch orders:', error);

      // Fallback to cached orders
      return await this.getCachedOrders();
    }
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch order: ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        items: data.items || [],
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        customerId: data.customer_id,
        customerName: data.customer_name,
        customerEmail: data.customer_email,
        customerPhone: data.customer_phone,
        tableNumber: data.table_number,
        createdAt: new Date(data.created_at),
        status: data.status,
        paymentMethod: data.payment_method,
        paymentTransactionId: data.payment_transaction_id,
        paymentProvider: data.payment_provider,
        serviceCharge: data.service_charge,
        transactionFee: data.transaction_fee,
        tipAmount: data.tip_amount,
        notes: data.notes,
      };
    } catch (error) {
      logger.error('❌ Failed to fetch order:', error);
      return null;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: number, status: string): Promise<Order | null> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order status: ${response.status}`);
      }

      const updatedOrder = await response.json();

      // Emit WebSocket event
      // TEMPORARY: WebSocket disabled until service is created
      // webSocketService.send({ type: 'order_updated', data: updatedOrder });

      return updatedOrder;
    } catch (error) {
      logger.error('❌ Failed to update order status:', error);
      return null;
    }
  }

  /**
   * Send email receipt
   */
  private async sendEmailReceipt(order: Order): Promise<void> {
    try {
      logger.info('📧 Sending email receipt to:', order.customerEmail);

      await fetch(`${API_CONFIG.BASE_URL}/api/v1/receipts/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: order.id,
          customer_email: order.customerEmail,
          customer_name: order.customerName,
        }),
      });

      logger.info('✅ Email receipt sent successfully');
    } catch (error) {
      logger.error('❌ Failed to send email receipt:', error);
    }
  }

  /**
   * Cache order locally
   */
  private async cacheOrder(order: Order): Promise<void> {
    try {
      const cachedOrders = await this.getCachedOrders();
      const updatedOrders = [order, ...cachedOrders.filter((o) => o.id !== order.id)];

      // Keep only last 100 orders in cache
      const trimmedOrders = updatedOrders.slice(0, 100);

      await AsyncStorage.setItem('cached_orders', JSON.stringify(trimmedOrders));
    } catch (error) {
      logger.error('❌ Failed to cache order:', error);
    }
  }

  /**
   * Get cached orders
   */
  private async getCachedOrders(): Promise<Order[]> {
    try {
      const cached = await AsyncStorage.getItem('cached_orders');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      logger.error('❌ Failed to get cached orders:', error);
      return [];
    }
  }

  /**
   * Save order to sync queue for later retry
   */
  private async saveToSyncQueue(orderData: OrderCreateRequest): Promise<void> {
    try {
      const queue = await AsyncStorage.getItem('order_sync_queue');
      const queueData = queue ? JSON.parse(queue) : [];

      queueData.push({
        ...orderData,
        timestamp: new Date().toISOString(),
      });

      await AsyncStorage.setItem('order_sync_queue', JSON.stringify(queueData));
    } catch (error) {
      logger.error('❌ Failed to save to sync queue:', error);
    }
  }

  /**
   * Process sync queue when connection is restored
   */
  async processSyncQueue(): Promise<void> {
    try {
      const queue = await AsyncStorage.getItem('order_sync_queue');
      if (!queue) return;

      const queueData = JSON.parse(queue);
      const processedIds: number[] = [];

      for (const orderData of queueData) {
        try {
          await this.saveOrder(orderData);
          processedIds.push(orderData.timestamp);
        } catch (error) {
          logger.error('❌ Failed to sync order:', error);
        }
      }

      // Remove successfully synced orders from queue
      const remainingQueue = queueData.filter(
        (item: unknown) => !processedIds.includes(item.timestamp)
      );

      await AsyncStorage.setItem('order_sync_queue', JSON.stringify(remainingQueue));
    } catch (error) {
      logger.error('❌ Failed to process sync queue:', error);
    }
  }

  /**
   * Subscribe to order events
   */
  subscribeToOrderEvents(_callback: (event: string, data: unknown) => void): () => void {
    // TEMPORARY: WebSocket disabled until service is created
    // const unsubscribeCreated = webSocketService.subscribe('order_created', (data) => {
    //   callback('order_created', data);
    // });

    // const unsubscribeUpdated = webSocketService.subscribe('order_updated', (data) => {
    //   callback('order_updated', data);
    // });

    return () => {
      // unsubscribeCreated();
      // unsubscribeUpdated();
    };
  }
}

export default OrderService;
