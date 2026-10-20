import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Conversation as Conv } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { Conversation } from '../../components/Conversation';
import { Card, dateOf, Empty, errMsg, ErrorState, ROW, Screen, Sheet, Skeleton, Txt } from '../../components/ui';

export default function MessagesScreen() {
  const c = useColors();
  const q = useQuery({ queryKey: ['conversations'], queryFn: api.getConversations, refetchInterval: 10000 });
  const [sel, setSel] = useState<Conv | null>(null);
  return (
    <Screen>
      {q.isLoading ? <Skeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(m) => String(m.orderId)} contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
          onRefresh={() => void q.refetch()} refreshing={q.isRefetching}
          ListEmptyComponent={<Empty icon="chat-bubble-outline" title="لا توجد رسائل من العملاء" body="تظهر هنا محادثات الطلبات عند مراسلة العميل." />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSel(item)}>
              <Card style={item.unread > 0 ? { borderColor: c.primary, borderWidth: 2 } : undefined}>
                <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
                  <Txt style={{ flex: 1, fontFamily: 'Inter_700Bold' }}>طلب #{item.dailyNumber ?? item.orderId} {item.customerName ? `- ${item.customerName}` : ''}</Txt>
                  {item.unread > 0 ? <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: c.destructive, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ color: '#fff', fontSize: 13 }}>{item.unread}</Txt></View> : null}
                </View>
                <Txt muted numberOfLines={2}>{item.lastText}</Txt>
                <Txt muted style={{ fontSize: 13 }}>{dateOf(item.lastAt)}</Txt>
              </Card>
            </Pressable>)} />)}
      <Sheet visible={!!sel} title={sel ? `محادثة طلب #${sel.dailyNumber ?? sel.orderId}` : ''} onClose={() => setSel(null)}>
        {sel ? <Conversation orderId={String(sel.orderId)} /> : null}
      </Sheet>
    </Screen>
  );
}
