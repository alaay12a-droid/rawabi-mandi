import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { useAuth } from '../lib/AuthContext';
import { GOLD_SOFT, INK, IconName, ROW, Txt } from './ui';

export const MENU_ITEMS: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'طلبات اليوم', icon: 'receipt-long' },
  { path: '/previous', label: 'الطلبات السابقة', icon: 'history' },
  { path: '/menu', label: 'قائمة الأصناف', icon: 'restaurant-menu' },
  { path: '/hours', label: 'ساعات العمل', icon: 'schedule' },
  { path: '/drivers', label: 'السائقون', icon: 'two-wheeler' },
  { path: '/messages', label: 'رسائل العملاء', icon: 'chat' },
  { path: '/notifications', label: 'مركز الإشعارات', icon: 'notifications-none' },
  { path: '/help', label: 'المساعدة', icon: 'help-outline' },
  { path: '/tutorials', label: 'الشروحات', icon: 'school' },
  { path: '/settings', label: 'الإعدادات', icon: 'settings' },
  { path: '/diagnostics', label: 'التشخيص والطابعة', icon: 'print' },
];

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const auth = useAuth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: ROW }}>
        <View style={[st.panel, { backgroundColor: c.card, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <View style={[st.head, { flexDirection: ROW }]}>
            <View style={{ flex: 1 }}>
              <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 22 }}>چڤن</Txt>
              <Txt muted style={{ fontSize: 13 }}>{auth.user?.username ?? ''}</Txt>
            </View>
            <Pressable onPress={onClose} style={st.x} testID="menu-close"><MaterialIcons name="close" size={28} color={INK} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 10, gap: 4 }}>
            {MENU_ITEMS.map((m) => {
              const active = pathname === m.path;
              return (
                <Pressable key={m.path} testID={`menu-${m.path}`} onPress={() => { onClose(); router.navigate(m.path as any); }}
                  style={[st.item, { flexDirection: ROW, backgroundColor: active ? GOLD_SOFT : 'transparent' }]}>
                  <MaterialIcons name={m.icon} size={24} color={active ? c.primary : INK} />
                  <Text style={[st.label, { color: INK, flex: 1 }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable testID="menu-logout" onPress={() => { onClose(); auth.logout().catch((e) => Alert.alert('تعذر تسجيل الخروج', e instanceof Error ? e.message : 'خطأ غير متوقع')); }}
            style={[st.item, { flexDirection: ROW, margin: 10, backgroundColor: c.destructive }]}>
            <MaterialIcons name="logout" size={24} color="#fff" />
            <Text style={[st.label, { color: '#fff', flex: 1 }]}>تسجيل الخروج</Text>
          </Pressable>
        </View>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(31,42,55,0.45)' }} onPress={onClose} />
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  panel: { width: '82%', maxWidth: 340 },
  head: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  x: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  item: { minHeight: 54, borderRadius: 12, alignItems: 'center', paddingHorizontal: 14, gap: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'right', writingDirection: 'rtl' },
});
