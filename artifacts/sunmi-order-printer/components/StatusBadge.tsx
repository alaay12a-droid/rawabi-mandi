import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../hooks/useColors';

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const colors = useColors();

  const getStyle = () => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#D97706', label: 'قيد الانتظار' };
      case 'preparing':
        return { bg: '#E0F2FE', text: '#2563EB', label: 'قيد التحضير' };
      case 'ready':
        return { bg: '#DCFCE7', text: '#16A34A', label: 'جاهز' };
      case 'out_for_delivery':
        return { bg: '#F3E8FF', text: '#7E22CE', label: 'في الطريق' };
      case 'done':
        return { bg: '#F3F4F6', text: '#6B7280', label: 'مكتمل' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'ملغي' };
      default:
        return { bg: colors.muted, text: colors.mutedForeground, label: status };
    }
  };

  const { bg, text, label } = getStyle();

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
