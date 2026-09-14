import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useColors } from '../../hooks/useColors';
import { printTest } from '../../lib/printer';
import { MaterialIcons } from '@expo/vector-icons';

export default function DiagnosticsScreen() {
  const colors = useColors();

  const { data: diag, isLoading, isError, refetch } = useQuery({
    queryKey: ['diagnostics'],
    queryFn: api.getDiagnostics,
  });

  const handleTestPrint = async () => {
    const success = await printTest();
    if (success) {
      Alert.alert('نجاح', 'تم إرسال أمر الطباعة التجريبية بنجاح.');
    } else {
      Alert.alert('خطأ', 'لم نتمكن من الطباعة، يرجى التحقق من الجهاز.');
    }
  };

  const renderStatus = (label: string, value: string, ok: boolean) => (
    <View style={[styles.statusRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.statusLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.statusValueContainer}>
        <Text style={[styles.statusValue, { color: ok ? colors.success : colors.destructive }]}>{value}</Text>
        <MaterialIcons name={ok ? 'check-circle' : 'error'} size={20} color={ok ? colors.success : colors.destructive} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>حالة النظام</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
        ) : isError || !diag ? (
          <View style={{ marginVertical: 32, alignItems: 'center' }}>
            <Text style={{ color: colors.destructive, fontFamily: 'Inter_500Medium', marginBottom: 16 }}>
              لا يمكن الاتصال بالخادم
            </Text>
            <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>إعادة الفحص</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusList}>
            {renderStatus('الاتصال بالخادم', diag.status === 'connected' ? 'متصل' : 'مقطوع', diag.status === 'connected')}
            {renderStatus('حالة الورق', diag.paperStatus === 'ok' ? 'متوفر' : diag.paperStatus === 'low' ? 'قليل' : 'نفذ', diag.paperStatus === 'ok')}
            <Text style={[styles.msg, { color: colors.mutedForeground }]}>{diag.message}</Text>
          </View>
        )}
      </View>

      <Pressable 
        style={[styles.btn, styles.printBtn, { backgroundColor: colors.secondary }]}
        onPress={handleTestPrint}
      >
        <MaterialIcons name="print" size={24} color={colors.secondaryForeground} />
        <Text style={[styles.btnText, { color: colors.secondaryForeground, marginHorizontal: 8 }]}>طباعة تجريبية</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  card: { padding: 24, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 24, textAlign: 'center' },
  statusList: { gap: 16 },
  statusRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1 },
  statusLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  statusValueContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  statusValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  msg: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center' },
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  printBtn: { flexDirection: 'row-reverse', marginTop: 'auto' },
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
