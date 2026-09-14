import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { getSettings, saveSettings } from '../../lib/storage';
import { stopAlert } from '../../lib/sound';
import { useAuth } from '../../contexts/AuthContext';
import { getApiBase } from '../../lib/api';

export default function SettingsScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [apiLabel, setApiLabel] = useState('غير مضبوط');

  useEffect(() => {
    getSettings().then((settings) => setSoundEnabled(settings.soundEnabled));
    try { setApiLabel(getApiBase()); } catch {}
  }, []);

  const changeSound = async (enabled: boolean) => {
    setSoundEnabled(enabled);
    await saveSettings({ soundEnabled: enabled, autoAssignDrivers: false });
    if (!enabled) await stopAlert();
  };

  const signOut = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد إنهاء جلسة جهاز Sunmi؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <MaterialIcons name="notifications-active" size={24} color={colors.primary} />
            <Text style={[styles.label, { color: colors.foreground }]}>صوت الطلبات الجديدة</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={changeSound}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.card}
            testID="sound-setting"
          />
        </View>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          هذا إعداد محلي لجهاز Sunmi ولا يغيّر إعدادات روابي.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.foreground }]}>اتصال Orders API</Text>
        <Text style={[styles.api, { color: colors.mutedForeground }]}>{apiLabel}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>الحساب الحالي: {user?.username}</Text>
      </View>

      <Pressable style={[styles.logout, { borderColor: colors.destructive }]} onPress={signOut} testID="sunmi-logout">
        <Text style={[styles.logoutText, { color: colors.destructive }]}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  label: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  desc: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8, lineHeight: 20, textAlign: 'right' },
  api: { fontSize: 13, marginTop: 10, textAlign: 'left' },
  logout: { minHeight: 52, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});