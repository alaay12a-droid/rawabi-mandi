import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '../hooks/useColors';
import { formatMoney } from '../lib/format';
import type { Order } from '../lib/types';
import { StatusBadge } from './StatusBadge';
import { Card, dateOf, payLabel, ROW, timeOf, Txt } from './ui';

export function OrderCard({ order, onPress, showDate }: { order: Order; onPress: () => void; showDate?: boolean }) {
  const c = useColors();
  const shown = order.items.slice(0, 3);
  return (
    <Pressable onPress={onPress} testID={`order-${order.id}`}>
      <Card>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 26 }}>#{order.dailyNumber}</Txt>
          <View style={{ flex: 1 }}>
            <Txt muted style={{ fontSize: 14 }}>{showDate ? dateOf(order.createdAt) : timeOf(order.createdAt)} - {order.orderType === 'delivery' ? 'توصيل' : 'استلام'}</Txt>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <Txt style={{ fontFamily: 'Inter_600SemiBold' }}>{order.customerName || 'عميل'}</Txt>
        {shown.map((i, k) => (
          <View key={`${i.id}-${k}`} style={{ flexDirection: ROW, gap: 8 }}>
            <Txt style={{ color: c.primary, fontFamily: 'Inter_700Bold', minWidth: 34 }}>{i.quantity}x</Txt>
            <Txt style={{ flex: 1 }}>{i.name}</Txt>
          </View>))}
        {order.items.length > 3 ? <Txt muted style={{ fontSize: 14 }}>و {order.items.length - 3} أصناف أخرى</Txt> : null}
        <View style={{ height: 1, backgroundColor: c.border }} />
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="payments" size={20} color={c.mutedForeground} />
          <Txt muted style={{ flex: 1, fontSize: 14 }}>{payLabel(order.paymentMethod)}</Txt>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }}>{formatMoney(order.totalPrice)}</Txt>
        </View>
      </Card>
    </Pressable>
  );
}
