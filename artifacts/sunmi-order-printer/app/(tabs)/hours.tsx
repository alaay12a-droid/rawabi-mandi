import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useColors } from '../../hooks/useColors';
import { BranchHours } from '../../lib/types';

export default function HoursScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();

  const { data: hours, isLoading, isError, refetch } = useQuery({
    queryKey: ['hours'],
    queryFn: api.getHours,
  });

  const updateHours = useMutation({
    mutationFn: (data: BranchHours) => api.updateHours(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hours'] });
      Alert.alert('نجاح', 'تم تحديث أوقات العمل بنجاح');
    },
    onError: (err) => {
      Alert.alert('خطأ', 'فشل في تحديث الأوقات: ' + err.message);
    }
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !hours) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}>حدث خطأ في تحميل الأوقات</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  const toggleStatus = () => {
    updateHours.mutate({ ...hours, isOpen: !hours.isOpen });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>حالة الفرع</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {hours.isOpen ? 'الفرع يستقبل الطلبات حالياً' : 'الفرع مغلق ولا يستقبل طلبات'}
            </Text>
          </View>
          <Switch
            value={hours.isOpen}
            onValueChange={toggleStatus}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.card}
            style={{ transform: [{ scale: 1.5 }] }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, marginBottom: 16 }]}>ساعات العمل الرسمية</Text>
        
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.foreground }]}>وقت الفتح:</Text>
          <Text style={[styles.timeValue, { color: colors.primary }]}>{hours.openingTime}</Text>
        </View>
        
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.foreground }]}>وقت الإغلاق:</Text>
          <Text style={[styles.timeValue, { color: colors.primary }]}>{hours.closingTime}</Text>
        </View>

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          ملاحظة: تعديل الأوقات يتم من خلال لوحة الإدارة الرئيسية.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  card: { padding: 24, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 },
  timeRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  timeLabel: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  timeValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  note: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 16, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
