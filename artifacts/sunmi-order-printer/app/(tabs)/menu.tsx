import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Switch, Alert, TextInput, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useColors } from '../../hooks/useColors';
import { MenuItem } from '../../lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import { formatMoney } from '../../lib/format';

export default function MenuScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [stockValue, setStockValue] = useState('');

  const { data: menu, isLoading, isError, refetch } = useQuery({
    queryKey: ['menu'],
    queryFn: api.getMenu,
  });

  const updateMenu = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<MenuItem> }) => api.updateMenuItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setStockModalVisible(false);
    },
    onError: (err) => {
      Alert.alert('خطأ', 'لم يتم تحديث الصنف: ' + err.message);
    }
  });

  const toggleAvailability = (item: MenuItem) => {
    updateMenu.mutate({ id: item.id, data: { available: !item.available } });
  };

  const handleStockSave = () => {
    if (selectedItem) {
      const val = stockValue.trim() === '' ? null : parseInt(stockValue, 10);
      if (val !== null && isNaN(val)) {
        Alert.alert('خطأ', 'الرجاء إدخال رقم صحيح أو ترك الحقل فارغاً');
        return;
      }
      updateMenu.mutate({ id: selectedItem.id, data: { stock: val } });
    }
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
        <Text style={[styles.price, { color: colors.primary }]}>{formatMoney(item.price)}</Text>
        <Pressable 
          style={styles.stockInfo}
          onPress={() => {
            setSelectedItem(item);
            setStockValue(item.stock !== null ? String(item.stock) : '');
            setStockModalVisible(true);
          }}
        >
          <MaterialIcons name="inventory" size={16} color={colors.mutedForeground} />
          <Text style={[styles.stockText, { color: colors.mutedForeground }]}>
            {item.stock !== null ? `المخزون: ${item.stock}` : 'بدون حد للمخزون'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Text style={[styles.status, { color: item.available ? colors.success : colors.destructive }]}>
          {item.available ? 'متاح' : 'غير متاح'}
        </Text>
        <Switch
          value={item.available}
          onValueChange={() => toggleAvailability(item)}
          trackColor={{ false: colors.muted, true: colors.primary }}
          thumbColor={colors.card}
        />
      </View>
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
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>حدث خطأ في تحميل القائمة</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={menu}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Stock Modal */}
      <Modal visible={stockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>تحديث المخزون</Text>
            
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>{selectedItem?.name}</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="مثال: 50 (اتركه فارغاً إذا لا يوجد حد)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={stockValue}
              onChangeText={setStockValue}
            />
            
            <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 16 }}>
              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleStockSave}
              >
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>تأكيد</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.secondary }]}
                onPress={() => setStockModalVisible(false)}
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
  list: { padding: 16, gap: 16 },
  card: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  info: { flex: 1 },
  name: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  stockInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 8 },
  stockText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  actions: { alignItems: 'center', gap: 8 },
  status: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'center', marginBottom: 16, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  btnPrimary: { flex: 2 },
  btnSecondary: { flex: 1 },
});
