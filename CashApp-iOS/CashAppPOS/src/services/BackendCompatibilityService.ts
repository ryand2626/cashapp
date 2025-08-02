/**
 * Backend Compatibility Service
 *
 * TEMPORARY service to handle mismatches between frontend expectations
 * and current backend responses. This allows the app to function while
 * waiting for backend deployment to complete.
 *
 * TODO: Remove this service once backend is fully deployed with correct data structures
 */

// TODO: Unused import - import { OrderItem } from '../types';

import type { MenuItem } from '../types';

interface BackendMenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string; // Backend sends emoji in 'image' field
  icon?: string;
  // 'available' field is MISSING from current backend
}

interface BackendEmployee {
  id: number;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
  totalSales: number;
  performanceScore: number;
  isActive: boolean;
  // Missing fields that frontend expects
}

export class BackendCompatibilityService {
  /**
   * Transform backend menu items to match frontend expectations
   */
  static transformMenuItem(backendItem: BackendMenuItem): MenuItem {
    return {
      id: backendItem.id,
      name: backendItem.name,
      price: backendItem.price,
      category: backendItem.category,
      description: backendItem.description,
      // Map 'image' field to 'emoji' if it contains emoji
      emoji: backendItem.image || '🍴',
      image: undefined, // Clear image field since it contains emoji
      icon: backendItem.icon || 'restaurant',
      // CRITICAL: Add missing 'available' field - default to true
      available: true,
      barcode: undefined,
    };
  }

  /**
   * Transform backend employee data to match frontend expectations
   */
  static transformEmployee(backendEmployee: BackendEmployee): unknown {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const _sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

    return {
      ...backendEmployee,
      // Add missing required fields with sensible defaults
      hireDate: oneYearAgo.toISOString(),
      startDate: oneYearAgo.toISOString(),
      phone: '+44 7700 900000', // Default UK phone
      totalOrders: Math.floor(backendEmployee.totalSales / 50), // Estimate
      avgOrderValue:
        backendEmployee.totalSales > 0
          ? (backendEmployee.totalSales / Math.floor(backendEmployee.totalSales / 50)).toFixed(2)
          : 0,
      hoursWorked: backendEmployee.role === 'manager' ? 1680 : 1120, // Full-time vs part-time
    };
  }

  /**
   * Transform menu items array
   */
  static transformMenuItems(backendItems: BackendMenuItem[]): MenuItem[] {
    return backendItems.map((item) => this.transformMenuItem(item));
  }

  /**
   * Transform employees array
   */
  static transformEmployees(backendEmployees: BackendEmployee[]): unknown[] {
    return backendEmployees.map((emp) => this.transformEmployee(emp));
  }

  /**
   * Check if backend response needs transformation
   */
  static needsMenuTransformation(items: unknown[]): boolean {
    if (!items || items.length === 0) return false;

    // Check if first item has 'available' field
    const firstItem = items[0];
    return firstItem && typeof firstItem.available === 'undefined';
  }

  /**
   * Check if employee data needs transformation
   */
  static needsEmployeeTransformation(employees: unknown[]): boolean {
    if (!employees || employees.length === 0) return false;

    // Check if first employee has 'hireDate' field
    const firstEmployee = employees[0];
    return firstEmployee && typeof firstEmployee.hireDate === 'undefined';
  }
}

export default BackendCompatibilityService;
