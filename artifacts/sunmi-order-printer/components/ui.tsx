import React from 'react';
import { ActivityIndicator, I18nManager, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';

export const ROW = I18nManager.isRTL ? 'row' : 'row-reverse';
export const INK = '#1F2A37';
export const GOLD_SOFT = '#FBF3DC';
export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export const T = StyleSheet.create({
  h1: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'right', writingDirection: 'rtl' },
  h2: { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'right', writingDirection: 'rtl' },
  body: { fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' },
  small: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
});

export function Txt({ style, muted, children, ...p }: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  const c = useColors();
  return <Text {...p} style={[T.body, { color: muted ? c.mutedForeground : c.foreground }, style]}>{children}</Text>;
}

type Tone = 'primary' | 'success' | 'danger' | 'soft' | 'ghost';
export function Btn({ label, onPress, tone = 'primary', icon, disabled, loading, style, testID }: {
  label: string; onPress: () => void; tone?: Tone; icon?: IconName; disabled?: boolean; loading?: boolean; style?: ViewStyle; testID?: string;
}) {
  const c = useColors();
  const map: Record<Tone, { bg: string; fg: string; border?: string }> = {
    primary: { bg: INK, fg: '#FFFFFF' },
    success: { bg: c.success, fg: c.successForeground },
    danger: { bg: c.destructive, fg: c.destructiveForeground },
    soft: { bg: GOLD_SOFT, fg: INK, border: c.primary },
    ghost: { bg: c.card, fg: INK, border: c.border },
  };
  const m = map[tone];
  const off = disabled || loading;
  return (
    <Pressable testID={testID} disabled={off} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: m.bg, borderColor: m.border ?? m.bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={m.fg} /> : (
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
          {icon ? <MaterialIcons name={icon} size={22} color={m.fg} /> : null}
          <Text style={[s.btnText, { color: m.fg }]}>{label}</Text>
        </View>)}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[s.chip, { backgroundColor: active ? INK : c.card, borderColor: active ? INK : c.border }]}>
      <Text style={[s.chipText, { color: active ? '#fff' : c.foreground }]}>{label}</Text>
      {count !== undefined ? (
        <View style={[s.count, { backgroundColor: active ? c.primary : c.muted }]}>
          <Text style={[s.countText, { color: active ? INK : c.foreground }]}>{count}</Text>
        </View>) : null}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Field({ label, hint, style, ...p }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Txt style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{label}</Txt>
      <TextInput placeholderTextColor={c.mutedForeground} {...p}
        style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }, p.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
      {hint ? <Txt muted style={T.small}>{hint}</Txt> : null}
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: GOLD_SOFT }]}><MaterialIcons name={icon} size={44} color={c.primary} /></View>
      <Txt style={{ textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 18 }}>{title}</Txt>
      {body ? <Txt muted style={{ textAlign: 'center' }}>{body}</Txt> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Empty icon="error-outline" title="تعذر تحميل البيانات" body={message} action={onRetry ? <Btn label="إعادة المحاولة" icon="refresh" onPress={onRetry} /> : undefined} />;
}

export function Skeleton({ n = 3 }: { n?: number }) {
  const c = useColors();
  return <View style={{ padding: 16, gap: 12 }}>{Array.from({ length: n }).map((_, i) => <View key={i} style={{ height: 120, borderRadius: 14, backgroundColor: c.muted, opacity: 0.6 }} />)}</View>;
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' }) {
  const c = useColors();
  return (
    <View style={[s.notice, { backgroundColor: tone === 'warn' ? '#FEF3C7' : GOLD_SOFT, borderColor: c.primary }]}>
      <MaterialIcons name="info-outline" size={20} color={INK} />
      <Txt style={[T.small, { flex: 1 }]}>{text}</Txt>
    </View>
  );
}

export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={[s.sheetHead, { backgroundColor: c.card, borderBottomColor: c.border, flexDirection: ROW }]}>
            <Text style={[T.h2, { color: c.foreground, flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={s.closeBtn} testID="sheet-close"><MaterialIcons name="close" size={26} color={INK} /></Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: footer ? 16 : Math.max(16, insets.bottom) }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ padding: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <View style={{ flex: 1, backgroundColor: c.background }}>{children}</View>;
}

export function errMsg(e: unknown): string { return e instanceof Error ? e.message : 'حدث خطأ غير متوقع'; }
export function timeOf(iso: string): string {
  try { return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; }
}
export function dateOf(iso: string): string {
  try { return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso; }
}
export function payLabel(m: string): string {
  const k = (m || '').toLowerCase();
  if (k === 'cash') return 'نقدي';
  if (k === 'card' || k === 'online') return 'بطاقة / إلكتروني';
  return m || 'غير محدد';
}

const s = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 16, flexShrink: 1, textAlign: 'center' },
  chip: { minHeight: 48, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: ROW, alignItems: 'center', gap: 8 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  count: { minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  input: { minHeight: 54, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'right', writingDirection: 'rtl' },
  empty: { alignItems: 'center', gap: 12, padding: 32, marginTop: 40 },
  emptyIcon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: ROW, gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'flex-start' },
  overlay: { flex: 1, backgroundColor: 'rgba(31,42,55,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '94%', minHeight: '60%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHead: { alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 8 },
  closeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
