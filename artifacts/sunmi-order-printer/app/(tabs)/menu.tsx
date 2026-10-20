import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Switch, View } from 'react-native';
import { ScrollView } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MenuItem } from '../../lib/types';
import { Btn, Card, Chip, Empty, errMsg, ErrorState, Field, Notice, ROW, Screen, Sheet, Skeleton, Txt } from '../../components/ui';
import { useColors } from '../../hooks/useColors';

// Server GET returns nested money in minor units; PUT/POST expect SAR. Convert only for the editor form.
const toSar = (n: unknown) => (typeof n === 'number' ? n / 100 : n);
const sizesForForm = (v: unknown) => (Array.isArray(v) ? v.map((x: any) => (x && typeof x === 'object' && 'price' in x ? { ...x, price: toSar(x.price) } : x)) : v);
const optionsForForm = (v: unknown) => (Array.isArray(v) ? v.map((g: any) => (g && Array.isArray(g.choices) ? { ...g, choices: g.choices.map((ch: any) => (ch && typeof ch === 'object' && 'extraPrice' in ch ? { ...ch, extraPrice: toSar(ch.extraPrice) } : ch)) } : g)) : v);
const pretty = (v: unknown) => (v && Array.isArray(v) && v.length ? JSON.stringify(v, null, 2) : '');
const CAT_AR: Record<string, string> = { chicken: "الدجاج", desserts: "الحلويات", drinks: "المشروبات", extras: "إضافات", mains: "الأطباق الرئيسية", meat: "اللحوم", salads: "السلطات", sides: "الإيدامات" };
type Avail = 'all' | 'available' | 'paused';
type Form = { id?: string; name: string; category: string; price: string; imageUrl: string; available: boolean; options: string; sizes: string };
const blank: Form = { name: '', category: '', price: '', imageUrl: '', available: true, options: '', sizes: '' };

export default function MenuScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ['menu'], queryFn: api.getMenu });
  const cats = useQuery({ queryKey: ['categories'], queryFn: api.getCategories });
  const [cat, setCat] = useState('all');
  const [avail, setAvail] = useState<Avail>('all');
  const [form, setForm] = useState<Form | null>(null);
  const done = () => { void qc.invalidateQueries({ queryKey: ['menu'] }); void qc.invalidateQueries({ queryKey: ['categories'] }); };
  const fail = (e: unknown) => Alert.alert('تعذر تنفيذ العملية', errMsg(e));

  const toggle = useMutation({ mutationFn: (v: { id: string; available: boolean }) => api.updateMenuItem(v.id, { available: v.available }), onSuccess: done, onError: fail });
  const bulk = useMutation({
    mutationFn: async (v: { ids: string[]; available: boolean }) => { for (const id of v.ids) await api.updateMenuItem(id, { available: v.available }); },
    onSuccess: done, onError: (e) => { done(); fail(e); },
  });
  const save = useMutation({
    mutationFn: async (f: Form) => {
      const price = Number(f.price.replace(',', '.'));
      if (!f.name.trim()) throw new Error('اسم الصنف مطلوب');
      if (!f.category.trim()) throw new Error('الفئة مطلوبة');
      if (!isFinite(price) || price <= 0) throw new Error('السعر بالريال يجب أن يكون أكبر من صفر');
      const parse = (s: string, n: string) => { if (!s.trim()) return []; try { const v = JSON.parse(s); if (!Array.isArray(v)) throw new Error(); return v; } catch { throw new Error(`صيغة JSON غير صحيحة في ${n}، يجب أن تكون قائمة`); } };
      const body = { category: f.category.trim(), name: f.name.trim(), price, available: f.available, imageUrl: f.imageUrl.trim() || null, options: parse(f.options, 'الخيارات'), sizes: parse(f.sizes, 'الأحجام') };
      return f.id ? api.updateMenuItem(f.id, body) : api.createMenuItem(body);
    },
    onSuccess: () => { done(); setForm(null); }, onError: fail,
  });
  const reorder = useMutation({ mutationFn: (ids: string[]) => api.reorderMenu(ids), onSuccess: done, onError: fail });
  const del = (it: MenuItem) => Alert.alert('حذف الصنف', `هل تريد حذف "${it.name}" نهائيا؟`, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'حذف', style: 'destructive', onPress: () => api.deleteMenuItem(it.id).then(() => { done(); setForm(null); }).catch(fail) },
  ]);

  const items = menu.data ?? [];
  const catList = useMemo(() => {
    const m = new Map<string, string>();
    (cats.data ?? []).forEach((x) => m.set(x.id, CAT_AR[x.id] ?? x.name));
    items.forEach((i) => { if (i.category && !m.has(i.category)) m.set(i.category, CAT_AR[i.category] ?? i.category); });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [cats.data, items]);
  const catName = (id?: string) => catList.find((c2) => c2.id === id)?.name ?? id ?? 'بدون فئة';
  const inCat = items.filter((i) => cat === 'all' || i.category === cat);
  const list = inCat.filter((i) => avail === 'all' || (avail === 'available' ? i.available : !i.available));
  const catIds = inCat.map((i) => i.id);
  const move = (item: MenuItem, dir: -1 | 1) => {
    const k = inCat.findIndex((x) => x.id === item.id);
    const other = inCat[k + dir];
    if (!other) return;
    const ids = items.map((x) => x.id);
    const a = ids.indexOf(item.id), b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    reorder.mutate(ids);
  };
  const edit = (i: MenuItem) => setForm({ id: i.id, name: i.name, category: i.category ?? '', price: (i.price / 100).toString(), imageUrl: i.imageUrl ?? '', available: i.available, options: pretty(optionsForForm(i.options)), sizes: pretty(sizesForForm(i.sizes)) });

  return (
    <Screen>
      <View style={{ padding: 12, gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: ROW }}>
          <Chip label="الكل" active={cat === 'all'} onPress={() => setCat('all')} count={items.length} />
          {catList.map((n) => <Chip key={n.id} label={n.name} active={cat === n.id} onPress={() => setCat(n.id)} count={items.filter((i) => i.category === n.id).length} />)}
        </ScrollView>
        <View style={{ flexDirection: ROW, gap: 8 }}>
          {(['all', 'available', 'paused'] as Avail[]).map((a) => <Chip key={a} label={a === 'all' ? 'كل الحالات' : a === 'available' ? 'متاح' : 'موقوف'} active={avail === a} onPress={() => setAvail(a)} />)}
        </View>
        <View style={{ flexDirection: ROW, gap: 8 }}>
          <Btn style={{ flex: 1 }} icon="add" label="صنف جديد" onPress={() => setForm({ ...blank, category: cat === 'all' ? '' : cat })} />
        </View>
        {cat !== 'all' && list.length > 0 && (
          <View style={{ flexDirection: ROW, gap: 8 }}>
            <Btn style={{ flex: 1 }} tone="ghost" label="تفعيل كل الفئة" loading={bulk.isPending} onPress={() => bulk.mutate({ ids: catIds, available: true })} />
            <Btn style={{ flex: 1 }} tone="ghost" label="إيقاف كل الفئة" loading={bulk.isPending} onPress={() => bulk.mutate({ ids: catIds, available: false })} />
          </View>)}
        <Notice text="الإتاحة الزمنية المجدولة غير مدعومة في الخادم. التفعيل والإيقاف هنا فوري ويدوي." />
      </View>
      {menu.isLoading ? <Skeleton /> : menu.isError ? <ErrorState message={errMsg(menu.error)} onRetry={() => void menu.refetch()} /> : (
        <FlatList data={list} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
          ListEmptyComponent={<Empty icon="restaurant-menu" title="لا توجد أصناف" body="أضف صنفا جديدا أو اختر فئة أخرى." />}
          renderItem={({ item }) => (
            <Card style={{ opacity: item.available ? 1 : 0.7 }}>
              <View style={{ flexDirection: ROW, gap: 12, alignItems: 'center' }}>
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60, borderRadius: 10, backgroundColor: c.muted }} /> : null}
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: 'Inter_700Bold' }}>{item.name}</Txt>
                  <Txt muted style={{ fontSize: 14 }}>{catName(item.category)} - {(item.price / 100).toFixed(2)} ر.س</Txt>
                </View>
                <Switch value={item.available} disabled={toggle.isPending} onValueChange={(v) => toggle.mutate({ id: item.id, available: v })} trackColor={{ true: c.success, false: c.muted }} />
              </View>
              <View style={{ flexDirection: ROW, gap: 8 }}>
                <Btn style={{ flex: 1 }} tone="ghost" icon="edit" label="تعديل" onPress={() => edit(item)} />
                <Btn style={{ flex: 1 }} tone="ghost" icon="delete-outline" label="حذف" onPress={() => del(item)} />
                {cat !== 'all' && avail === 'all' ? (<>
                  <Btn tone="ghost" icon="arrow-upward" label="" disabled={reorder.isPending} onPress={() => move(item, -1)} style={{ width: 54, paddingHorizontal: 0 }} />
                  <Btn tone="ghost" icon="arrow-downward" label="" disabled={reorder.isPending} onPress={() => move(item, 1)} style={{ width: 54, paddingHorizontal: 0 }} />
                </>) : null}
              </View>
            </Card>)} />)}
      <Sheet visible={!!form} title={form?.id ? 'تعديل صنف' : 'صنف جديد'} onClose={() => { save.reset(); setForm(null); }}>
        {form && (<>
          <Field label="اسم الصنف" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="الفئة (معرّف)" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} />
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>{catList.map((n) => <Chip key={n.id} label={n.name} active={form.category === n.id} onPress={() => setForm({ ...form, category: n.id })} />)}</View>
          <Field label="السعر بالريال السعودي" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" placeholder="25.00" />
          <Field label="رابط الصورة" value={form.imageUrl} onChangeText={(v) => setForm({ ...form, imageUrl: v })} autoCapitalize="none" keyboardType="url" placeholder="https://" />
          <Field label="الخيارات (JSON)" hint="قائمة JSON. الأسعار الإضافية بالريال (تم تحويلها من الخادم)" value={form.options} onChangeText={(v) => setForm({ ...form, options: v })} multiline autoCapitalize="none" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
          <Field label="الأحجام (JSON)" hint="قائمة JSON. أسعار الأحجام بالريال (تم تحويلها من الخادم)" value={form.sizes} onChangeText={(v) => setForm({ ...form, sizes: v })} multiline autoCapitalize="none" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
            <Txt style={{ flex: 1 }}>متاح للطلب</Txt>
            <Switch value={form.available} onValueChange={(v) => setForm({ ...form, available: v })} trackColor={{ true: c.success, false: c.muted }} />
          </View>
          {save.isError ? <Notice tone="warn" text={errMsg(save.error)} /> : null}
          <Btn icon="save" label="حفظ" loading={save.isPending} onPress={() => save.mutate(form)} />
        </>)}
      </Sheet>
    </Screen>
  );
}
