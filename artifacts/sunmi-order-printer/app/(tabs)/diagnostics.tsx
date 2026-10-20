import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getLastPrinterError, printTest } from '../../lib/printer';
import { useTerminal } from '../../lib/TerminalContext';
import { Btn, Card, errMsg, Notice, Screen, timeOf, Txt } from '../../components/ui';
import { useColors } from '../../hooks/useColors';

export default function DiagnosticsScreen() {
  const c = useColors();
  const t = useTerminal();
  const api_ = useQuery({ queryKey: ['diag-api'], queryFn: () => api.getBranchStatus(), retry: false });
  const [printing, setPrinting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; at: string } | null>(null);
  const test = async () => {
    setPrinting(true);
    try {
      const ok = await printTest();
      setResult({ ok, msg: ok ? 'أرسلت صفحة الاختبار إلى طابعة Sunmi V3. تحقق من خروج الورقة.' : (getLastPrinterError() ?? 'فشلت الطباعة التجريبية. تحقق من الورق والغطاء'), at: new Date().toISOString() });
    } catch (e) { setResult({ ok: false, msg: errMsg(e), at: new Date().toISOString() }); }
    finally { setPrinting(false); }
  };
  const apiOk = api_.isSuccess;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <Card style={{ borderColor: apiOk ? c.success : api_.isLoading ? c.border : c.destructive }}>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }}>اتصال الخادم</Txt>
          <Txt>{api_.isLoading ? 'جاري الفحص...' : apiOk ? 'الخادم متاح ويستجيب' : `تعذر الاتصال: ${errMsg(api_.error)}`}</Txt>
          <Txt muted style={{ fontSize: 14 }}>طلبات اليوم: {t.connected ? 'متصلة' : 'متقطعة'} - آخر مزامنة: {t.lastSync ? timeOf(t.lastSync) : 'لا توجد'}</Txt>
          {t.ordersError ? <Txt style={{ color: c.destructive, fontSize: 14 }}>{t.ordersError}</Txt> : null}
          <Btn tone="ghost" icon="refresh" label="إعادة فحص الخادم" loading={api_.isFetching} onPress={() => { void api_.refetch(); t.refreshOrders().catch(() => undefined); }} />
        </Card>
        <Card style={{ borderColor: result ? (result.ok ? c.success : c.destructive) : c.border }}>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }}>الطابعة</Txt>
          <Txt muted>النوع: Sunmi V3 المدمجة - الورق {t.settings.paperWidth} مم - {t.settings.copies} نسخة</Txt>
          <Txt>{result ? result.msg : 'لم يتم إجراء اختبار في هذه الجلسة. حالة الطابعة منفصلة عن الخادم.'}</Txt>
          {result ? <Txt muted style={{ fontSize: 13 }}>آخر اختبار: {timeOf(result.at)}</Txt> : null}
          <Btn icon="print" label="طباعة تجريبية" loading={printing} onPress={() => void test()} />
        </Card>
        <Notice text="التطبيق يحدّث الطلبات دوريا أثناء فتحه فقط. لا يوجد WebSocket ولا ضمان للعمل في الخلفية." />
      </ScrollView>
    </Screen>
  );
}
