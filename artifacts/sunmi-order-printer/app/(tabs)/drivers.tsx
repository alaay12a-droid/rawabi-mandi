import React, { useState } from 'react';
import { Alert, FlatList, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Driver } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { Btn, Card, Empty, errMsg, ErrorState, Field, Notice, ROW, Screen, Sheet, Skeleton, Txt, dateOf } from '../../components/ui';

export default function DriversScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['drivers'], queryFn: api.getDrivers, refetchInterval: 20000 });
  const [form, setForm] = useState<{ id?: string; name: string; phone: string; active: boolean } | null>(null);
  const ok = () => { void qc.invalidateQueries({ queryKey: ['drivers'] }); };
  const fail = (e: unknown) => Alert.alert('تعذر تنفيذ العملية', errMsg(e));
  const save = useMutation({
    mutationFn: async (f: NonNullable<typeof form>) => {
      if (!f.name.trim() || !f.phone.trim()) throw new Error('الاسم ورقم الجوال مطلوبان');
      return f.id ? api.updateDriver(f.id, { name: f.name.trim(), phone: f.phone.trim(), active: f.active }) : api.createDriver({ name: f.name.trim(), phone: f.phone.trim() });
    },
    onSuccess: () => { ok(); setForm(null); }, onError: fail,
  });
  const toggle = useMutation({ mutationFn: (d: Driver) => api.updateDriver(d.id, { name: d.name, phone: d.phone, active: !d.active }), onSuccess: ok, onError: fail });

  return (
    <Screen>
      <View style={{ padding: 12, gap: 10 }}>
        <Btn icon="person-add" label="إضافة سائق" onPress={() => setForm({ name: '', phone: '', active: true })} />
        <Notice text="يظهر آخر موقع معروف للسائق فقط عندما يشاركه من تطبيقه. لا يوجد تتبع مباشر في هذه الشاشة." />
      </View>
      {q.isLoading ? <Skeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={<Empty icon="two-wheeler" title="لا يوجد سائقون" body="أضف سائقا ليظهر في إسناد طلبات التوصيل." />}
          renderItem={({ item: d }) => (
            <Card>
              <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.isOnline ? c.success : c.mutedForeground }} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: 'Inter_700Bold' }}>{d.name}</Txt>
                  <Txt muted style={{ fontSize: 14 }}>{d.phone} - {d.isOnline ? 'متصل' : 'غير متصل'}</Txt>
                  {d.locationAt ? <Txt muted style={{ fontSize: 13 }}>آخر موقع: {dateOf(d.locationAt)}</Txt> : null}
                </View>
                <Switch value={d.active} onValueChange={() => toggle.mutate(d)} disabled={toggle.isPending} trackColor={{ true: c.success, false: c.muted }} />
              </View>
              <Btn tone="ghost" icon="edit" label="تعديل" onPress={() => setForm({ id: d.id, name: d.name, phone: d.phone, active: d.active })} />
            </Card>)} />)}
      <Sheet visible={!!form} title={form?.id ? 'تعديل سائق' : 'سائق جديد'} onClose={() => setForm(null)}>
        {form && (<>
          <Field label="الاسم" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="رقم الجوال" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
          {form.id ? <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}><Txt style={{ flex: 1 }}>نشط</Txt><Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} /></View> : null}
          <Btn icon="save" label="حفظ" loading={save.isPending} onPress={() => save.mutate(form)} />
        </>)}
      </Sheet>
    </Screen>
  );
}
