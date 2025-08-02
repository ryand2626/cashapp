interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  restaurantId?: string;
  restaurantName?: string;
  permissions: Permission[];
  createdAt: Date;
  lastLogin?: Date;
  loginAttempts: number;
  isLocked: boolean;
  profileImage?: string;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

interface CreateUserRequest {
  name: string;
  email: string;
  role: UserRole;
  restaurantId?: string;
  permissions: Permission[];
  phoneNumber?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  restaurantId?: string;
  permissions?: Permission[];
  status?: UserStatus;
  phoneNumber?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

type UserRole =
  | 'Platform Admin'
  | 'Restaurant Owner'
  | 'Restaurant Manager'
  | 'Restaurant Employee'
  | 'Kitchen Staff'
  | 'Cashier'
  | 'Support Agent';

type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

type Permission =
  | 'view_analytics'
  | 'manage_users'
  | 'manage_restaurants'
  | 'process_payments'
  | 'manage_inventory'
  | 'view_reports'
  | 'manage_menu'
  | 'manage_orders'
  | 'access_pos'
  | 'manage_settings'
  | 'view_logs'
  | 'export_data'
  | 'manage_tables'
  | 'view_kitchen_orders'
  | 'manage_staff_schedules';

interface AccessLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  location: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'suspicious';
  details?: string;
}

interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  applicableRoles: UserRole[];
}

interface BulkOperation {
  type: 'activate' | 'deactivate' | 'suspend' | 'delete' | 'change_role' | 'update_permissions';
  userIds: string[];
  data?: any;
}

interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days
  };
  loginSettings: {
    maxFailedAttempts: number;
    lockoutDuration: number; // minutes
    sessionTimeout: number; // minutes
    requireTwoFactor: boolean;
  };
  auditSettings: {
    retentionPeriod: number; // days
    logAllActions: boolean;
    alertOnSuspiciousActivity: boolean;
  };
}

class UserManagementService {
  private static instance: UserManagementService;
  private users: User[] = [];
  private accessLogs: AccessLog[] = [];
  private permissionTemplates: PermissionTemplate[] = [];
  private securitySettings: SecuritySettings;

  static getInstance(): UserManagementService {
    if (!UserManagementService.instance) {
      UserManagementService.instance = new UserManagementService();
    }
    return UserManagementService.instance;
  }

  constructor() {
    this.initializeMockData();
    this.initializePermissionTemplates();
    this.initializeSecuritySettings();
  }

  // User Management
  async getAllUsers(): Promise<User[]> {
    await this.simulateDelay(300);
    return this.users;
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    await this.simulateDelay(200);
    return this.users.filter((user) => user.role === role);
  }

  async getUsersByRestaurant(restaurantId: string): Promise<User[]> {
    await this.simulateDelay(200);
    return this.users.filter((user) => user.restaurantId === restaurantId);
  }

  async getUserById(userId: string): Promise<User | null> {
    await this.simulateDelay(100);
    return this.users.find((user) => user.id === userId) || null;
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    await this.simulateDelay(500);

    // Check if email already exists
    if (this.users.some((user) => user.email === userData.email)) {
      throw new Error('User with this email already exists');
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: 'pending',
      restaurantId: userData.restaurantId,
      restaurantName: userData.restaurantId
        ? this.getRestaurantName(userData.restaurantId)
        : undefined,
      permissions: userData.permissions,
      createdAt: new Date(),
      loginAttempts: 0,
      isLocked: false,
      phoneNumber: userData.phoneNumber,
      address: userData.address,
      emergencyContact: userData.emergencyContact,
    };

    this.users.push(newUser);

    // Log the creation
    await this.logAccess(newUser.id, newUser.email, 'User Created', 'System', 'success');

    return newUser;
  }

  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    await this.simulateDelay(400);

    const userIndex = this.users.findIndex((user) => user.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const user = this.users[userIndex];

    // Check if email change conflicts with existing user
    if (updates.email && updates.email !== user.email) {
      if (this.users.some((u) => u.email === updates.email && u.id !== userId)) {
        throw new Error('User with this email already exists');
      }
    }

    const updatedUser = {
      ...user,
      ...updates,
      restaurantName: updates.restaurantId
        ? this.getRestaurantName(updates.restaurantId)
        : user.restaurantName,
    };

    this.users[userIndex] = updatedUser;

    // Log the update
    await this.logAccess(userId, user.email, 'User Updated', 'System', 'success');

    return updatedUser;
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.simulateDelay(300);

    const userIndex = this.users.findIndex((user) => user.id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const user = this.users[userIndex];
    this.users.splice(userIndex, 1);

    // Log the deletion
    await this.logAccess(userId, user.email, 'User Deleted', 'System', 'success');

    return true;
  }

  async suspendUser(userId: string, reason?: string): Promise<User> {
    await this.simulateDelay(200);

    const user = await this.updateUser(userId, { status: 'suspended' });

    // Log the suspension
    await this.logAccess(
      userId,
      user.email,
      `User Suspended: ${reason || 'No reason provided'}`,
      'System',
      'success'
    );

    return user;
  }

  async activateUser(userId: string): Promise<User> {
    await this.simulateDelay(200);

    const user = await this.updateUser(userId, {
      status: 'active',
      isLocked: false,
      loginAttempts: 0,
    });

    // Log the activation
    await this.logAccess(userId, user.email, 'User Activated', 'System', 'success');

    return user;
  }

  // Permission Management
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.getUserById(userId);
    return user?.permissions || [];
  }

  async updateUserPermissions(userId: string, permissions: Permission[]): Promise<User> {
    return await this.updateUser(userId, { permissions });
  }

  async getPermissionTemplates(): Promise<PermissionTemplate[]> {
    await this.simulateDelay(100);
    return this.permissionTemplates;
  }

  async applyPermissionTemplate(userId: string, templateId: string): Promise<User> {
    const template = this.permissionTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error('Permission template not found');
    }

    return await this.updateUser(userId, { permissions: template.permissions });
  }

  // Access Logging
  async getAccessLogs(limit?: number): Promise<AccessLog[]> {
    await this.simulateDelay(200);
    const logs = this.accessLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }

  async getAccessLogsByUser(userId: string, limit?: number): Promise<AccessLog[]> {
    await this.simulateDelay(200);
    const logs = this.accessLogs
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }

  async logAccess(
    userId: string,
    userEmail: string,
    action: string,
    location: string,
    status: 'success' | 'failed' | 'suspicious',
    details?: string
  ): Promise<void> {
    const log: AccessLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userEmail,
      action,
      location,
      ipAddress: this.generateMockIP(),
      userAgent: 'Fynlo POS Mobile App',
      timestamp: new Date(),
      status,
      details,
    };

    this.accessLogs.push(log);

    // Keep only last 1000 logs
    if (this.accessLogs.length > 1000) {
      this.accessLogs = this.accessLogs.slice(-1000);
    }
  }

  // Bulk Operations
  async performBulkOperation(
    operation: BulkOperation
  ): Promise<{ success: string[]; failed: { userId: string; error: string }[] }> {
    await this.simulateDelay(1000);

    const results = {
      success: [] as string[],
      failed: [] as { userId: string; error: string }[],
    };

    for (const userId of operation.userIds) {
      try {
        switch (operation.type) {
          case 'activate':
            await this.activateUser(userId);
            break;
          case 'deactivate':
            await this.updateUser(userId, { status: 'inactive' });
            break;
          case 'suspend':
            await this.suspendUser(userId, 'Bulk operation');
            break;
          case 'delete':
            await this.deleteUser(userId);
            break;
          case 'change_role':
            await this.updateUser(userId, { role: operation.data.role });
            break;
          case 'update_permissions':
            await this.updateUser(userId, { permissions: operation.data.permissions });
            break;
        }
        results.success.push(userId);
      } catch (error) {
        results.failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // Security Settings
  async getSecuritySettings(): Promise<SecuritySettings> {
    await this.simulateDelay(100);
    return this.securitySettings;
  }

  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    await this.simulateDelay(300);
    this.securitySettings = { ...this.securitySettings, ...settings };
    return this.securitySettings;
  }

  // Export Functionality
  async exportUsers(format: 'csv' | 'json' | 'xlsx'): Promise<{ url: string; filename: string }> {
    await this.simulateDelay(2000);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fynlo-users-${timestamp}.${format}`;

    return {
      url: `https://api.fynlopos.com/exports/${filename}`,
      filename,
    };
  }

  async exportAccessLogs(
    format: 'csv' | 'json' | 'xlsx',
    startDate?: Date,
    endDate?: Date
  ): Promise<{ url: string; filename: string }> {
    await this.simulateDelay(2000);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fynlo-access-logs-${timestamp}.${format}`;

    return {
      url: `https://api.fynlopos.com/exports/${filename}`,
      filename,
    };
  }

  // Search and Filter
  async searchUsers(query: string): Promise<User[]> {
    await this.simulateDelay(200);

    const lowercaseQuery = query.toLowerCase();
    return this.users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowercaseQuery) ||
        user.email.toLowerCase().includes(lowercaseQuery) ||
        user.role.toLowerCase().includes(lowercaseQuery) ||
        (user.restaurantName && user.restaurantName.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Private helper methods
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRestaurantName(restaurantId: string): string {
    const restaurants: { [key: string]: string } = {
      '1': 'Fynlo Coffee Shop',
      '2': 'Fynlo Burger Bar',
      '3': 'Fynlo Pizza Palace',
      '4': 'Fynlo Taco Stand',
    };
    return restaurants[restaurantId] || 'Unknown Restaurant';
  }

  private generateMockIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(
      Math.random() * 255
    )}.${Math.floor(Math.random() * 255)}`;
  }

  private initializeMockData(): void {
    this.users = [
      {
        id: 'user-1',
        name: 'John Smith',
        email: 'john@fynlopos.com',
        role: 'Restaurant Owner',
        status: 'active',
        restaurantId: '1',
        restaurantName: 'Fynlo Coffee Shop',
        permissions: [
          'view_analytics',
          'manage_users',
          'manage_menu',
          'view_reports',
          'manage_settings',
        ],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        loginAttempts: 0,
        isLocked: false,
        phoneNumber: '+44 7700 900123',
        address: '123 High Street, London, UK',
      },
      {
        id: 'user-2',
        name: 'Emma Wilson',
        email: 'emma@pizza.fynlopos.com',
        role: 'Restaurant Owner',
        status: 'active',
        restaurantId: '3',
        restaurantName: 'Fynlo Pizza Palace',
        permissions: [
          'view_analytics',
          'manage_users',
          'manage_menu',
          'view_reports',
          'manage_settings',
        ],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
        loginAttempts: 0,
        isLocked: false,
        phoneNumber: '+44 7700 900456',
        address: '456 Pizza Street, Manchester, UK',
      },
      {
        id: 'user-3',
        name: 'David Brown',
        email: 'david@burgers.fynlopos.com',
        role: 'Restaurant Owner',
        status: 'inactive',
        restaurantId: '2',
        restaurantName: 'Fynlo Burger Bar',
        permissions: ['view_analytics', 'manage_users', 'manage_menu', 'view_reports'],
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        loginAttempts: 2,
        isLocked: false,
        phoneNumber: '+44 7700 900789',
        address: '789 Burger Lane, Birmingham, UK',
      },
      {
        id: 'user-4',
        name: 'Sarah Johnson',
        email: 'sarah@fynlopos.com',
        role: 'Restaurant Manager',
        status: 'active',
        restaurantId: '1',
        restaurantName: 'Fynlo Coffee Shop',
        permissions: ['manage_orders', 'access_pos', 'manage_tables', 'view_kitchen_orders'],
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 30 * 60 * 1000),
        loginAttempts: 0,
        isLocked: false,
        phoneNumber: '+44 7700 900321',
        address: '321 Manager Road, London, UK',
      },
      {
        id: 'user-5',
        name: 'Mike Davis',
        email: 'mike@fynlopos.com',
        role: 'Restaurant Employee',
        status: 'active',
        restaurantId: '1',
        restaurantName: 'Fynlo Coffee Shop',
        permissions: ['access_pos', 'process_payments'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
        loginAttempts: 0,
        isLocked: false,
        phoneNumber: '+44 7700 900654',
        address: '654 Employee Street, London, UK',
      },
    ];

    // Generate some access logs
    this.generateMockAccessLogs();
  }

  private generateMockAccessLogs(): void {
    const actions = [
      'Login',
      'Logout',
      'Failed Login',
      'Password Reset',
      'Permission Change',
      'Profile Update',
    ];
    const locations = [
      'London, UK',
      'Manchester, UK',
      'Birmingham, UK',
      'Liverpool, UK',
      'Leeds, UK',
    ];

    for (let i = 0; i < 50; i++) {
      const user = this.users[Math.floor(Math.random() * this.users.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const status =
        action === 'Failed Login' ? 'failed' : Math.random() > 0.95 ? 'suspicious' : 'success';

      this.accessLogs.push({
        id: `log-${Date.now()}-${i}`,
        userId: user.id,
        userEmail: user.email,
        action,
        location,
        ipAddress: this.generateMockIP(),
        userAgent: 'Fynlo POS Mobile App',
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        status,
        details: status === 'suspicious' ? 'Unusual login pattern detected' : undefined,
      });
    }
  }

  private initializePermissionTemplates(): void {
    this.permissionTemplates = [
      {
        id: 'template-1',
        name: 'Restaurant Owner',
        description: 'Full access to restaurant management and analytics',
        permissions: [
          'view_analytics',
          'manage_users',
          'manage_menu',
          'view_reports',
          'manage_settings',
          'export_data',
        ],
        applicableRoles: ['Restaurant Owner'],
      },
      {
        id: 'template-2',
        name: 'Restaurant Manager',
        description: 'Day-to-day operations management',
        permissions: [
          'manage_orders',
          'access_pos',
          'manage_tables',
          'view_kitchen_orders',
          'manage_staff_schedules',
        ],
        applicableRoles: ['Restaurant Manager'],
      },
      {
        id: 'template-3',
        name: 'Cashier',
        description: 'Point of sale operations',
        permissions: ['access_pos', 'process_payments'],
        applicableRoles: ['Restaurant Employee', 'Cashier'],
      },
      {
        id: 'template-4',
        name: 'Kitchen Staff',
        description: 'Kitchen operations and order management',
        permissions: ['view_kitchen_orders', 'manage_inventory'],
        applicableRoles: ['Kitchen Staff'],
      },
    ];
  }

  private initializeSecuritySettings(): void {
    this.securitySettings = {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        maxAge: 90,
      },
      loginSettings: {
        maxFailedAttempts: 5,
        lockoutDuration: 30,
        sessionTimeout: 120,
        requireTwoFactor: false,
      },
      auditSettings: {
        retentionPeriod: 365,
        logAllActions: true,
        alertOnSuspiciousActivity: true,
      },
    };
  }
}

export { UserManagementService };
export type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  UserStatus,
  Permission,
  AccessLog,
  PermissionTemplate,
  BulkOperation,
  SecuritySettings,
};
