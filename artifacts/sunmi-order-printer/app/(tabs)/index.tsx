import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Alert } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useTerminal } from '../../lib/TerminalContext';
import type { Order } from '../../lib/types';
import { OrderCard } from '../../components/OrderCard';
import { OrderDetail } from '../../components/OrderDetail';
import { Chip, Empty, ErrorState, Notice, ROW, Screen, Skeleton, timeOf } from '../../components/ui';

type F = 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'done' | 'cancelled';
const FILTERS: { id: F; label: string }[] = [
  { id: 'pending', label: 'جديدة' },
  { id: 'preparing', label: 'قيد التحضير' },
  { id: 'ready', label: 'جاهزة' },
  { id: 'out_for_delivery', label: 'قيد التوصيل' },
  { id: 'done', label: 'منتهية' },
  { id: 'cancelled', label: 'إلغاءات' },
];

export default function TodayScreen() {
  const colors = useColors();
  const refresh = () => t.refreshOrders().catch((e) => Alert.alert('تعذر التحديث', e instanceof Error ? e.message : 'خطأ غير متوقع'));
  const t = useTerminal();
  const match = (o: Order, f: F) => f === 'pending' ? t.needsAcceptance(o)
    : o.status === f && !(f === 'out_for_delivery' && t.needsAcceptance(o));
  const [filter, setFilter] = useState<F>('pending');
  const [selId, setSelId] = useState<string | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, t.orders.filter((o) => match(o, f.id)).length])) as Record<F, number>, [t.orders, t.events, t.actions]);
  const list = useMemo(() => t.orders.filter((o) => match(o, filter)).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [t.orders, filter, t.events, t.actions]);
  const selected = t.orders.find((o) => o.id === selId) ?? null;

  return (
    <Screen>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8, flexDirection: ROW }}>
          {FILTERS.map((f) => <Chip key={f.id} label={f.label} count={counts[f.id]} active={filter === f.id} onPress={() => setFilter(f.id)} />)}
        </ScrollView>
        <Notice text={t.connected ? `تحديث دوري للطلبات. آخر مزامنة: ${t.lastSync ? timeOf(t.lastSync) : 'لم تتم بعد'}. لا يعمل التطبيق في الخلفية.` : 'الاتصال بالخادم متقطع. الطلبات المعروضة قد لا تكون محدثة.'} tone={t.connected ? 'info' : 'warn'} />
      </View>
      {t.ordersError && t.orders.length > 0 ? <Notice tone="warn" text={t.ordersError} /> : null}
      {t.ordersLoading && t.orders.length === 0 ? <Skeleton /> : t.ordersError && t.orders.length === 0 ? <ErrorState message={t.ordersError} onRetry={() => void refresh()} /> : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 12, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={t.ordersLoading} onRefresh={() => void refresh()} tintColor={colors.primary} />}
          renderItem={({ item }) => <OrderCard order={item} onPress={() => setSelId(item.id)} />}
          ListEmptyComponent={<Empty icon="description" title="لا توجد طلبات" body="ستظهر الطلبات الجديدة هنا فور وصولها. اسحب للأسفل للتحديث." />}
        />)}
      <OrderDetail order={selected} onClose={() => setSelId(null)} />
    </Screen>
  );
}
