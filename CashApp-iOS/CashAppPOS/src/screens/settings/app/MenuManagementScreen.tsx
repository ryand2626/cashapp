import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  _FlatList,
  Modal,
  ActivityIndicator,
  _Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import HeaderWithBackButton from '../../../components/navigation/HeaderWithBackButton';
import { useTheme } from '../../../design-system/ThemeProvider';
import DataService from '../../../services/DataService';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  featured: boolean;
  image?: string;
  allergens: string[];
  nutritionInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  modifiers: Modifier[];
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  required: boolean;
  options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  default: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  visible: boolean;
  items: MenuItem[];
}

const MenuManagementScreen: React.FC = () => {
  const _navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const dataService = DataService.getInstance();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [_refreshing, _setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Menu settings
  const [menuSettings, setMenuSettings] = useState({
    showDescriptions: true,
    showPrices: true,
    showAllergens: true,
    showNutrition: false,
    allowCustomItems: true,
    enableModifiers: true,
    showUnavailableItems: false,
    autoSort: true,
  });

  // Fetch categories and products on mount
  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      setLoading(true);

      // Fetch categories and products from API
      const [categoriesData, productsData] = await Promise.all([
        dataService.getCategories(),
        dataService.getProducts(),
      ]);

      // Transform data to match our interface
      const transformedCategories: Category[] = categoriesData.map((cat: unknown) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        order: cat.sort_order || 0,
        visible: cat.is_active !== false,
        items: productsData
          .filter((product: unknown) => product.category_id === cat.id)
          .map((product: unknown) => ({
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: product.price,
            category: cat.id,
            available: product.is_active !== false,
            featured: false, // We'll need to add this to backend
            allergens: product.dietary_info || [],
            modifiers: product.modifiers || [],
          })),
      }));

      setCategories(transformedCategories);

      // Set first category as selected if available
      if (transformedCategories.length > 0 && !selectedCategory) {
        setSelectedCategory(transformedCategories[0].id);
      }
    } catch (error) {
      logger.error('Failed to load menu data:', error);
      Alert.alert('Error', 'Failed to load menu data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory({
      id: '',
      name: '',
      description: '',
      order: categories.length + 1,
      visible: true,
      items: [],
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory?.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }

    try {
      setLoading(true);

      if (editingCategory.id) {
        // Update existing category
        await dataService.updateCategory(editingCategory.id, {
          name: editingCategory.name,
          description: editingCategory.description,
          sort_order: editingCategory.order,
          is_active: editingCategory.visible,
        });
      } else {
        // Add new category
        await dataService.createCategory({
          name: editingCategory.name,
          description: editingCategory.description,
          sort_order: editingCategory.order || categories.length + 1,
          color: '#00A651', // Default color
          icon: '🍽️', // Default icon
        });
      }

      // Reload data to get the updated list
      await loadMenuData();

      setShowCategoryModal(false);
      setEditingCategory(null);
      Alert.alert(
        'Success',
        `Category ${editingCategory.id ? 'updated' : 'created'} successfully!`
      );
    } catch (error) {
      logger.error('Failed to save category:', error);
      Alert.alert('Error', 'Failed to save category. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const _handleDeleteCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    Alert.alert(
      'Delete Category',
      `Delete "${category?.name}" and all ${category?.items.length} items in it?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await dataService.deleteCategory(categoryId);

              // Reload data
              await loadMenuData();

              // Update selected category if needed
              if (selectedCategory === categoryId && categories.length > 1) {
                const remainingCategories = categories.filter((c) => c.id !== categoryId);
                setSelectedCategory(remainingCategories[0]?.id || '');
              }

              Alert.alert('Success', 'Category deleted successfully!');
            } catch (error) {
              logger.error('Failed to delete category:', error);
              Alert.alert('Error', 'Failed to delete category. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAddItem = () => {
    setEditingItem({
      id: '',
      name: '',
      description: '',
      price: 0,
      category: selectedCategory,
      available: true,
      featured: false,
      allergens: [],
      modifiers: [],
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!editingItem?.name.trim()) {
      Alert.alert('Error', 'Item name is required.');
      return;
    }

    if (editingItem.price < 0) {
      Alert.alert('Error', 'Price must be a positive number.');
      return;
    }

    try {
      setLoading(true);

      if (editingItem.id) {
        // Update existing item
        await dataService.updateProduct(editingItem.id, {
          name: editingItem.name,
          description: editingItem.description,
          price: editingItem.price,
          category_id: editingItem.category,
          is_active: editingItem.available,
          dietary_info: editingItem.allergens,
          modifiers: editingItem.modifiers,
        });
      } else {
        // Add new item
        await dataService.createProduct({
          category_id: selectedCategory,
          name: editingItem.name,
          description: editingItem.description || '',
          price: editingItem.price,
          dietary_info: editingItem.allergens,
          modifiers: editingItem.modifiers,
        });
      }

      // Reload data to get the updated list
      await loadMenuData();

      setShowItemModal(false);
      setEditingItem(null);
      Alert.alert('Success', `Item ${editingItem.id ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      logger.error('Failed to save item:', error);
      Alert.alert('Error', 'Failed to save item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const item = categories.flatMap((c) => c.items).find((i) => i.id === itemId);

    Alert.alert('Delete Item', `Delete "${item?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await dataService.deleteProduct(itemId);

            // Reload data
            await loadMenuData();

            Alert.alert('Success', 'Item deleted successfully!');
          } catch (error) {
            logger.error('Failed to delete item:', error);
            Alert.alert('Error', 'Failed to delete item. Please try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const toggleItemAvailability = async (itemId: string) => {
    const item = categories.flatMap((c) => c.items).find((i) => i.id === itemId);

    if (!item) return;

    try {
      await dataService.updateProduct(itemId, {
        is_active: !item.available,
      });

      // Update local state for immediate feedback
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) => (i.id === itemId ? { ...i, available: !i.available } : i)),
        }))
      );
    } catch (error) {
      logger.error('Failed to toggle item availability:', error);
      Alert.alert('Error', 'Failed to update item availability.');
    }
  };

  const toggleItemFeatured = (itemId: string) => {
    // Featured is not implemented in backend yet, just update local state
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) =>
          item.id === itemId ? { ...item, featured: !item.featured } : item
        ),
      }))
    );
  };

  const _toggleCategoryVisibility = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);

    if (!category) return;

    try {
      await dataService.updateCategory(categoryId, {
        is_active: !category.visible,
      });

      // Update local state for immediate feedback
      setCategories((prev) =>
        prev.map((cat) => (cat.id === categoryId ? { ...cat, visible: !cat.visible } : cat))
      );
    } catch (error) {
      logger.error('Failed to toggle category visibility:', error);
      Alert.alert('Error', 'Failed to update category visibility.');
    }
  };

  const toggleMenuSetting = (setting: keyof typeof menuSettings) => {
    setMenuSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleImportMenu = async () => {
    try {
      // For now, show a simple CSV format example and allow manual paste
      Alert.alert(
        'Import Menu from CSV',
        'CSV Format Requirements:\n\n• Required columns: Category, Name, Price\n• Optional: Description\n• Use quotes for values with commas\n• Price must be a positive number\n\nExample:\nCategory,Name,Description,Price\nTacos,"Beef Taco, Supreme","Seasoned beef, fresh toppings",8.99\nBurritos,Bean Burrito,Refried beans and cheese,6.99',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              // Show input modal for CSV data
              Alert.prompt(
                'Paste CSV Data',
                'Paste your menu data in CSV format:',
                async (csvData) => {
                  if (csvData) {
                    await processCSVImport(csvData);
                  }
                },
                'plain-text',
                '',
                'default'
              );
            },
          },
          {
            text: 'Show Template',
            onPress: async () => {
              // Generate and share CSV template with examples
              const template = `Category,Name,Description,Price
Starters,"Nachos, Loaded","Tortilla chips with cheese, jalapeños, and salsa",7.99
Starters,Guacamole & Chips,Fresh avocado dip with crispy tortilla chips,6.50
Mains,"Chicken Fajitas, Sizzling","Grilled chicken with peppers, onions, tortillas",14.99
Mains,Vegetarian Burrito,"Black beans, rice, cheese, lettuce, salsa",9.99
Desserts,Churros,"Cinnamon sugar dusted, with chocolate sauce",5.99`;
              Alert.alert(
                'CSV Template',
                'Copy this template and modify with your menu items:\n\n' + template,
                [
                  { text: 'OK' },
                  { text: 'Copy Example', onPress: () => logger.info('Template:', template) },
                ]
              );
            },
          },
        ]
      );
    } catch (error) {
      logger.error('Import menu error:', error);
      Alert.alert('Error', 'Failed to import menu');
    }
  };

  // Robust CSV parser that handles quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Don't forget the last field
    result.push(current.trim());
    return result;
  };

  const processCSVImport = async (csvData: string) => {
    try {
      setLoading(true);

      // Parse CSV with proper handling of quoted fields
      const lines = csvData.trim().split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error('CSV must have headers and at least one data row');
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const categoryIndex = headers.indexOf('category');
      const nameIndex = headers.indexOf('name');
      const descriptionIndex = headers.indexOf('description');
      const priceIndex = headers.indexOf('price');

      if (categoryIndex === -1 || nameIndex === -1 || priceIndex === -1) {
        throw new Error('CSV must have Category, Name, and Price columns');
      }

      // Parse and validate data rows
      const itemsByCategory = new Map<string, any[]>();
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines

        const values = parseCSVLine(lines[i]);

        // Validate required fields
        const categoryName = values[categoryIndex]?.trim();
        const itemName = values[nameIndex]?.trim();
        const priceStr = values[priceIndex]?.trim();

        if (!categoryName) {
          errors.push(`Row ${i + 1}: Missing category name`);
          continue;
        }

        if (!itemName) {
          errors.push(`Row ${i + 1}: Missing item name`);
          continue;
        }

        if (!priceStr || isNaN(parseFloat(priceStr))) {
          errors.push(`Row ${i + 1}: Invalid price value`);
          continue;
        }

        const price = parseFloat(priceStr);
        if (price < 0) {
          errors.push(`Row ${i + 1}: Price cannot be negative`);
          continue;
        }

        const item = {
          name: itemName,
          description: values[descriptionIndex]?.trim() || '',
          price,
        };

        if (!itemsByCategory.has(categoryName)) {
          itemsByCategory.set(categoryName, []);
        }
        itemsByCategory.get(categoryName)!.push(item);
      }

      // Show validation errors if any
      if (errors.length > 0) {
        const errorMessage = errors.slice(0, 5).join('\n');
        const moreErrors = errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : '';
        Alert.alert(
          'CSV Validation Errors',
          `Found ${errors.length} validation errors:\n\n${errorMessage}${moreErrors}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue Anyway', onPress: () => {} },
          ]
        );
      }

      // Check if we have any valid items to import
      if (itemsByCategory.size === 0) {
        throw new Error('No valid items found to import');
      }

      // Create categories and products
      let successCount = 0;
      let errorCount = 0;
      const failedItems: string[] = [];

      for (const [categoryName, items] of itemsByCategory) {
        try {
          // Find or create category
          let category = categories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase()
          );

          if (!category) {
            // Create new category
            try {
              const newCategory = await dataService.createCategory({
                name: categoryName,
                description: `Imported ${categoryName} category`,
                is_active: true,
              });

              // Properly initialize the Category object with all required fields
              category = {
                id: newCategory.id,
                name: categoryName,
                description: newCategory.description || `Imported ${categoryName} category`,
                order: newCategory.sort_order || categories.length,
                visible: newCategory.is_active !== false,
                items: [], // Will be populated as we import items
              };

              // Add the new category to our local state
              setCategories((prev) => [...prev, category!]);
            } catch (catError) {
              logger.error(`Failed to create category ${categoryName}:`, catError);
              failedItems.push(
                `Category '${categoryName}': ${catError.message || 'Unknown error'}`
              );
              errorCount += items.length;
              continue;
            }
          }

          // Create products in this category
          for (const item of items) {
            try {
              // Additional validation before API call
              if (!item.name || item.name.length === 0) {
                throw new Error('Item name is required');
              }

              if (item.name.length > 200) {
                throw new Error('Item name is too long (max 200 characters)');
              }

              if (item.price === null || item.price === undefined || item.price < 0) {
                throw new Error('Invalid price');
              }

              await dataService.createProduct({
                category_id: category.id,
                name: item.name,
                description: item.description,
                price: item.price,
                dietary_info: [],
                modifiers: [],
              });
              successCount++;
            } catch (error: unknown) {
              logger.error(`Failed to create item ${item.name}:`, error);
              failedItems.push(`Item '${item.name}': ${error.message || 'Unknown error'}`);
              errorCount++;
            }
          }
        } catch (error: unknown) {
          logger.error(`Failed to process category ${categoryName}:`, error);
          failedItems.push(`Category '${categoryName}': ${error.message || 'Unknown error'}`);
          errorCount += items.length;
        }
      }

      // Reload menu data from backend to get properly structured categories with items
      // This ensures all Category objects have complete data including the items array
      await loadMenuData();

      // Provide detailed feedback
      let message = `Successfully imported ${successCount} items.`;

      if (errorCount > 0) {
        message += `\n\n${errorCount} items failed to import.`;

        if (failedItems.length > 0) {
          const failedDetails = failedItems.slice(0, 3).join('\n');
          const moreFailures =
            failedItems.length > 3 ? `\n...and ${failedItems.length - 3} more` : '';
          message += `\n\nFailed items:\n${failedDetails}${moreFailures}`;
        }
      }

      Alert.alert(errorCount > 0 ? 'Import Partially Complete' : 'Import Complete', message, [
        { text: 'OK' },
      ]);
    } catch (error: unknown) {
      Alert.alert('Import Error', error.message || 'Failed to process CSV data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMenu = async () => {
    try {
      setLoading(true);

      // Get current menu data
      const [categoriesData, productsData] = await Promise.all([
        dataService.getCategories(),
        dataService.getProducts(),
      ]);

      // Create export data structure
      const exportData = {
        version: '1.0',
        restaurant: 'Current Restaurant',
        exported_at: new Date().toISOString(),
        categories: categoriesData.map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          sort_order: cat.sort_order,
        })),
        products: productsData.map((prod) => ({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          price: prod.price,
          category_id: prod.category_id,
          is_active: prod.is_active,
        })),
        summary: {
          total_categories: categoriesData.length,
          total_products: productsData.length,
        },
      };

      Alert.alert(
        'Export Ready',
        `Menu exported with ${categoriesData.length} categories and ${productsData.length} products. Export data is prepared for download.`,
        [
          { text: 'OK' },
          {
            text: 'View Data',
            onPress: () => {
              logger.info('📋 Export Data:', JSON.stringify(exportData, null, 2));
              Alert.alert(
                'Export Data',
                'Export data logged to console for debugging. In production, this would download a file.'
              );
            },
          },
        ]
      );
    } catch (error) {
      logger.error('Export failed:', error);
      Alert.alert('Export Failed', 'Unable to export menu data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedCategoryItems = () => {
    const category = categories.find((c) => c.id === selectedCategory);
    if (!category) return [];

    let items = category.items;

    if (searchTerm) {
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (!menuSettings.showUnavailableItems) {
      items = items.filter((item) => item.available);
    }

    return items;
  };

  const getTotalItemCount = () => {
    return categories.reduce((total, cat) => total + cat.items.length, 0);
  };

  const getAvailableItemCount = () => {
    return categories.reduce(
      (total, cat) => total + cat.items.filter((item) => item.available).length,
      0
    );
  };

  const CategoryTab = ({ category }: { category: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryTab,
        selectedCategory === category.id && styles.selectedCategoryTab,
        !category.visible && styles.hiddenCategoryTab,
      ]}
      onPress={() => setSelectedCategory(category.id)}
      onLongPress={() => handleEditCategory(category)}
    >
      <Text
        style={[
          styles.categoryTabText,
          selectedCategory === category.id && styles.selectedCategoryTabText,
          !category.visible && styles.hiddenCategoryText,
        ]}
      >
        {category.name}
      </Text>
      <Text style={styles.categoryItemCount}>{category.items.length}</Text>
      {!category.visible && (
        <Icon name="visibility-off" size={16} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const ItemCard = ({ item }: { item: MenuItem }) => (
    <View style={[styles.itemCard, !item.available && styles.unavailableItem]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, !item.available && styles.unavailableText]}>
            {item.name}
          </Text>
          {item.featured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={12} color={theme.colors.surface} />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>
        <Text style={[styles.itemPrice, !item.available && styles.unavailableText]}>
          £{item.price.toFixed(2)}
        </Text>
      </View>

      {item.description && (
        <Text style={[styles.itemDescription, !item.available && styles.unavailableText]}>
          {item.description}
        </Text>
      )}

      {item.allergens.length > 0 && (
        <View style={styles.allergenContainer}>
          <Icon name="warning" size={16} color={theme.colors.warning} />
          <Text style={styles.allergenText}>Contains: {item.allergens.join(', ')}</Text>
        </View>
      )}

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.itemActionButton, styles.editButton]}
          onPress={() => handleEditItem(item)}
        >
          <Icon name="edit" size={16} color={theme.colors.secondary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.itemActionButton, styles.featuredButton]}
          onPress={() => toggleItemFeatured(item.id)}
        >
          <Icon
            name={item.featured ? 'star' : 'star-border'}
            size={16}
            color={item.featured ? theme.colors.warning : theme.colors.textSecondary}
          />
          <Text style={styles.featuredButtonText}>{item.featured ? 'Featured' : 'Feature'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.itemActionButton, styles.availabilityButton]}
          onPress={() => toggleItemAvailability(item.id)}
        >
          <Icon
            name={item.available ? 'visibility' : 'visibility-off'}
            size={16}
            color={item.available ? theme.colors.success : theme.colors.textSecondary}
          />
          <Text style={styles.availabilityButtonText}>
            {item.available ? 'Available' : 'Hidden'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.itemActionButton, styles.deleteButton]}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Icon name="delete" size={16} color={theme.colors.error} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <HeaderWithBackButton
        title="Menu Management"
        backgroundColor={theme.colors.primary}
        textColor={theme.colors.white}
        rightComponent={
          <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
            <Icon name="add" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading menu data...</Text>
        </View>
      )}

      {!loading && (
        <>
          {/* Stats Summary */}
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{categories.length}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{getTotalItemCount()}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{getAvailableItemCount()}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Icon name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search menu items..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Icon name="clear" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category Tabs */}
          <View style={styles.categorySection}>
            {categories.length === 0 && !loading ? (
              <View style={styles.emptyCategoriesState}>
                <Icon name="category" size={48} color={theme.colors.border} />
                <Text style={styles.emptyCategoriesTitle}>No Categories Yet</Text>
                <Text style={styles.emptyCategoriesText}>
                  Create your first category to start organizing your menu
                </Text>
                <TouchableOpacity style={styles.createCategoryButton} onPress={handleAddCategory}>
                  <Icon name="add" size={20} color={theme.colors.surface} />
                  <Text style={styles.createCategoryButtonText}>Create Category</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryTabs}
              >
                {categories.map((category) => (
                  <CategoryTab key={category.id} category={category} />
                ))}
                <TouchableOpacity style={styles.addCategoryTab} onPress={handleAddCategory}>
                  <Icon name="add" size={20} color={theme.colors.primary} />
                  <Text style={styles.addCategoryText}>Add Category</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>

          {/* Items List */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.itemsSection}>
              {getSelectedCategoryItems().map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}

              {getSelectedCategoryItems().length === 0 && (
                <View style={styles.emptyState}>
                  <Icon name="restaurant-menu" size={64} color={theme.colors.border} />
                  <Text style={styles.emptyStateTitle}>No Items Found</Text>
                  <Text style={styles.emptyStateText}>
                    {searchTerm
                      ? 'No items match your search criteria'
                      : 'Add items to this category to get started'}
                  </Text>
                  <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem}>
                    <Icon name="add" size={20} color={theme.colors.surface} />
                    <Text style={styles.addItemButtonText}>Add Item</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Menu Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Menu Display Settings</Text>
              <View style={styles.settingsCard}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show descriptions</Text>
                  <Switch
                    value={menuSettings.showDescriptions}
                    onValueChange={() => toggleMenuSetting('showDescriptions')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show prices</Text>
                  <Switch
                    value={menuSettings.showPrices}
                    onValueChange={() => toggleMenuSetting('showPrices')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show allergen information</Text>
                  <Switch
                    value={menuSettings.showAllergens}
                    onValueChange={() => toggleMenuSetting('showAllergens')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Enable modifiers</Text>
                  <Switch
                    value={menuSettings.enableModifiers}
                    onValueChange={() => toggleMenuSetting('enableModifiers')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Show unavailable items</Text>
                  <Switch
                    value={menuSettings.showUnavailableItems}
                    onValueChange={() => toggleMenuSetting('showUnavailableItems')}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Menu Actions</Text>
              <View style={styles.actionCard}>
                <TouchableOpacity style={styles.actionButton} onPress={handleImportMenu}>
                  <Icon name="file-upload" size={24} color={theme.colors.secondary} />
                  <Text style={styles.actionButtonText}>Import Menu</Text>
                  <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleExportMenu}>
                  <Icon name="file-download" size={24} color={theme.colors.secondary} />
                  <Text style={styles.actionButtonText}>Export Menu</Text>
                  <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Alert.alert('Info', 'Menu templates would be available here')}
                >
                  <Icon name="library-books" size={24} color={theme.colors.success} />
                  <Text style={styles.actionButtonText}>Browse Templates</Text>
                  <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Item Edit Modal */}
          <Modal
            visible={showItemModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowItemModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingItem?.id ? 'Edit Item' : 'Add New Item'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowItemModal(false)}>
                    <Icon name="close" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.inputLabel}>Item Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingItem?.name || ''}
                    onChangeText={(text) =>
                      setEditingItem((prev) => (prev ? { ...prev, name: text } : null))
                    }
                    placeholder="Enter item name"
                  />

                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={editingItem?.description || ''}
                    onChangeText={(text) =>
                      setEditingItem((prev) => (prev ? { ...prev, description: text } : null))
                    }
                    placeholder="Enter item description"
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.inputLabel}>Price (£) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingItem?.price?.toString() || ''}
                    onChangeText={(text) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, price: parseFloat(text) || 0 } : null
                      )
                    }
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />

                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() =>
                        setEditingItem((prev) =>
                          prev ? { ...prev, available: !prev.available } : null
                        )
                      }
                    >
                      <Icon
                        name={editingItem?.available ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.checkboxLabel}>Available</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() =>
                        setEditingItem((prev) =>
                          prev ? { ...prev, featured: !prev.featured } : null
                        )
                      }
                    >
                      <Icon
                        name={editingItem?.featured ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.checkboxLabel}>Featured</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowItemModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveItem}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Category Edit Modal */}
          <Modal
            visible={showCategoryModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCategoryModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingCategory?.id ? 'Edit Category' : 'Add New Category'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                    <Icon name="close" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.inputLabel}>Category Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingCategory?.name || ''}
                    onChangeText={(text) =>
                      setEditingCategory((prev) => (prev ? { ...prev, name: text } : null))
                    }
                    placeholder="Enter category name"
                  />

                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editingCategory?.description || ''}
                    onChangeText={(text) =>
                      setEditingCategory((prev) => (prev ? { ...prev, description: text } : null))
                    }
                    placeholder="Enter category description"
                  />

                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() =>
                        setEditingCategory((prev) =>
                          prev ? { ...prev, visible: !prev.visible } : null
                        )
                      }
                    >
                      <Icon
                        name={editingCategory?.visible ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.checkboxLabel}>Visible in menu</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowCategoryModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveCategory}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    addButton: {
      padding: 8,
      marginRight: 8,
    },
    statsSection: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 16,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    searchSection: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    categorySection: {
      backgroundColor: theme.colors.surface,
      paddingBottom: 8,
    },
    categoryTabs: {
      paddingHorizontal: 16,
    },
    categoryTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    selectedCategoryTab: {
      backgroundColor: theme.colors.primary,
    },
    hiddenCategoryTab: {
      opacity: 0.6,
    },
    categoryTabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    selectedCategoryTabText: {
      color: theme.colors.white,
    },
    hiddenCategoryText: {
      color: theme.colors.textSecondary,
    },
    categoryItemCount: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 20,
      textAlign: 'center',
    },
    addCategoryTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
    },
    addCategoryText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.primary,
    },
    content: {
      flex: 1,
    },
    itemsSection: {
      backgroundColor: theme.colors.surface,
      marginVertical: 8,
      paddingVertical: 16,
    },
    itemCard: {
      backgroundColor: theme.colors.background,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unavailableItem: {
      opacity: 0.6,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    itemInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    unavailableText: {
      color: theme.colors.textSecondary,
    },
    featuredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.warning,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      gap: 2,
    },
    featuredText: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.colors.surface,
    },
    itemPrice: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    itemDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      lineHeight: 20,
    },
    allergenContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 4,
    },
    allergenText: {
      fontSize: 12,
      color: theme.colors.warning,
      flex: 1,
    },
    itemActions: {
      flexDirection: 'row',
      gap: 8,
    },
    itemActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 6,
      gap: 4,
    },
    editButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.secondary,
    },
    featuredButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    featuredButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.warning,
    },
    availabilityButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    availabilityButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.success,
    },
    deleteButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    deleteButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.error,
    },
    emptyCategoriesState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 32,
    },
    emptyCategoriesTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    emptyCategoriesText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    createCategoryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    createCategoryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.surface,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 32,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      gap: 8,
    },
    addItemButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.surface,
    },
    section: {
      backgroundColor: theme.colors.surface,
      marginVertical: 8,
      paddingVertical: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    settingsCard: {
      paddingHorizontal: 16,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    actionCard: {
      paddingHorizontal: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      width: '90%',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    modalBody: {
      padding: 16,
      maxHeight: 400,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 8,
      marginTop: 16,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    checkboxRow: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 24,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxLabel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.white,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
  });

export default MenuManagementScreen;
