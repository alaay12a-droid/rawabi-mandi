import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { INK, ROW, T } from './ui';

export function OrderDetailSheet({ visible, title, badge, onClose, children, footer, overlay, testID }: {
  visible: boolean; title: string; badge?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; overlay?: React.ReactNode; testID?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay} testID={testID}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={[s.head, { backgroundColor: c.card, borderBottomColor: c.border, flexDirection: ROW }]}>
            <Text style={[T.h2, { color: c.foreground, flex: 1 }]}>{title}</Text>
            {badge}
            <Pressable onPress={onClose} hitSlop={8} style={s.close} testID="sheet-close" accessibilityRole="button" accessibilityLabel="إغلاق">
              <MaterialIcons name="close" size={26} color={INK} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: footer ? 16 : Math.max(16, insets.bottom) }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ padding: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card }}>{footer}</View> : null}
          {overlay}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(31,42,55,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '94%', minHeight: '60%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  head: { alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 8 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
