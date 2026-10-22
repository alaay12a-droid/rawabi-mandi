import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import type { Driver } from '../lib/types';
import { Conversation } from './Conversation';
import { OrderDetailSheet } from './OrderDetailSheet';
import { Btn, Card, Empty, ErrorState, INK, Notice, ROW, T, Txt } from './ui';

type DriverChoicesProps = {
  drivers: Driver[] | undefined; loading: boolean; error: string | null; onRetry: () => void;
  currentId: string | null; busyId: string | null; selectedId?: string | null;
  onAssign: (d: Driver) => void; idPrefix?: string;
};

function DriverChoices({ drivers, loading, error, onRetry, currentId, busyId, selectedId, onAssign, idPrefix = 'assign-driver' }: DriverChoicesProps) {
  const c = useColors();
  const active = (drivers ?? []).filter(d => d.active);
  if (loading) return <>{[0, 1, 2].map(i => <View key={i} style={{ height: 84, borderRadius: 16, backgroundColor: c.muted, opacity: 0.6 }} />)}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!active.length) return <Empty icon="two-wheeler" title="لا يوجد سائقون نشطون" body="أضفهم من صفحة السائقين." action={<Btn label="تحديث" icon="refresh" tone="soft" onPress={onRetry} />} />;
  return <>{active.map(d => (
    <Card key={d.id}>
      <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontFamily: 'Inter_700Bold' }}>{d.name}</Txt>
          <Txt muted style={{ fontSize: 14 }}>{d.isOnline ? 'متصل' : 'غير متصل'}</Txt>
        </View>
        <Btn testID={`${idPrefix}-${d.id}`} tone="soft"
          label={currentId === d.id ? 'السائق الحالي' : selectedId === d.id ? 'محدد' : 'تعيين'}
          icon={selectedId === d.id ? 'check' : undefined}
          loading={busyId === d.id} disabled={!d.isOnline || currentId === d.id || busyId !== null}
          onPress={() => onAssign(d)} style={{ minWidth: 100 }} />
      </View>
    </Card>
  ))}</>;
}

export function DriverPicker({ visible, drivers, loading, error, onRetry, currentId, busyId, assignError, notes, onAssign, onSkip, onBack }: {
  visible: boolean; drivers: Driver[] | undefined; loading: boolean; error: string | null; onRetry: () => void;
  currentId: string | null; busyId: string | null; assignError: string | null; notes: string[];
  onAssign: (d: Driver) => void; onSkip: () => void; onBack: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onBack}>
      <View testID="driver-picker" style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8, padding: 16, paddingTop: Math.max(16, insets.top), backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Pressable onPress={onBack} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="رجوع" testID="driver-picker-back">
            <MaterialIcons name="arrow-forward" size={26} color={INK} />
          </Pressable>
          <Text style={[T.h2, { color: c.foreground, flex: 1 }]}>اختر السائق</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {notes.map((n) => <Notice key={n} tone="warn" text={n} />)}
          {assignError ? <Notice tone="warn" text={assignError} /> : null}
          <DriverChoices {...{ drivers, loading, error, onRetry, currentId, busyId, onAssign }} />
        </ScrollView>
        <View style={{ padding: 12, paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card, gap: 8 }}>
          <Btn testID="skip-driver-assignment" tone="ghost" label="تخطي، أعيّن لاحقًا" disabled={busyId !== null} onPress={onSkip} />
        </View>
      </View>
    </Modal>
  );
}

export function DriverChangeDialog({ visible, name, warning, pending, onConfirm, onCancel, assignError, canConfirm, ...choices }: DriverChoicesProps & {
  visible: boolean; name: string | null; warning: string; pending: boolean;
  assignError: string | null; canConfirm: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(31,42,55,0.5)', justifyContent: 'center', padding: 20 }}>
        <View testID="driver-change-dialog" accessibilityViewIsModal style={{ backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 12, maxHeight: '85%', width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }}>تغيير السائق</Txt>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Txt muted style={T.small}>{warning}</Txt>
            {assignError ? <Notice tone="warn" text={assignError} /> : null}
            <DriverChoices {...choices} idPrefix="select-replacement" />
            {name ? <Txt style={{ fontFamily: 'Inter_600SemiBold' }}>السائق المختار: {name}</Txt> : null}
          </ScrollView>
          <View style={{ flexDirection: ROW, gap: 8 }}>
            <Btn testID="confirm-driver-change" label="تأكيد" loading={pending} disabled={!canConfirm || choices.loading || !!choices.error} onPress={onConfirm} style={{ flex: 1 }} />
            <Btn testID="cancel-driver-change" tone="ghost" label="إلغاء" disabled={pending} onPress={onCancel} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ConversationSheet({ visible, orderId, title, onClose }: { visible: boolean; orderId: string; title: string; onClose: () => void }) {
  return <OrderDetailSheet visible={visible} title={title} onClose={onClose}>{visible ? <Conversation orderId={orderId} /> : null}</OrderDetailSheet>;
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 96, alignItems: 'center' }}>
      <View testID="order-detail-toast" accessibilityLiveRegion="polite" style={{ flexDirection: ROW, alignItems: 'center', gap: 8, backgroundColor: INK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={[T.small, { color: '#fff', flexShrink: 1 }]}>{text}</Text>
      </View>
    </View>
  );
}
