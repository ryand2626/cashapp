// Temporary WebSocket types until @fynlo/shared is properly set up

export interface WebSocketMessage {
  id: string;
  type: string;
  data?: any;
  restaurant_id: string;
  timestamp: string;
}

export interface WebSocketConfig {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  pongTimeout?: number;
  authTimeout?: number;
}

export enum WebSocketEvent {
  // Connection events
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  ERROR = 'ERROR',
  RECONNECTING = 'RECONNECTING',

  // Authentication events
  AUTHENTICATE = 'AUTHENTICATE',
  AUTHENTICATED = 'AUTHENTICATED',
  AUTH_ERROR = 'AUTH_ERROR',

  // Heartbeat events
  PING = 'PING',
  PONG = 'PONG',

  // Business events
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  INVENTORY_UPDATED = 'INVENTORY_UPDATED',
  MENU_UPDATED = 'MENU_UPDATED',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
}
