import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Slot, usePathname } from 'expo-router';
import { useColors } from '../../hooks/useColors';
import { useTerminal } from '../../lib/TerminalContext';
import { MENU_ITEMS, SideMenu } from '../../components/SideMenu';
import { INK, ROW } from '../../components/ui';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const pathname = usePathname() || '/';
  const { orders, connected, events } = useTerminal();
  const [open, setOpen] = useState(false);
  const title = MENU_ITEMS.find((m) => m.path === pathname)?.label ?? 'چڤن';
  const pending = orders.filter((o) => o.status === 'pending').length;
  const unread = events.filter((e) => !e.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[st.header, { paddingTop: insets.top + 8, flexDirection: ROW }]}>
        <Pressable onPress={() => setOpen(true)} style={st.btn} testID="open-menu" accessibilityLabel="القائمة">
          <MaterialIcons name="menu" size={28} color="#fff" />
        </Pressable>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 6 }}>
          {pending > 0 ? <View style={[st.pill, { backgroundColor: colors.primary }]}><Text style={st.pillText}>{pending} جديد</Text></View> : null}
          {unread > 0 ? <View style={[st.pill, { backgroundColor: colors.destructive }]}><Text style={[st.pillText, { color: '#fff' }]}>{unread}</Text></View> : null}
          <View style={[st.dot, { backgroundColor: connected ? '#4ADE80' : '#F87171' }]} />
        </View>
      </View>
      <View style={{ flex: 1 }}><Slot /></View>
      <SideMenu visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { backgroundColor: INK, paddingHorizontal: 8, paddingBottom: 8, alignItems: 'center', gap: 8 },
  btn: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 19, textAlign: 'right', writingDirection: 'rtl' },
  pill: { paddingHorizontal: 10, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: INK },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 8 },
});
