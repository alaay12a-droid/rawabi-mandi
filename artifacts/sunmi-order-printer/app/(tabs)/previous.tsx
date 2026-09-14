import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert, Modal, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useColors } from '../../hooks/useColors';
import { StatusBadge } from '../../components/StatusBadge';
import { printOrder } from '../../lib/printer';
import { formatMoney } from '../../lib/format';
import type { Order } from '../../lib/types';

export default function PreviousOrdersScreen() {
  const colors = useColors();
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  
  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ['previous_orders'],
    queryFn: api.getPreviousOrders,
  });

  const handleManualPrint = async () => {
    if (!reprintOrder || !reason.trim()) {
      Alert.alert('سبب مطلوب', 'اكتب سبب إعادة الطباعة قبل المتابعة.');
      return;
    }
    const success = await printOrder(reprintOrder, reason.trim());
    if (!success) {
      Alert.alert('تنبيه', 'فشلت الطباعة اليدوية، يرجى التحقق من الطابعة.');
      return;
    }
    setReprintOrder(null);
    setReason('');
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.orderNumber, { color: colors.foreground }]}>#{item.dailyNumber}</Text>
          <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
            {new Date(item.createdAt).toLocaleString('ar-SA', { hour: 'numeric', minute: 'numeric' })}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      
      <View style={styles.detailsRow}>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{item.customerName}</Text>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{formatMoney(item.totalPrice)}</Text>
      </View>
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      
      <Pressable 
        style={[styles.btn, { backgroundColor: colors.secondary }]}
        onPress={() => setReprintOrder(item)}
        testID={`previous-reprint-${item.id}`}
      >
        <Text style={[styles.btnText, { color: colors.secondaryForeground }]}>طباعة الإيصال</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>حدث خطأ في تحميل الطلبات السابقة</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد طلبات سابقة اليوم</Text>
            </View>
          }
        />
      )}
      <Modal visible={Boolean(reprintOrder)} transparent animationType="fade" onRequestClose={() => setReprintOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>إعادة طباعة الإيصال</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="اكتب سبب إعادة الطباعة"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.reasonInput, { color: colors.foreground, borderColor: colors.border }]}
              testID="previous-reprint-reason"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleManualPrint} testID="previous-reprint-confirm">
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>تأكيد الطباعة</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.secondary }]} onPress={() => setReprintOrder(null)}>
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
  list: { padding: 16, gap: 16 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderNumber: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  orderDate: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  detailsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  detailText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1, marginVertical: 16 },
  btn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 18, fontFamily: 'Inter_500Medium' }
  ,modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }
  ,modalCard: { borderRadius: 16, padding: 20 }
  ,modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'right', marginBottom: 16 }
  ,reasonInput: { borderWidth: 1, borderRadius: 8, padding: 14, textAlign: 'right', fontFamily: 'Inter_400Regular' }
  ,modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 16 }
  ,modalButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' }
});
