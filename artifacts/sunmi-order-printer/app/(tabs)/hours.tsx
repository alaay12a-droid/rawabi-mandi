import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BranchHours } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { Btn, Card, errMsg, ErrorState, Field, Notice, ROW, Screen, Skeleton, Txt } from '../../components/ui';

// Index order follows the backend array (0 = Sunday, JS getDay convention).
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function HoursScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['hours'], queryFn: api.getHours });
  const status = useQuery({ queryKey: ['branch-status'], queryFn: api.getBranchStatus, refetchInterval: 30000 });
  const [draft, setDraft] = useState<BranchHours | null>(null);
  useEffect(() => { if (q.data && !draft) setDraft(q.data); }, [q.data, draft]);
  const save = useMutation({
    mutationFn: async (h: BranchHours) => {
      for (let i = 0; i < h.days.length; i++) {
        const d = h.days[i];
        if (d.enabled && (!TIME.test(d.open) || !TIME.test(d.close))) throw new Error(`صيغة الوقت في يوم ${DAYS[i]} يجب أن تكون HH:MM بنظام 24 ساعة`);
      }
      return api.updateHours(h);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['hours'] }); void qc.invalidateQueries({ queryKey: ['branch-status'] }); Alert.alert('تم الحفظ', 'تم تحديث ساعات العمل'); },
    onError: (e) => Alert.alert('تعذر الحفظ', errMsg(e)),
  });
  if (q.isLoading) return <Screen><Skeleton /></Screen>;
  if (q.isError || !draft) return <Screen><ErrorState message={errMsg(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const setDay = (i: number, p: Partial<BranchHours['days'][number]>) => setDraft({ ...draft, days: draft.days.map((d, k) => (k === i ? { ...d, ...p } : d)) });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
        {status.data ? <Card style={{ borderColor: status.data.isOpen ? c.success : c.destructive }}><Txt style={{ fontFamily: 'Inter_700Bold' }}>{status.data.isOpen ? 'الفرع مفتوح الآن' : 'الفرع مغلق الآن'}</Txt><Txt muted>{status.data.message}</Txt></Card> : null}
        <Card>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><Txt style={{ fontFamily: 'Inter_700Bold' }}>تطبيق الجدول الأسبوعي</Txt><Txt muted style={{ fontSize: 14 }}>عند الإيقاف لا يتم التحكم بالفتح والإغلاق من الجدول</Txt></View>
            <Switch value={draft.enabled} onValueChange={(v) => setDraft({ ...draft, enabled: v })} trackColor={{ true: c.success, false: c.muted }} />
          </View>
        </Card>
        {draft.days.slice(0, 7).map((d, i) => (
          <Card key={i} style={{ opacity: d.enabled ? 1 : 0.75 }}>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
              <Txt style={{ flex: 1, fontFamily: 'Inter_700Bold' }}>{DAYS[i]}</Txt>
              <Txt muted style={{ fontSize: 14 }}>{d.enabled ? 'يعمل' : 'إجازة'}</Txt>
              <Switch value={d.enabled} onValueChange={(v) => setDay(i, { enabled: v })} trackColor={{ true: c.success, false: c.muted }} />
            </View>
            {d.enabled && (
              <View style={{ flexDirection: ROW, gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="من" value={d.open} onChangeText={(v) => setDay(i, { open: v })} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} style={{ textAlign: 'center' }} /></View>
                <View style={{ flex: 1 }}><Field label="إلى" value={d.close} onChangeText={(v) => setDay(i, { close: v })} placeholder="23:00" keyboardType="numbers-and-punctuation" maxLength={5} style={{ textAlign: 'center' }} /></View>
              </View>)}
          </Card>))}
        <Btn icon="save" label="حفظ ساعات العمل" loading={save.isPending} onPress={() => save.mutate(draft)} />
        <Notice text="غير مدعوم حاليا في الخادم: فترات متعددة في اليوم، الإغلاق المؤقت المجدول، والإتاحة أو الاسترداد المجدول. الجدول هنا فترة واحدة لكل يوم." />
      </ScrollView>
    </Screen>
  );
}
