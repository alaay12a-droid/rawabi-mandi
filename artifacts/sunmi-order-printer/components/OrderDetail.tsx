import React, { useEffect, useState } from 'react';
import { Alert, View, useWindowDimensions } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useTerminal } from '../lib/TerminalContext';
import { useColors } from '../hooks/useColors';
import type { Order } from '../lib/types';
import { Conversation } from './Conversation';
import { StatusBadge } from './StatusBadge';
import { Btn, Card, Chip, dateOf, errMsg, Field, Notice, payLabel, ROW, Sheet, Txt } from './ui';

const MINUTES = [10, 15, 20, 30, 45, 60];
const REASONS = ['المطعم مزدحم', 'صنف غير متوفر', 'خارج نطاق التوصيل', 'بيانات الطلب غير واضحة'];

export function OrderDetail({ order, onClose, readOnly }: { order: Order | null; onClose: () => void; readOnly?: boolean }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const t = useTerminal();
  const [minutes, setMinutes] = useState(20);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const [tab, setTab] = useState<'order' | 'driver' | 'chat'>('order');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [driverCandidate, setDriverCandidate] = useState<{ id: string; name: string } | null>(null);

  const id = order?.id ?? '';
  const live = t.orders.find((o) => o.id === id) ?? order;
  const drivers = useQuery({ queryKey: ['drivers'], queryFn: api.getDrivers, enabled: !!order && tab === 'driver', refetchInterval: 10000 });
  const assign = useQuery({ queryKey: ['assignment', id], queryFn: () => api.getAssignment(id), enabled: !!order && tab === 'driver', refetchInterval: 5000 });
  const doAssign = useMutation({
    mutationFn: async (d: { id: string; name: string }) => { if (live) await t.recordDriverAssignment(live, d.id, d.name); },
    onSuccess: () => { setDriverCandidate(null); void qc.invalidateQueries({ queryKey: ['assignment', id] }); void qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (e) => { setErr(errMsg(e)); Alert.alert('تعذر إسناد السائق', errMsg(e)); },
  });

  useEffect(() => { setMinutes(20); setReason(''); setRejecting(false); setReprintReason(''); setTab('order'); setBusy(null); setErr(null); setDriverCandidate(null); }, [id]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null);
    try { await fn(); } catch (e) { setErr(errMsg(e)); Alert.alert('تعذر تنفيذ الإجراء', errMsg(e)); } finally { setBusy(null); }
  };
  const close = () => { setErr(null); setRejecting(false); setReason(''); setReprintReason(''); setDriverCandidate(null); setTab('order'); onClose(); };

  if (!order || !live) return null;
  const o = live;
  const mine = t.actions.filter((a) => a.orderId === o.id);
  const label = (k: string) => (k === 'accepted' ? 'قبول' : k === 'rejected' ? 'رفض' : 'سائق');
  const disabled = busy !== null;
  const setS = (s: Order['status'], k: string) => run(k, async () => { await t.setStatus(o, s); });
  const printInvoice = () => run('print', async () => {
    await t.print(o, reprintReason.trim() || undefined);
    Alert.alert('تم الإرسال للطابعة', 'أُرسلت الفاتورة إلى الطابعة. تحقق من خروج الورق.');
  });
  const driverWarning = o.status === 'done' || o.status === 'cancelled'
      ? 'هذا طلب منتهٍ أو ملغي. سيعاد تعيين مندوبه وإشعار المندوب الجديد، دون إعادة فتح الطلب أو تغيير حالته.'
      : o.status === 'pending'
        ? 'التعيين يبدأ مسار التوصيل في الخادم. سيبقى تنبيه القبول على هذه الطابعة حتى تضغط قبول.'
        : 'سيتم تغيير المندوب وإشعار المندوب الجديد.';

  return (
    <Sheet visible title={`طلب #${o.dailyNumber}`} onClose={close} footer={
      <View style={{ flexDirection: width < 360 ? 'column' : ROW, gap: 8 }}>
        <Btn testID="print-invoice" icon="print" label="طباعة الفاتورة" loading={busy === 'print'} disabled={disabled || doAssign.isPending} onPress={() => void printInvoice()} style={{ flexGrow: 1, flexBasis: width < 360 ? undefined : 0, minHeight: 56 }} />
        {o.orderType === 'delivery' ? <Btn testID="change-driver" tone="soft" icon="swap-horiz" label="تغيير السائق" disabled={disabled || doAssign.isPending} onPress={() => setTab('driver')} style={{ flexGrow: 1, flexBasis: width < 360 ? undefined : 0, minHeight: 56 }} /> : null}
      </View>
    }>
      <View style={{ flexDirection: ROW, gap: 8, flexWrap: 'wrap' }}>
        <Chip label="الطلب" active={tab === 'order'} onPress={() => setTab('order')} />
        <Chip label="السائق" active={tab === 'driver'} onPress={() => setTab('driver')} />
        <Chip label="المحادثة" active={tab === 'chat'} onPress={() => setTab('chat')} />
      </View>

      {err ? <Notice tone="warn" text={err} /> : null}

      {tab === 'order' && (<>
        <Card>
          <View style={{ flexDirection: ROW, alignItems: 'center' }}>
            <Txt style={{ flex: 1, fontFamily: 'Inter_700Bold' }}>{o.customerName}</Txt>
            <StatusBadge status={o.status} />
          </View>
          <Txt muted>{o.customerPhone}</Txt>
          {o.customerAddress ? <Txt muted>{o.customerAddress}</Txt> : null}
          <Txt muted>{dateOf(o.createdAt)} - {o.orderType === 'delivery' ? 'توصيل' : 'استلام'} - {payLabel(o.paymentMethod)}</Txt>
          {o.driverName ? <Txt>السائق: {o.driverName}</Txt> : null}
        </Card>
        <Card>
          {o.items.map((i, k) => (
            <View key={`${i.id}-${k}`} style={{ gap: 2 }}>
              <View style={{ flexDirection: ROW, gap: 8 }}>
                <Txt style={{ color: c.primary, fontFamily: 'Inter_700Bold', minWidth: 34 }}>{i.quantity}x</Txt>
                <Txt style={{ flex: 1 }}>{i.name}</Txt>
                <Txt>{formatMoney(i.price * i.quantity)}</Txt>
              </View>
              {i.customization?.size ? <Txt muted style={{ fontSize: 14 }}>الحجم: {i.customization.size}</Txt> : null}
              {i.customization?.variantName ? <Txt muted style={{ fontSize: 14 }}>{i.customization.variantName}</Txt> : null}
              {(i.customization?.selectedOptions ?? []).map((so, j) => <Txt key={j} muted style={{ fontSize: 14 }}>{so.groupName}: {so.choice}</Txt>)}
              {i.notes ? <Txt muted style={{ fontSize: 14 }}>ملاحظة: {i.notes}</Txt> : null}
            </View>))}
          <View style={{ height: 1, backgroundColor: c.border }} />
          {o.deliveryFee > 0 ? <Txt muted>رسوم التوصيل: {formatMoney(o.deliveryFee)}</Txt> : null}
          {o.discountAmount > 0 ? <Txt muted>الخصم: {formatMoney(o.discountAmount)}</Txt> : null}
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 20 }}>الإجمالي: {formatMoney(o.totalPrice)}</Txt>
          {o.notes ? <Notice text={`ملاحظات الطلب: ${o.notes}`} /> : null}
        </Card>

        {mine.length > 0 && (
          <Card>
            <Txt style={{ fontFamily: 'Inter_700Bold' }}>سجل هذا الجهاز فقط</Txt>
            {mine.map((a, k) => <Txt key={k} muted style={{ fontSize: 14 }}>{label(a.kind)}: {a.detail} - {dateOf(a.createdAt)}</Txt>)}
          </Card>)}

        {!readOnly && t.needsAcceptance(o) && (<Card>
          <Txt style={{ fontFamily: 'Inter_700Bold' }}>وقت التحضير بالدقائق</Txt>
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
            {MINUTES.map((m) => <Chip key={m} label={`${m}`} active={minutes === m} onPress={() => setMinutes(m)} />)}
          </View>
          <Txt muted style={{ fontSize: 13 }}>يحفظ وقت التحضير في سجل هذا الجهاز فقط ولا يظهر للعميل.</Txt>
          <Btn tone="success" icon="check" label="قبول وبدء التحضير" loading={busy === 'accept'} disabled={disabled} onPress={() => run('accept', async () => { await t.accept(o, minutes); close(); })} />
          {!rejecting ? <Btn tone="danger" icon="close" label="رفض الطلب" disabled={disabled} onPress={() => setRejecting(true)} /> : (<>
            <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>{REASONS.map((r) => <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />)}</View>
            <Field label="سبب الرفض (محفوظ على هذا الجهاز فقط)" value={reason} onChangeText={setReason} />
            <Btn tone="danger" label="تأكيد الرفض" loading={busy === 'reject'} disabled={disabled || !reason.trim()} onPress={() => run('reject', async () => { await t.reject(o, reason.trim()); close(); })} />
          </>)}
        </Card>)}

        {!readOnly && (
          <View style={{ gap: 10 }}>
            {o.status === 'preparing' && <Btn tone="success" icon="done-all" label="الطلب جاهز" loading={busy === 'ready'} disabled={disabled} onPress={() => setS('ready', 'ready')} />}
            {o.status === 'ready' && <Btn tone="success" icon="check-circle" label={o.orderType === 'delivery' ? 'تسليم للسائق' : 'تم التسليم للعميل'} loading={busy === 'done'} disabled={disabled} onPress={() => setS('done', 'done')} />}
            {o.status === 'ready' && o.orderType === 'delivery' ? <Txt muted style={{ fontSize: 13 }}>للتوصيل: هذا الإجراء يعني تسليم الطلب للسائق ويبدأ مسار التوصيل. حالة وصوله للعميل يحددها السائق من تطبيقه.</Txt> : null}
          </View>)}

        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold' }}>الطباعة اليدوية</Txt>
          <Field label="سبب إعادة الطباعة (اختياري)" value={reprintReason} onChangeText={setReprintReason} placeholder="مثال: نفد الورق" />
          <Txt muted style={{ fontSize: 13 }}>زر طباعة الفاتورة ثابت أسفل الشاشة في جميع التبويبات، بما فيها الطلبات السابقة والملغاة.</Txt>
        </Card>
      </>)}

      {tab === 'driver' && (<>
        {o.status === 'done' || o.status === 'cancelled' ? <Notice tone="warn" text="يمكن تغيير السائق بعد التأكيد. هذا لا يعيد فتح الطلب المنتهي أو الملغي، لكنه يعيد تعيين المندوب ويشعره." /> : null}
        {o.orderType !== 'delivery' ? <Notice text="هذا طلب استلام ولا يحتاج إلى سائق." /> : null}
        {driverCandidate ? <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold' }}>تأكيد تغيير السائق إلى {driverCandidate.name}</Txt>
          <Notice tone="warn" text={driverWarning} />
          <Btn testID="confirm-driver-change" label="تأكيد تغيير السائق" loading={doAssign.isPending} disabled={disabled} onPress={() => doAssign.mutate(driverCandidate)} />
          <Btn tone="ghost" label="رجوع بدون تغيير" disabled={doAssign.isPending} onPress={() => setDriverCandidate(null)} />
        </Card> : null}
        {assign.data ? <Card><Txt style={{ fontFamily: 'Inter_700Bold' }}>السائق الحالي: {assign.data.driver?.name ?? 'غير معروف'}</Txt><Txt muted>الحالة: {assign.data.assignment.status}</Txt></Card> : assign.isSuccess ? <Notice text="لم يسند سائق لهذا الطلب بعد." /> : null}
        {assign.isError ? <Txt style={{ color: c.destructive }}>{errMsg(assign.error)}</Txt> : null}
        {drivers.isError ? <Txt style={{ color: c.destructive }}>{errMsg(drivers.error)}</Txt> : null}
        {(drivers.data ?? []).filter((d) => d.active).map((d) => (
          <Card key={d.id}>
            <View style={{ flexDirection: ROW, flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}><Txt style={{ fontFamily: 'Inter_700Bold' }}>{d.name}</Txt><Txt muted style={{ fontSize: 14 }}>{d.phone} - {d.isOnline ? 'متصل' : 'غير متصل'}</Txt></View>
              <Btn label={String(assign.data?.driver?.id) === d.id ? 'السائق الحالي' : 'تعيين هذا السائق'} tone="soft" disabled={doAssign.isPending || disabled || o.orderType !== 'delivery' || !d.isOnline || String(assign.data?.driver?.id) === d.id} onPress={() => setDriverCandidate({ id: d.id, name: d.name })} />
            </View>
          </Card>))}
        {drivers.isSuccess && (drivers.data ?? []).filter((d) => d.active).length === 0 ? <Notice text="لا يوجد سائقون نشطون. أضفهم من صفحة السائقين." /> : null}
        <Txt muted style={{ fontSize: 13 }}>سجل الإسناد في الإشعارات محلي لهذا الجهاز، أما الإسناد نفسه فيُحفظ في الخادم.</Txt>
      </>)}

      {tab === 'chat' && <Conversation orderId={o.id} />}
    </Sheet>
  );
}
