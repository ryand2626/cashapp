import { create } from 'zustand';

import type { UIState } from '../types';

interface UIStore extends UIState {
  // Category actions
  setSelectedCategory: (category: string) => void;

  // Modal actions
  setShowPaymentModal: (show: boolean) => void;

  // Offline indicator
  setShowOfflineIndicator: (show: boolean) => void;

  // Theme actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const useUIStore = create<UIStore>((set, get) => ({
  // Initial state
  selectedCategory: 'All',
  showPaymentModal: false,
  showOfflineIndicator: false,
  theme: 'light',

  // Category actions
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  // Modal actions
  setShowPaymentModal: (showPaymentModal) => set({ showPaymentModal }),

  // Offline indicator
  setShowOfflineIndicator: (showOfflineIndicator) => set({ showOfflineIndicator }),

  // Theme actions
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
}));

export default useUIStore;
