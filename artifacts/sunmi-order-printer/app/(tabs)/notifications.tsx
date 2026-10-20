import React from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTerminal } from '../../lib/TerminalContext';
import { useColors } from '../../hooks/useColors';
import type { TerminalEvent } from '../../lib/types';
import { Btn, Card, dateOf, Empty, errMsg, Notice, ROW, Screen, Txt, IconName } from '../../components/ui';

const ICON: Record<TerminalEvent['type'], IconName> = { order: 'receipt-long', message: 'chat', cancellation: 'cancel', system: 'info-outline' };

export default function NotificationsScreen() {
  const c = useColors();
  const { events, markRead, markAllRead } = useTerminal();
  const run = (p: Promise<void>) => p.catch((e) => Alert.alert('تعذر التحديث', errMsg(e)));
  return (
    <Screen>
      <FlatList data={events} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
        ListHeaderComponent={<View style={{ gap: 10 }}>
          <Notice text="هذه الإشعارات محفوظة على هذا الجهاز فقط وتسجل ما وصل أثناء فتح التطبيق." />
          {events.some((e) => !e.read) ? <Btn tone="ghost" icon="done-all" label="تعليم الكل كمقروء" onPress={() => void run(markAllRead())} /> : null}
        </View>}
        ListEmptyComponent={<Empty icon="notifications-none" title="لا توجد إشعارات" body="ستظهر هنا الطلبات الجديدة والرسائل والإلغاءات." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => void run(markRead(item.id))}>
            <Card style={!item.read ? { borderColor: c.primary, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: ROW, gap: 10, alignItems: 'center' }}>
                <MaterialIcons name={ICON[item.type]} size={26} color={item.type === 'cancellation' ? c.destructive : c.primary} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: 'Inter_700Bold' }}>{item.title}</Txt>
                  <Txt muted>{item.body}</Txt>
                  <Txt muted style={{ fontSize: 13 }}>{dateOf(item.createdAt)}</Txt>
                </View>
              </View>
            </Card>
          </Pressable>)} />
    </Screen>
  );
}
