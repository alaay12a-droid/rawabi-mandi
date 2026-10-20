import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useColors } from '../hooks/useColors';
import { Btn, Chip, Empty, ROW, errMsg, Field, INK, Skeleton, timeOf, Txt } from './ui';

export function Conversation({ orderId }: { orderId: string }) {
  const c = useColors();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const q = useQuery({ queryKey: ['messages', orderId], queryFn: () => api.getMessages(orderId), refetchInterval: 8000 });
  const read = useMutation({ mutationFn: () => api.markMessagesRead(orderId), onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }) });
  const send = useMutation({
    mutationFn: (t: string) => api.sendMessage(orderId, t),
    onSuccess: () => { setText(''); void qc.invalidateQueries({ queryKey: ['messages', orderId] }); void qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e) => Alert.alert('تعذر الإرسال', errMsg(e)),
  });
  const latestIncoming = (q.data ?? []).reduce((mx, m) => (!m.fromCashier && m.id > mx ? m.id : mx), 0);
  const readMutate = useRef(read.mutate);
  readMutate.current = read.mutate;
  const marked = useRef(0);
  useEffect(() => { marked.current = 0; }, [orderId]);
  useEffect(() => {
    if (latestIncoming > marked.current) { marked.current = latestIncoming; readMutate.current(); }
  }, [latestIncoming]);
  const QUICK = ['تم استلام طلبك', 'طلبك قيد التحضير', 'طلبك جاهز', 'السائق في الطريق إليك', 'نعتذر عن التأخير'];

  return (
    <View style={{ gap: 10 }}>
      {q.isLoading ? <Skeleton n={1} /> : q.isError ? <Txt style={{ color: c.destructive }}>{errMsg(q.error)}</Txt> :
        (q.data ?? []).length === 0 ? <Empty icon="chat-bubble-outline" title="لا توجد رسائل" body="ابدأ المحادثة مع العميل بخصوص هذا الطلب" /> :
          (q.data ?? []).map((m) => (
            <View key={m.id} style={{ alignSelf: m.fromCashier ? 'flex-start' : 'flex-end', maxWidth: '85%', padding: 12, borderRadius: 14, backgroundColor: m.fromCashier ? INK : c.muted }}>
              <Txt style={{ color: m.fromCashier ? '#fff' : c.foreground }}>{m.text}</Txt>
              <Txt style={{ fontSize: 12, color: m.fromCashier ? '#D1D5DB' : c.mutedForeground }}>{timeOf(m.createdAt)}</Txt>
            </View>))}
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
        {QUICK.map((qt) => <Chip key={qt} label={qt} active={false} onPress={() => setText(qt)} />)}
      </View>
      <Field label="رسالة للعميل" value={text} onChangeText={setText} multiline />
      <Btn label="إرسال" icon="send" loading={send.isPending} disabled={!text.trim()} onPress={() => send.mutate(text.trim())} />
    </View>
  );
}
