/**
 * React hook for WebSocket real-time updates
 */

import { useEffect, useCallback, useState } from 'react';

import { webSocketService } from '../services/websocket/EnhancedWebSocketService';
import { useAuthStore } from '../store/useAuthStore';
import { WebSocketEvent } from '../types/websocket';

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempt: number;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { user } = useAuthStore();
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempt: 0,
  });

  // Handle connection
  const connect = useCallback(async () => {
    if (!user?.restaurant_id) {
      console.warn('⚠️ Cannot connect WebSocket - no restaurant ID');
      return;
    }

    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      await webSocketService.connect({
        reconnect: options.reconnect !== false,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: error as Error,
      }));
    }
  }, [user?.restaurant_id, options.reconnect]);

  // Handle disconnection
  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  // Subscribe to events
  const subscribe = useCallback((eventType: string, handler: (data: unknown) => void) => {
    webSocketService.on(eventType, handler);

    // Return unsubscribe function
    return () => {
      webSocketService.off(eventType, handler);
    };
  }, []);

  // Send message
  const send = useCallback((type: string, data: unknown) => {
    webSocketService.send({ type, data });
  }, []);

  // Set up WebSocket event listeners
  useEffect(() => {
    const handleConnected = () => {
      setState((prev) => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempt: 0,
      }));
    };

    const handleDisconnected = () => {
      setState((prev) => ({
        ...prev,
        connected: false,
        connecting: false,
      }));
    };

    const handleError = (error: Error) => {
      setState((prev) => ({
        ...prev,
        error,
        connecting: false,
      }));
    };

    const _handleReconnecting = (data: { attempt: number; maxAttempts: number }) => {
      setState((prev) => ({
        ...prev,
        connecting: true,
        reconnectAttempt: data.attempt,
      }));
    };

    // Subscribe to connection events
    webSocketService.on(WebSocketEvent.CONNECT, handleConnected);
    webSocketService.on(WebSocketEvent.DISCONNECT, handleDisconnected);
    webSocketService.on(WebSocketEvent.ERROR, handleError);
    // Note: EnhancedWebSocketService doesn't emit a 'reconnecting' event
    // It only emits 'max_reconnect_attempts' when max attempts are reached

    // Cleanup
    return () => {
      webSocketService.off(WebSocketEvent.CONNECT, handleConnected);
      webSocketService.off(WebSocketEvent.DISCONNECT, handleDisconnected);
      webSocketService.off(WebSocketEvent.ERROR, handleError);
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (
      options.autoConnect !== false &&
      user?.restaurant_id &&
      !state.connected &&
      !state.connecting
    ) {
      connect();
    }

    // Disconnect on unmount
    return () => {
      // Use webSocketService.isConnected() to get current connection state
      // instead of potentially stale state.connected
      if (webSocketService.isConnected()) {
        disconnect();
      }
    };
  }, [options.autoConnect, user?.restaurant_id, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    send,
    isConnected: webSocketService.isConnected(),
  };
};

// Export specific event hooks for common use cases

export const useOrderUpdates = (onOrderUpdate: (data: unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribeCreated = subscribe(WebSocketEvent.ORDER_CREATED, onOrderUpdate);
    const unsubscribeUpdated = subscribe(WebSocketEvent.ORDER_UPDATED, onOrderUpdate);
    const unsubscribeStatus = subscribe(WebSocketEvent.ORDER_STATUS_CHANGED, onOrderUpdate);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeStatus();
    };
  }, [subscribe, onOrderUpdate]);
};

export const useInventoryUpdates = (onInventoryUpdate: (data: unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.INVENTORY_UPDATED, onInventoryUpdate);
    return unsubscribe;
  }, [subscribe, onInventoryUpdate]);
};

export const useMenuUpdates = (onMenuUpdate: (data: unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.MENU_UPDATED, onMenuUpdate);
    return unsubscribe;
  }, [subscribe, onMenuUpdate]);
};

export const useSystemNotifications = (onNotification: (data: unknown) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(WebSocketEvent.SYSTEM_NOTIFICATION, onNotification);
    return unsubscribe;
  }, [subscribe, onNotification]);
};
