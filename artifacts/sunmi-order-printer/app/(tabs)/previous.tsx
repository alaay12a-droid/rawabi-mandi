import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Order } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { OrderCard } from '../../components/OrderCard';
import { OrderDetail } from '../../components/OrderDetail';
import { Chip, Empty, errMsg, ErrorState, Field, ROW, Screen, Skeleton } from '../../components/ui';

const ST: { id: string; label: string }[] = [
  { id: 'all', label: 'الكل' }, { id: 'done', label: 'مكتملة' }, { id: 'cancelled', label: 'ملغاة' },
  { id: 'ready', label: 'جاهزة' }, { id: 'preparing', label: 'تحضير' }, { id: 'pending', label: 'جديدة' },
];

export default function PreviousScreen() {
  const colors = useColors();
  const q = useQuery({ queryKey: ['orders', 'previous'], queryFn: api.getPreviousOrders });
  const [num, setNum] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('all');
  const [sel, setSel] = useState<Order | null>(null);
  const list = useMemo(() => (q.data ?? []).filter((o) => {
    if (num.trim() && !String(o.dailyNumber).includes(num.trim().replace('#', ''))) return false;
    if (status !== 'all' && o.status !== status) return false;
    if (date.trim()) {
      const k = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(o.createdAt));
      if (!k.startsWith(date.trim())) return false;
    }
    return true;
  }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [q.data, num, date, status]);

  return (
    <Screen>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: ROW, gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="رقم الطلب" value={num} onChangeText={setNum} keyboardType="number-pad" placeholder="123" /></View>
          <View style={{ flex: 1 }}><Field label="التاريخ" value={date} onChangeText={setDate} placeholder="2025-01-31" autoCapitalize="none" keyboardType="numbers-and-punctuation" /></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: ROW }}>
          {ST.map((s) => <Chip key={s.id} label={s.label} active={status === s.id} onPress={() => setStatus(s.id)} />)}
        </ScrollView>
      </View>
      {q.isLoading ? <Skeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList data={list} keyExtractor={(o) => o.id} contentContainerStyle={{ padding: 12, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          renderItem={({ item }) => <OrderCard order={item} showDate onPress={() => setSel(item)} />}
          ListEmptyComponent={<Empty icon="search-off" title="لا توجد نتائج" body="غيّر رقم الطلب أو التاريخ أو الحالة. تظهر هنا الطلبات التي يعيدها الخادم لهذا الحساب." />} />)}
      <OrderDetail order={sel} readOnly onClose={() => setSel(null)} />
    </Screen>
  );
}
