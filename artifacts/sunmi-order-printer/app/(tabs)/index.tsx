import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Modal, TextInput, AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient, focusManager } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useColors } from '../../hooks/useColors';
import { StatusBadge } from '../../components/StatusBadge';
import { Order } from '../../lib/types';
import { startAlert, stopAlert } from '../../lib/sound';
import { printOrder } from '../../lib/printer';

export default function OrdersScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'preparing' | 'ready' | 'out_for_delivery'>('pending');
  const [reprintModalVisible, setReprintModalVisible] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  useEffect(() => {
    if (orders?.some(o => o.status === 'pending')) {
      startAlert();
    } else {
      stopAlert();
    }
  }, [orders]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      Alert.alert('خطأ', err.message);
      const stillPending = queryClient.getQueryData<Order[]>(['orders'])?.some(o => o.status === 'pending');
      if (stillPending) startAlert();
    }
  });

  const handleAcceptOrder = async (order: Order) => {
    stopAlert(); // optimistically stop
    updateStatus.mutate({ id: order.id, status: 'preparing' }, {
      onSuccess: () => {
        const anotherPending = queryClient.getQueryData<Order[]>(['orders'])
          ?.some((candidate) => candidate.id !== order.id && candidate.status === 'pending');
        if (anotherPending) startAlert();
      }
    });
  };

  const handleManualPrintConfirm = async () => {
    if (!reprintReason.trim()) {
      Alert.alert('تنبيه', 'يجب إدخال سبب إعادة الطباعة');
      return;
    }
    setReprintModalVisible(false);
    if (reprintOrder) {
      const success = await printOrder(reprintOrder, reprintReason);
      if (!success) {
        Alert.alert('تنبيه', 'فشلت الطباعة اليدوية، يرجى التحقق من الطابعة.');
      }
      setReprintReason('');
      setReprintOrder(null);
    }
  };

  const filteredOrders = orders?.filter(o => o.status === filter) || [];

  const filters = [
    { id: 'pending', label: 'جديد' },
    { id: 'preparing', label: 'تحضير' },
    { id: 'ready', label: 'جاهز' },
    { id: 'out_for_delivery', label: 'توصيل' },
  ] as const;

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.orderNumber, { color: colors.foreground }]}>#{item.dailyNumber}</Text>
          <Text style={[styles.orderType, { color: colors.mutedForeground }]}>
            {item.orderType === 'delivery' ? 'توصيل' : 'استلام'} - {item.paymentMethod === 'cash' ? 'نقدي' : 'دفع إلكتروني'}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      
      <View style={styles.customerInfo}>
        <Text style={[styles.customerName, { color: colors.foreground }]}>{item.customerName}</Text>
        <Text style={[styles.customerPhone, { color: colors.mutedForeground }]}>{item.customerPhone}</Text>
        {item.customerAddress && (
          <Text style={[styles.customerAddress, { color: colors.mutedForeground }]}>{item.customerAddress}</Text>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.itemsList}>
        {item.items.map(i => (
          <View key={i.id} style={styles.itemRow}>
            <Text style={[styles.itemQty, { color: colors.primary }]}>{i.quantity}x</Text>
            <Text style={[styles.itemName, { color: colors.foreground }]}>{i.name}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.actions}>
        {item.status === 'pending' && (
          <>
            <Pressable 
              style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={() => handleAcceptOrder(item)}
              testID={`btn-accept-${item.id}`}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>قبول</Text>
            </Pressable>
            <Pressable 
              style={[styles.btn, styles.btnDanger, { backgroundColor: colors.destructive }]}
              onPress={() => updateStatus.mutate({ id: item.id, status: 'cancelled' })}
            >
              <Text style={[styles.btnText, { color: colors.destructiveForeground }]}>رفض</Text>
            </Pressable>
          </>
        )}

        {item.status === 'preparing' && (
          <>
            <Pressable 
              style={[styles.btn, styles.btnSuccess, { backgroundColor: colors.success }]}
              onPress={() => updateStatus.mutate({ id: item.id, status: 'ready' })}
            >
              <Text style={[styles.btnText, { color: colors.successForeground }]}>جاهز</Text>
            </Pressable>
          </>
        )}

        {item.status === 'ready' && item.orderType !== 'delivery' && (
          <Pressable 
            style={[styles.btn, styles.btnSuccess, { backgroundColor: colors.success }]}
            onPress={() => updateStatus.mutate({ id: item.id, status: 'done' })}
          >
            <Text style={[styles.btnText, { color: colors.successForeground }]}>تسليم للعميل</Text>
          </Pressable>
        )}
        
        {item.status === 'out_for_delivery' && (
          <Pressable 
            style={[styles.btn, styles.btnSuccess, { backgroundColor: colors.success }]}
            onPress={() => updateStatus.mutate({ id: item.id, status: 'done' })}
          >
            <Text style={[styles.btnText, { color: colors.successForeground }]}>تأكيد التوصيل</Text>
          </Pressable>
        )}

        <Pressable 
          style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.secondary }]}
          onPress={() => {
            setReprintOrder(item);
            setReprintModalVisible(true);
          }}
        >
          <Text style={[styles.btnText, { color: colors.secondaryForeground }]}>طباعة</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {filters.map(f => (
          <Pressable
            key={f.id}
            style={[
              styles.filterTab,
              filter === f.id && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
            ]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[
              styles.filterText,
              { color: filter === f.id ? colors.primary : colors.mutedForeground }
            ]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>حدث خطأ في تحميل الطلبات</Text>
          <Pressable style={[styles.btn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={() => refetch()}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد طلبات في هذا القسم</Text>
            </View>
          }
        />
      )}

      {/* Reprint Reason Modal */}
      <Modal visible={reprintModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>سبب إعادة الطباعة</Text>
            
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="مثال: الورق نفذ، تعديل طلب..."
              placeholderTextColor={colors.mutedForeground}
              value={reprintReason}
              onChangeText={setReprintReason}
            />
            
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 16 }}>
              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleManualPrintConfirm}
              >
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>تأكيد وطباعة</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  setReprintModalVisible(false);
                  setReprintReason('');
                  setReprintOrder(null);
                }}
              >
                <Text style={[styles.btnText, { color: colors.secondaryForeground }]}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { flexDirection: 'row-reverse', borderBottomWidth: 1 },
  filterTab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  filterText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, gap: 16 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderNumber: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  orderType: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 4 },
  customerInfo: { marginBottom: 12 },
  customerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  customerPhone: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  customerAddress: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1, marginVertical: 12 },
  itemsList: { gap: 8 },
  itemRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  itemQty: { fontSize: 18, fontFamily: 'Inter_700Bold', minWidth: 32, textAlign: 'left' },
  itemName: { fontSize: 16, fontFamily: 'Inter_500Medium', flex: 1 },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  btnPrimary: { flex: 2 },
  btnSecondary: { flex: 1 },
  btnSuccess: { flex: 2 },
  btnDanger: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 18, fontFamily: 'Inter_500Medium' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'right' },
});
