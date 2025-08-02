import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { InventoryState, InventoryItem, InventoryLedgerEntry } from '../types';
// import { fetchAllInventoryItems, fetchInventoryLedger } from '../services/ApiService'; // To be created or updated

// Define the store interface including actions
interface InventoryStore extends InventoryState {
  // Actions
  setInventoryItems: (items: InventoryItem[]) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  updateMultipleInventoryItems: (items: InventoryItem[]) => void;
  addLedgerEntry: (entry: InventoryLedgerEntry) => void;
  setLedgerEntries: (entries: InventoryLedgerEntry[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setLowStockThreshold: (threshold: number) => void;

  // Async actions (thunks)
  loadInitialInventory: () => Promise<void>;

  // Selectors / Computed values might be added here or in components using the store
  getLowStockItems: () => InventoryItem[];
  getOutOfStockItems: () => InventoryItem[];
}

const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      inventoryItems: {},
      inventoryLedger: [],
      isLoadingInventory: false,
      inventoryError: null,
      lowStockThreshold: 0.1, // Default 10%

      // --- Synchronous Actions ---
      setInventoryItems: (items) => {
        const itemsBySku: { [sku: string]: InventoryItem } = {};
        items.forEach((item) => {
          itemsBySku[item.sku] = item;
        });
        set({ inventoryItems: itemsBySku, isLoadingInventory: false, inventoryError: null });
      },

      updateInventoryItem: (item) =>
        set((state) => ({
          inventoryItems: {
            ...state.inventoryItems,
            [item.sku]: item,
          },
          isLoadingInventory: false,
        })),

      updateMultipleInventoryItems: (items) =>
        set((state) => {
          const updatedItems = { ...state.inventoryItems };
          items.forEach((item) => {
            updatedItems[item.sku] = item;
          });
          return { inventoryItems: updatedItems, isLoadingInventory: false };
        }),

      addLedgerEntry: (entry) =>
        set((state) => ({
          // Add to start for chronological order (newest first) if desired, or sort later
          inventoryLedger: [entry, ...state.inventoryLedger],
        })),

      setLedgerEntries: (entries) =>
        set({
          inventoryLedger: entries.sort(
            (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
          ), // Sort newest first
        }),

      setLoading: (isLoading) => set({ isLoadingInventory: isLoading }),
      setError: (error) => set({ inventoryError: error, isLoadingInventory: false }),
      setLowStockThreshold: (threshold) => set({ lowStockThreshold: threshold }),

      // --- Asynchronous Actions (Thunks) ---
      loadInitialInventory: async () => {
        // This is a placeholder for where you'd call your ApiService
        // For now, it just sets loading state.
        // In a real app, you would:
        // set({ isLoadingInventory: true, inventoryError: null });
        // try {
        //   const items = await fetchAllInventoryItems(); // From ApiService
        //   const ledger = await fetchInventoryLedger(); // From ApiService
        //   get().setInventoryItems(items);
        //   get().setLedgerEntries(ledger);
        // } catch (e) {
        //   const errorMsg = e instanceof Error ? e.message : "Failed to load inventory data";
        //   get().setError(errorMsg);
        //   logger.error("Error loading initial inventory:", errorMsg);
        // } finally {
        //  set({ isLoadingInventory: false });
        // }
        logger.info('loadInitialInventory called - placeholder implementation');
        set({ isLoadingInventory: true });
        // Simulate API call
        setTimeout(() => {
          // const mockItems = [{ sku: 'FLOUR_001', name: 'Plain Flour', qty_g: 5000, par_level_g:10000, unit:'g', last_updated: new Date().toISOString() }];
          // get().setInventoryItems(mockItems);
          set({ isLoadingInventory: false });
        }, 1000);
      },

      // --- Selectors / Computed Values ---
      getLowStockItems: () => {
        const { inventoryItems, lowStockThreshold } = get();
        return Object.values(inventoryItems).filter(
          (item) =>
            item.par_level_g &&
            item.par_level_g > 0 &&
            item.qty_g / item.par_level_g <= lowStockThreshold &&
            item.qty_g > 0
        );
      },
      getOutOfStockItems: () => {
        const { inventoryItems } = get();
        return Object.values(inventoryItems).filter((item) => item.qty_g <= 0);
      },
    }),
    {
      name: 'cashapp-inventory-storage', // Unique name for AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist what's necessary, or omit to persist everything
        inventoryItems: state.inventoryItems,
        lowStockThreshold: state.lowStockThreshold,
        // inventoryLedger might become very large, consider if it should be persisted
        // or always fetched. For now, not persisting ledger.
      }),
    }
  )
);

// Hook to initialize store or load data on app start if needed
export const useInitializeInventoryStore = () => {
  const _loadInitialInventory = useInventoryStore((state) => state.loadInitialInventory);
  // React.useEffect(() => {
  //   loadInitialInventory();
  // }, [loadInitialInventory]);
  // Call this from your App.tsx or a similar top-level component
};

export default useInventoryStore;
