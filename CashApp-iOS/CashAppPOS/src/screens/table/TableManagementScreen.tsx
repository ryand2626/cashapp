import React, { useState, useEffect, _useMemo, useCallback, _memo } from 'react';

import type { GestureEvent, PanGestureHandlerGestureEvent } from 'react-native';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  PanGestureHandler,
  State,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// TODO: Unused import - import LazyLoadingWrapper from '../../components/performance/LazyLoadingWrapper';
// TODO: Unused import - import { TableSkeleton } from '../../components/performance/SkeletonLoader';
import { useTheme } from '../../design-system/ThemeProvider';
import { _usePerformanceMonitor, _performanceUtils } from '../../hooks/usePerformanceMonitor';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TablePosition {
  x: number;
  y: number;
}

interface Table {
  id: string;
  name: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_order';
  position: TablePosition;
  shape: 'round' | 'square' | 'rectangle';
  section: string;
  server?: string;
  width?: number;
  height?: number;
  rotation?: number;
  currentOrder?: {
    id: string;
    customerName: string;
    amount: number;
    timeSeated: Date;
  };
  reservations?: {
    time: Date;
    customerName: string;
    partySize: number;
  }[];
}

interface Section {
  id: string;
  name: string;
  color: string;
  tables: string[];
}

interface FloorPlanLayout {
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  zoom: number;
}

const TableManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [layout, setLayout] = useState<FloorPlanLayout>({
    canvasWidth: screenWidth * 1.5,
    canvasHeight: screenHeight * 1.2,
    gridSize: 30,
    zoom: 1,
  });

  // Sample data
  const sampleSections: Section[] = [
    { id: 'main', name: 'Main Dining', color: theme.colors.primary, tables: [] },
    { id: 'patio', name: 'Patio', color: theme.colors.secondary, tables: [] },
    { id: 'bar', name: 'Bar Area', color: theme.colors.warning, tables: [] },
    { id: 'private', name: 'Private Room', color: theme.colors.danger, tables: [] },
  ];

  const sampleTables: Table[] = [
    {
      id: 'table1',
      name: 'T1',
      seats: 4,
      status: 'occupied',
      position: { x: 50, y: 100 },
      shape: 'round',
      section: 'main',
      server: 'Sarah M.',
      width: 60,
      height: 60,
      rotation: 0,
      currentOrder: {
        id: 'order1',
        customerName: 'Johnson Family',
        amount: 45.5,
        timeSeated: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      },
    },
    {
      id: 'table2',
      name: 'T2',
      seats: 2,
      status: 'available',
      position: { x: 200, y: 100 },
      shape: 'square',
      section: 'main',
      width: 50,
      height: 50,
      rotation: 0,
    },
    {
      id: 'table3',
      name: 'T3',
      seats: 6,
      status: 'reserved',
      position: { x: 350, y: 100 },
      shape: 'rectangle',
      section: 'main',
      width: 90,
      height: 60,
      rotation: 0,
      reservations: [
        {
          time: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          customerName: 'Smith Party',
          partySize: 6,
        },
      ],
    },
    {
      id: 'table4',
      name: 'T4',
      seats: 8,
      status: 'occupied',
      position: { x: 50, y: 250 },
      shape: 'rectangle',
      section: 'main',
      server: 'Mike R.',
      width: 120,
      height: 60,
      rotation: 0,
      currentOrder: {
        id: 'order2',
        customerName: 'Corporate Lunch',
        amount: 120.75,
        timeSeated: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      },
    },
    {
      id: 'table5',
      name: 'P1',
      seats: 4,
      status: 'cleaning',
      position: { x: 100, y: 400 },
      shape: 'round',
      section: 'patio',
      width: 60,
      height: 60,
      rotation: 0,
    },
    {
      id: 'table6',
      name: 'B1',
      seats: 2,
      status: 'available',
      position: { x: 300, y: 450 },
      shape: 'square',
      section: 'bar',
      width: 50,
      height: 50,
      rotation: 0,
    },
  ];

  useEffect(() => {
    setTables(sampleTables);
    setSections(sampleSections);
  }, []);

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return theme.colors.success;
      case 'occupied':
        return theme.colors.danger;
      case 'reserved':
        return theme.colors.warning;
      case 'cleaning':
        return theme.colors.secondary;
      case 'out_of_order':
        return theme.colors.mediumGray;
      default:
        return theme.colors.lightGray;
    }
  };

  const getSectionColor = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    return section?.color || theme.colors.primary;
  };

  const getTableDimensions = (table: Table) => {
    // Use the table's stored dimensions if available, otherwise calculate
    if (table.width && table.height) {
      return { width: table.width, height: table.height };
    }

    const baseSize = 60;
    const seatMultiplier = Math.sqrt(table.seats / 4); // Scale based on seats

    switch (table.shape) {
      case 'round':
        return { width: baseSize * seatMultiplier, height: baseSize * seatMultiplier };
      case 'square':
        return { width: baseSize * seatMultiplier, height: baseSize * seatMultiplier };
      case 'rectangle':
        return { width: baseSize * seatMultiplier * 1.5, height: baseSize * seatMultiplier };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  const updateTableStatus = (tableId: string, newStatus: Table['status']) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === tableId
          ? {
              ...table,
              status: newStatus,
              currentOrder: newStatus === 'available' ? undefined : table.currentOrder,
            }
          : table
      )
    );
  };

  const _assignServer = (tableId: string, serverName: string) => {
    setTables((prev) =>
      prev.map((table) => (table.id === tableId ? { ...table, server: serverName } : table))
    );
  };

  const moveTable = (tableId: string, newPosition: TablePosition) => {
    setTables((prev) =>
      prev.map((table) => (table.id === tableId ? { ...table, position: newPosition } : table))
    );

    // In a real app, save to backend
    // saveTablePosition(tableId, newPosition);
  };

  const handleTableDrag = useCallback(
    (tableId: string, gestureState: unknown) => {
      if (!editMode) return;

      // Snap to grid
      const gridSize = layout.gridSize;
      const snappedX = Math.round(gestureState.x / gridSize) * gridSize;
      const snappedY = Math.round(gestureState.y / gridSize) * gridSize;

      // Ensure within bounds
      const maxX = layout.canvasWidth - 100;
      const maxY = layout.canvasHeight - 100;

      const newPosition = {
        x: Math.max(0, Math.min(snappedX, maxX)),
        y: Math.max(0, Math.min(snappedY, maxY)),
      };

      moveTable(tableId, newPosition);
    },
    [editMode, layout]
  );

  const saveLayout = () => {
    // Save the current layout to backend
    const layoutData = {
      tables: tables.map((table) => ({
        id: table.id,
        position: table.position,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
      })),
      layout,
    };

    logger.info('Saving layout:', layoutData);
    // In real app: await saveFloorPlanLayout(layoutData);

    Alert.alert('Layout Saved', 'Floor plan layout has been saved successfully.');
  };

  const addNewTable = (tableData: Partial<Table>) => {
    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: tableData.name || 'New Table',
      seats: tableData.seats || 4,
      status: 'available',
      position: tableData.position || { x: 100, y: 100 },
      shape: tableData.shape || 'round',
      section: tableData.section || 'main',
      width: tableData.width || 60,
      height: tableData.height || 60,
      rotation: tableData.rotation || 0,
    };

    setTables((prev) => [...prev, newTable]);
    setShowAddTableModal(false);
  };

  const mergeSelectedTables = () => {
    // For demo purposes, merge tables within the same section
    const tablesToMerge = tables.filter(
      (t) => t.status === 'available' && t.section === selectedSection
    );

    if (tablesToMerge.length < 2) {
      Alert.alert(
        'Merge Tables',
        'Select at least 2 available tables in the same section to merge.'
      );
      return;
    }

    Alert.alert('Merge Tables', `Merge ${tablesToMerge.length} tables into one?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Merge', onPress: () => performTableMerge(tablesToMerge) },
    ]);
  };

  const performTableMerge = (tablesToMerge: Table[]) => {
    const primaryTable = tablesToMerge[0];
    const totalSeats = tablesToMerge.reduce((sum, table) => sum + table.seats, 0);

    // Create merged table
    const mergedTable: Table = {
      ...primaryTable,
      name: `${primaryTable.name} (Merged)`,
      seats: totalSeats,
      status: 'reserved', // Mark as reserved during merge
      width: Math.max(...tablesToMerge.map((t) => t.width || 60)) + 20,
      height: Math.max(...tablesToMerge.map((t) => t.height || 60)) + 10,
    };

    // Remove old tables and add merged table
    const remainingTables = tables.filter((t) => !tablesToMerge.includes(t));
    setTables([...remainingTables, mergedTable]);

    Alert.alert('Success', `Tables merged successfully. New capacity: ${totalSeats} seats`);
  };

  const deleteTable = (tableId: string) => {
    Alert.alert('Delete Table', 'Are you sure you want to delete this table?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setTables((prev) => prev.filter((table) => table.id !== tableId));
          setShowTableModal(false);
        },
      },
    ]);
  };

  const getFilteredTables = () => {
    if (selectedSection === 'all') {
      return tables;
    }
    return tables.filter((table) => table.section === selectedSection);
  };

  const TableComponent = ({ table }: { table: Table }) => {
    const dimensions = getTableDimensions(table);
    const statusColor = getTableStatusColor(table.status);
    const sectionColor = getSectionColor(table.section);

    const handleGestureEvent = (event: GestureEvent<PanGestureHandlerGestureEvent>) => {
      if (!editMode) return;

      const { translationX, translationY } = event.nativeEvent;
      const newPosition = {
        x: table.position.x + translationX,
        y: table.position.y + translationY,
      };

      handleTableDrag(table.id, newPosition);
    };

    const tableContent = (
      <View
        style={[
          styles.table,
          {
            left: table.position.x,
            top: table.position.y,
            width: dimensions.width,
            height: dimensions.height,
            backgroundColor: statusColor,
            borderColor: sectionColor,
            borderRadius: table.shape === 'round' ? dimensions.width / 2 : 8,
            transform: [{ rotate: `${table.rotation || 0}deg` }],
            opacity: editMode && draggedTable?.id === table.id ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.tableName, { color: theme.colors.white }]}>{table.name}</Text>
        <Text style={[styles.tableSeats, { color: theme.colors.white }]}>{table.seats}</Text>
        {table.currentOrder && (
          <View style={[styles.orderIndicator, { backgroundColor: theme.colors.warning }]}>
            <Icon name="restaurant" size={12} color={theme.colors.white} />
          </View>
        )}
        {table.reservations && table.reservations.length > 0 && (
          <View style={[styles.reservationIndicator, { backgroundColor: theme.colors.secondary }]}>
            <Icon name="schedule" size={12} color={theme.colors.white} />
          </View>
        )}
        {editMode && (
          <View style={[styles.editIndicator, { backgroundColor: theme.colors.primary }]}>
            <Icon name="drag-indicator" size={16} color={theme.colors.white} />
          </View>
        )}
      </View>
    );

    if (editMode) {
      return (
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={(event) => {
            if (event.nativeEvent.state === State.BEGAN) {
              setDraggedTable(table);
            } else if (event.nativeEvent.state === State.END) {
              setDraggedTable(null);
            }
          }}
        >
          {tableContent}
        </PanGestureHandler>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTable(table);
          setShowTableModal(true);
        }}
      >
        {tableContent}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.white }]}>Dining Room</Text>
        <View style={styles.headerActions}>
          {editMode && (
            <TouchableOpacity style={styles.headerButton} onPress={saveLayout}>
              <Icon name="save" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          )}
          {editMode && (
            <TouchableOpacity style={styles.headerButton} onPress={mergeSelectedTables}>
              <Icon name="merge-type" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton} onPress={() => setEditMode(!editMode)}>
            <Icon name={editMode ? 'check' : 'edit'} size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowAddTableModal(true)}>
            <Icon name="add" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section Filter */}
      <View
        style={[
          styles.sectionFilter,
          { backgroundColor: theme.colors.white, borderBottomColor: theme.colors.border },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.sectionButton,
              { borderColor: theme.colors.primary, backgroundColor: theme.colors.white },
              selectedSection === 'all' && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => setSelectedSection('all')}
          >
            <Text
              style={[
                styles.sectionButtonText,
                { color: theme.colors.primary },
                selectedSection === 'all' && { color: theme.colors.white },
              ]}
            >
              All Sections
            </Text>
          </TouchableOpacity>

          {sections.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.sectionButton,
                { borderColor: section.color, backgroundColor: theme.colors.white },
                selectedSection === section.id && { backgroundColor: section.color },
              ]}
              onPress={() => setSelectedSection(section.id)}
            >
              <Text
                style={[
                  styles.sectionButtonText,
                  { color: section.color },
                  selectedSection === section.id && { color: theme.colors.white },
                ]}
              >
                {section.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Floor Plan */}
      <ScrollView
        style={styles.floorPlan}
        contentContainerStyle={[styles.floorPlanContent, { backgroundColor: theme.colors.white }]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!editMode}
        pinchGestureEnabled={true}
        maximumZoomScale={2}
        minimumZoomScale={0.5}
      >
        {/* Background Grid */}
        <View style={styles.gridBackground}>
          {[...Array(20)].map((_, i) => (
            <View
              key={`h-${i}`}
              style={[
                styles.gridLine,
                { top: i * layout.gridSize, backgroundColor: theme.colors.lightGray },
              ]}
            />
          ))}
          {[...Array(15)].map((_, i) => (
            <View
              key={`v-${i}`}
              style={[
                styles.gridLineVertical,
                { left: i * layout.gridSize, backgroundColor: theme.colors.lightGray },
              ]}
            />
          ))}
        </View>

        {/* Tables */}
        {getFilteredTables().map((table) => (
          <TableComponent key={table.id} table={table} />
        ))}

        {/* Legend */}
        <View
          style={[
            styles.legend,
            { backgroundColor: theme.colors.white, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.legendTitle, { color: theme.colors.text }]}>Status Legend</Text>
          <View style={styles.legendItems}>
            {[
              { status: 'available', label: 'Available' },
              { status: 'occupied', label: 'Occupied' },
              { status: 'reserved', label: 'Reserved' },
              { status: 'cleaning', label: 'Cleaning' },
              { status: 'out_of_order', label: 'Out of Order' },
            ].map((item) => (
              <View key={item.status} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: getTableStatusColor(item.status) },
                  ]}
                />
                <Text style={[styles.legendLabel, { color: theme.colors.text }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          {editMode && (
            <View style={styles.dragInstructionContainer}>
              <Text
                style={[
                  styles.legendLabel,
                  { color: theme.colors.textSecondary, fontStyle: 'italic' },
                ]}
              >
                Drag tables to move • Pinch to zoom
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Table Details Modal */}
      <Modal
        visible={showTableModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTable && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Table {selectedTable.name} Details</Text>
                  <TouchableOpacity onPress={() => setShowTableModal(false)}>
                    <Icon name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.tableInfoSection}>
                    <Text style={styles.sectionTitle}>Table Information</Text>
                    <Text style={styles.infoText}>Seats: {selectedTable.seats}</Text>
                    <Text style={styles.infoText}>Section: {selectedTable.section}</Text>
                    <Text style={styles.infoText}>Shape: {selectedTable.shape}</Text>
                    <Text
                      style={[
                        styles.infoText,
                        { color: getTableStatusColor(selectedTable.status) },
                      ]}
                    >
                      Status: {selectedTable.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>

                  {selectedTable.currentOrder && (
                    <View style={styles.tableInfoSection}>
                      <Text style={styles.sectionTitle}>Current Order</Text>
                      <Text style={styles.infoText}>
                        Customer: {selectedTable.currentOrder.customerName}
                      </Text>
                      <Text style={styles.infoText}>
                        Amount: £{selectedTable.currentOrder.amount.toFixed(2)}
                      </Text>
                      <Text style={styles.infoText}>
                        Seated: {selectedTable.currentOrder.timeSeated.toLocaleTimeString()}
                      </Text>
                      {selectedTable.server && (
                        <Text style={styles.infoText}>Server: {selectedTable.server}</Text>
                      )}
                    </View>
                  )}

                  {selectedTable.reservations && selectedTable.reservations.length > 0 && (
                    <View style={styles.tableInfoSection}>
                      <Text style={styles.sectionTitle}>Upcoming Reservations</Text>
                      {selectedTable.reservations.map((reservation, index) => (
                        <View key={index} style={styles.reservationItem}>
                          <Text style={styles.infoText}>
                            {reservation.time.toLocaleTimeString()} - {reservation.customerName}
                          </Text>
                          <Text style={styles.infoSubtext}>Party of {reservation.partySize}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.statusActions}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionButtons}>
                      {['available', 'occupied', 'reserved', 'cleaning', 'out_of_order'].map(
                        (status) => (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.statusButton,
                              { backgroundColor: getTableStatusColor(status) },
                              selectedTable.status === status && styles.statusButtonActive,
                            ]}
                            onPress={() =>
                              updateTableStatus(selectedTable.id, status as Table['status'])
                            }
                          >
                            <Text style={styles.statusButtonText}>{status.replace('_', ' ')}</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.deleteButton]}
                    onPress={() => deleteTable(selectedTable.id)}
                  >
                    <Icon name="delete" size={20} color={Colors.white} />
                    <Text style={styles.modalButtonText}>Delete Table</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.editButton]}
                    onPress={() => {
                      // Navigate to edit table details
                      Alert.alert('Edit Table', 'Table editing would open here');
                    }}
                  >
                    <Icon name="edit" size={20} color={Colors.white} />
                    <Text style={styles.modalButtonText}>Edit Details</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Table Modal */}
      <Modal
        visible={showAddTableModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Table</Text>
              <TouchableOpacity onPress={() => setShowAddTableModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Table Name</Text>
              <TextInput style={styles.textInput} placeholder="e.g., T10" defaultValue="" />

              <Text style={styles.inputLabel}>Number of Seats</Text>
              <TextInput
                style={styles.textInput}
                placeholder="4"
                keyboardType="numeric"
                defaultValue="4"
              />

              <Text style={styles.inputLabel}>Table Shape</Text>
              <View style={styles.shapeSelector}>
                {['round', 'square', 'rectangle'].map((shape) => (
                  <TouchableOpacity key={shape} style={styles.shapeOption}>
                    <Text style={styles.shapeOptionText}>{shape}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Section</Text>
              <View style={styles.sectionSelector}>
                {sections.map((section) => (
                  <TouchableOpacity
                    key={section.id}
                    style={[styles.sectionOption, { borderColor: section.color }]}
                  >
                    <Text style={styles.sectionOptionText}>{section.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddTableModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  addNewTable({
                    name: 'T' + (tables.length + 1),
                    seats: 4,
                    shape: 'round',
                    section: 'main',
                    position: { x: 100, y: 100 },
                  });
                }}
              >
                <Text style={styles.saveButtonText}>Add Table</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  sectionFilter: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionButtonActive: {
    // Dynamic styling applied inline
  },
  sectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionButtonTextActive: {
    // Dynamic styling applied inline
  },
  floorPlan: {
    flex: 1,
  },
  floorPlanContent: {
    width: screenWidth * 1.5,
    height: screenHeight * 1.2,
    position: 'relative',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    opacity: 0.3,
  },
  table: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tableSeats: {
    fontSize: 12,
    opacity: 0.9,
  },
  orderIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservationIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendLabel: {
    fontSize: 12,
  },
  dragInstructionContainer: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  tableInfoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
  },
  reservationItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  statusActions: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    // Dynamic styling applied inline
  },
  editButton: {
    // Dynamic styling applied inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  shapeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  shapeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  shapeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  sectionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    // Dynamic styling applied inline
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TableManagementScreen;
