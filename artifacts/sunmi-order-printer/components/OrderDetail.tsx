import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { waitForPrintStep } from '../lib/print-timeout';
import { getPrintedOrderIds } from '../lib/storage';
import { useTerminal } from '../lib/TerminalContext';
import { useColors } from '../hooks/useColors';
import type { Driver, Order } from '../lib/types';
import { ConversationSheet, DriverChangeDialog, DriverPicker, Toast } from './OrderDetailOverlays';
import { OrderDetailSheet } from './OrderDetailSheet';
import { StatusBadge } from './StatusBadge';
import { Btn, Card, Chip, dateOf, errMsg, Field, GOLD_SOFT, INK, Notice, payLabel, ROW, Txt } from './ui';

const MINUTES = [10, 15, 20, 30, 45, 60];
const REASONS = ['المطعم مزدحم', 'صنف غير متوفر', 'خارج نطاق التوصيل', 'بيانات الطلب غير واضحة'];
const BUSY_PREFIXES = ['انتظر انتهاء الطباعة الحالية', 'توجد محاولة طباعة جارية', 'توجد طباعة جارية'];
const isBusyPrint = (e: unknown) => e instanceof Error && BUSY_PREFIXES.some((p) => e.message.startsWith(p));

export function OrderDetail({ order, onClose, readOnly }: { order: Order | null; onClose: () => void; readOnly?: boolean }) {
  const c = useColors();
  const qc = useQueryClient();
  const t = useTerminal();
  const [minutes, setMinutes] = useState(20);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [candidate, setCandidate] = useState<{ id: string; name: string } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const gen = useRef(0);
  const opLock = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const id = order?.id ?? '';
  const live = t.orders.find((o) => o.id === id) ?? order;
  const drivers = useQuery({ queryKey: ['drivers'], queryFn: api.getDrivers, enabled: !!order && (pickerOpen || changeOpen), refetchInterval: 10000 });
  const assign = useQuery({ queryKey: ['assignment', id], queryFn: () => api.getAssignment(id), enabled: !!order, refetchInterval: 5000 });

  const clearToast = () => { if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; } setToast(null); };
  const reset = () => {
    gen.current += 1; opLock.current = false; clearToast();
    setMinutes(20); setReason(''); setRejecting(false); setReprintReason(''); setBusy(null); setErr(null);
    setChatOpen(false); setPickerOpen(false); setChangeOpen(false); setCandidate(null); setAssigningId(null); setAssignErr(null);
  };
  useEffect(() => { reset(); }, [id]);
  useEffect(() => () => { gen.current += 1; if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => { toastTimer.current = null; setToast(null); }, 3000);
  };
  const close = () => { reset(); onClose(); };

  if (!order || !live) return null;
  const o = live;
  const mine = t.actions.filter((a) => a.orderId === o.id);
  const label = (k: string) => (k === 'accepted' ? 'قبول' : k === 'rejected' ? 'رفض' : 'سائق');
  const isDelivery = o.orderType === 'delivery';
  const assigned = assign.data?.driver ?? null;
  const driverName = assigned?.name ?? o.driverName ?? null;
  const hasDriver = !!driverName;

  const run = async (key: string, fn: (g: number) => Promise<void>) => {
    if (opLock.current) return;
    opLock.current = true;
    const g = gen.current;
    setBusy(key); setErr(null);
    try { await fn(g); } catch (e) {
      if (g === gen.current) {
        if (isBusyPrint(e)) showToast('الطابعة مشغولة بطباعة جارية. أعد المحاولة بعد انتهائها.');
        else {
          setErr(errMsg(e));
          Alert.alert('تعذر تنفيذ الإجراء', errMsg(e));
        }
      }
    } finally {
      if (g === gen.current) { opLock.current = false; setBusy(null); }
    }
  };

  const setS = (s: Order['status'], k: string) => run(k, async () => { await t.setStatus(o, s); });
  const printInvoice = () => run('print', async () => { await t.print(o, reprintReason.trim() || undefined); });
  const acceptOrder = () => run('accept', async (g) => {
    // Acceptance wakes the existing auto-print drain. Submit while still pending
    // and consult its existing history, rather than racing it with a second job.
    const printed = await waitForPrintStep(() => getPrintedOrderIds(), 3000, 'تعذرت قراءة سجل الطباعة في الوقت المحدد');
    if (g !== gen.current) return;
    if (!printed.includes(String(o.id))) await t.print(o);
    if (g !== gen.current) return;
    await t.accept(o, minutes);
    if (g === gen.current && isDelivery) { setAssignErr(null); setPickerOpen(true); }
  });

  const doAssign = async (d: { id: string; name: string }) => {
    if (opLock.current) return;
    opLock.current = true;
    const g = gen.current;
    setAssigningId(d.id); setAssignErr(null);
    try {
      await t.recordDriverAssignment(o, d.id, d.name);
      void qc.invalidateQueries({ queryKey: ['assignment', o.id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      if (g === gen.current) { setCandidate(null); setPickerOpen(false); setChangeOpen(false); }
    } catch (e) {
      if (g === gen.current) {
        setCandidate(null); setAssignErr(errMsg(e));
        Alert.alert('تعذر إسناد السائق', errMsg(e));
      }
    } finally {
      if (g === gen.current) { opLock.current = false; setAssigningId(null); }
    }
  };
  const pick = (d: Driver) => {
    if (opLock.current || assign.isPending || assign.isError || !d.active || !d.isOnline || String(assigned?.id) === d.id) return;
    if (hasDriver) { setCandidate({ id: d.id, name: d.name }); setChangeOpen(true); }
    else void doAssign({ id: d.id, name: d.name });
  };
  const selectReplacement = (d: Driver) => {
    if (opLock.current || assign.isPending || assign.isError || !d.active || !d.isOnline || String(assigned?.id) === d.id) return;
    setCandidate({ id: d.id, name: d.name });
  };
  const selectedDriver = (drivers.data ?? []).find(d => d.id === candidate?.id);
  const canConfirm = !!selectedDriver?.active && !!selectedDriver.isOnline && String(assigned?.id) !== selectedDriver.id && !assign.isPending && !assign.isError;
  const driverLoading = drivers.isLoading || assign.isPending;
  const driverError = assign.isError ? errMsg(assign.error) : drivers.isError ? errMsg(drivers.error) : null;
  const retryDrivers = () => { void drivers.refetch(); void assign.refetch(); };

  const finished = o.status === 'done' || o.status === 'cancelled';
  const driverWarning = finished
    ? 'هذا طلب منتهٍ أو ملغي. سيعاد تعيين مندوبه وإشعار المندوب الجديد، دون إعادة فتح الطلب أو تغيير حالته.'
    : o.status === 'pending'
      ? 'التعيين يبدأ مسار التوصيل في الخادم. سيبقى تنبيه القبول على هذه الطابعة حتى تضغط قبول.'
      : 'سيتم تغيير المندوب وإشعار المندوب الجديد.';
  const notes: string[] = [];
  if (finished) notes.push('هذا لا يعيد فتح الطلب المنتهي أو الملغي، لكنه يعيد تعيين المندوب ويشعره.');
  if (o.status === 'pending') notes.push(driverWarning);
  const disabled = busy !== null || assigningId !== null;

  return (
    <OrderDetailSheet visible title={`طلب #${o.dailyNumber}`} badge={<StatusBadge status={o.status} />} onClose={close}
      overlay={<Toast text={toast} />}
      footer={
        <View style={{ flexDirection: ROW, gap: 8, alignItems: 'center' }}>
          <Btn testID="print-invoice" icon="print" label="طباعة الفاتورة" loading={busy === 'print'} disabled={disabled} onPress={() => void printInvoice()} style={{ flex: 1, minHeight: 56 }} />
          <Pressable testID="chat-customer" accessibilityRole="button" accessibilityLabel="محادثة العميل" disabled={disabled} accessibilityState={{ disabled }} onPress={() => setChatOpen(true)}
            style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: c.primary, backgroundColor: GOLD_SOFT, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}>
            <MaterialIcons name="chat-bubble-outline" size={24} color={INK} />
          </Pressable>
        </View>
      }>
      {err ? <Notice tone="warn" text={err} /> : null}

      <Card>
        <Txt style={{ fontFamily: 'Inter_700Bold' }}>{o.customerName}</Txt>
        <Txt muted>{o.customerPhone}</Txt>
        {o.customerAddress ? <Txt muted>{o.customerAddress}</Txt> : null}
        <Txt muted>{dateOf(o.createdAt)} - {isDelivery ? 'توصيل' : 'استلام'} - {payLabel(o.paymentMethod)}</Txt>
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

      {isDelivery ? (
        <Card>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
            <Txt style={{ flex: 1 }}>السائق: {hasDriver ? driverName : 'غير معيّن'}</Txt>
            <Btn testID="open-driver-picker" tone="soft" label={hasDriver ? 'تغيير' : 'تعيين'} disabled={disabled}
              onPress={() => {
                setAssignErr(null); setCandidate(null);
                if (hasDriver) setChangeOpen(true); else setPickerOpen(true);
              }} style={{ minHeight: 48, minWidth: 96 }} />
          </View>
        </Card>
      ) : null}

      {!readOnly && t.needsAcceptance(o) && (<Card>
        <Txt style={{ fontFamily: 'Inter_700Bold' }}>وقت التحضير بالدقائق</Txt>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {MINUTES.map((m) => <Chip key={m} label={`${m}`} active={minutes === m} onPress={() => setMinutes(m)} />)}
        </View>
        <Txt muted style={{ fontSize: 13 }}>يحفظ وقت التحضير في سجل هذا الجهاز فقط ولا يظهر للعميل.</Txt>
        <Btn testID="accept-order" tone="success" icon="check" label="قبول الطلب" loading={busy === 'accept'} disabled={disabled} onPress={() => void acceptOrder()} />
        {!rejecting ? <Btn tone="danger" icon="close" label="رفض الطلب" disabled={disabled} onPress={() => setRejecting(true)} /> : (<>
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>{REASONS.map((r) => <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />)}</View>
          <Field label="سبب الرفض (محفوظ على هذا الجهاز فقط)" value={reason} onChangeText={setReason} />
          <Btn tone="danger" label="تأكيد الرفض" loading={busy === 'reject'} disabled={disabled || !reason.trim()} onPress={() => void run('reject', async (g) => { await t.reject(o, reason.trim()); if (g === gen.current) close(); })} />
        </>)}
      </Card>)}

      {!readOnly && (
        <View style={{ gap: 10 }}>
          {o.status === 'preparing' && <Btn tone="success" icon="done-all" label="الطلب جاهز" loading={busy === 'ready'} disabled={disabled} onPress={() => void setS('ready', 'ready')} />}
          {o.status === 'ready' && <Btn tone="success" icon="check-circle" label={isDelivery ? 'تسليم للسائق' : 'تم التسليم للعميل'} loading={busy === 'done'} disabled={disabled} onPress={() => void setS('done', 'done')} />}
          {o.status === 'ready' && isDelivery ? <Txt muted style={{ fontSize: 13 }}>للتوصيل: هذا الإجراء يعني تسليم الطلب للسائق ويبدأ مسار التوصيل. حالة وصوله للعميل يحددها السائق من تطبيقه.</Txt> : null}
        </View>)}

      {mine.length > 0 && (
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold' }}>سجل هذا الجهاز فقط</Txt>
          {mine.map((a, k) => <Txt key={k} muted style={{ fontSize: 14 }}>{label(a.kind)}: {a.detail} - {dateOf(a.createdAt)}</Txt>)}
        </Card>)}

      <Card>
        <Txt style={{ fontFamily: 'Inter_700Bold' }}>الطباعة اليدوية</Txt>
        <Field label="سبب إعادة الطباعة (اختياري)" value={reprintReason} onChangeText={setReprintReason} placeholder="مثال: نفد الورق" />
      </Card>

      <DriverPicker visible={pickerOpen} drivers={drivers.data} loading={driverLoading}
        error={driverError} onRetry={retryDrivers}
        currentId={assigned ? String(assigned.id) : null} busyId={assigningId} assignError={assignErr} notes={notes}
        onAssign={pick} onSkip={() => setPickerOpen(false)} onBack={() => setPickerOpen(false)} />
      <DriverChangeDialog visible={changeOpen} name={candidate?.name ?? null} warning={driverWarning} pending={assigningId !== null}
        drivers={drivers.data} loading={driverLoading} error={driverError} onRetry={retryDrivers}
        currentId={assigned ? String(assigned.id) : null} busyId={assigningId} selectedId={candidate?.id ?? null}
        assignError={assignErr} canConfirm={canConfirm} onAssign={selectReplacement}
        onConfirm={() => { if (candidate && canConfirm && !driverLoading && !driverError) void doAssign(candidate); }}
        onCancel={() => { if (assigningId === null) { setCandidate(null); setChangeOpen(false); } }} />
      <ConversationSheet visible={chatOpen} orderId={o.id} title={`محادثة طلب #${o.dailyNumber}`} onClose={() => setChatOpen(false)} />
    </OrderDetailSheet>
  );
}
