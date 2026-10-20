import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { useTerminal } from '../../lib/TerminalContext';
import type { Settings } from '../../lib/types';
import { useColors } from '../../hooks/useColors';
import { Btn, Card, Chip, errMsg, Field, Notice, ROW, Screen, Txt } from '../../components/ui';

export default function SettingsScreen() {
  const c = useColors();
  const { settings, updateSettings } = useTerminal();
  const [store, setStore] = useState(settings.storeName);
  const [phone, setPhone] = useState(settings.supportPhone);
  useEffect(() => { setStore(settings.storeName); setPhone(settings.supportPhone); }, [settings.storeName, settings.supportPhone]);
  const set = (p: Partial<Settings>) => updateSettings(p).catch((e) => Alert.alert('تعذر حفظ الإعداد', errMsg(e)));
  const Row = ({ k, label, hint }: { k: 'soundEnabled' | 'autoPrint' | 'kitchenCopy' | 'customerCopy' | 'keepAwake'; label: string; hint?: string }) => (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12, minHeight: 54 }}>
      <View style={{ flex: 1 }}><Txt style={{ fontFamily: 'Inter_600SemiBold' }}>{label}</Txt>{hint ? <Txt muted style={{ fontSize: 13 }}>{hint}</Txt> : null}</View>
      <Switch value={settings[k]} onValueChange={(v) => void set({ [k]: v })} trackColor={{ true: c.success, false: c.muted }} />
    </View>
  );
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Notice text="كل هذه الإعدادات محلية على هذا الجهاز فقط ولا تغيّر إعدادات الخادم أو الإسناد التلقائي." />
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 17 }}>التنبيهات</Txt>
          <Notice text="تنبيه الطلبات الجديدة إلزامي ومتكرر حتى القبول. يعمل بأقصى مستوى داخل التطبيق؛ ارفع صوت الوسائط من أزرار جهاز Sunmi لأعلى مستوى. الطلب الملغي لا يستمر تنبيهه." />
          <Row k="keepAwake" label="إبقاء الشاشة مضاءة" hint="يساعد على وصول الطلبات لأن التطبيق لا يعمل في الخلفية" />
        </Card>
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 17 }}>الطباعة</Txt>
          <Txt muted style={{ fontSize: 14 }}>الطابعة: Sunmi V3 المدمجة</Txt>
          <Row k="autoPrint" label="طباعة تلقائية للطلبات قيد التحضير" />
          <Row k="kitchenCopy" label="نسخة المطبخ" />
          <Row k="customerCopy" label="نسخة العميل" />
          <Txt style={{ fontFamily: 'Inter_600SemiBold' }}>عرض الورق</Txt>
          <View style={{ flexDirection: ROW, gap: 8 }}>{([58, 80] as const).map((w) => <Chip key={w} label={`${w} مم`} active={settings.paperWidth === w} onPress={() => void set({ paperWidth: w })} />)}</View>
          <Txt style={{ fontFamily: 'Inter_600SemiBold' }}>عدد النسخ</Txt>
          <View style={{ flexDirection: ROW, gap: 8, flexWrap: 'wrap' }}>{[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={`${n}`} active={settings.copies === n} onPress={() => void set({ copies: n })} />)}</View>
        </Card>
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 17 }}>المتجر</Txt>
          <Field label="اسم المتجر على الإيصال" value={store} onChangeText={setStore} />
          <Field label="رقم الدعم (يستخدم في زري الاتصال وواتساب)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+9665XXXXXXXX" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
          <Btn tone="soft" icon="save" label="حفظ بيانات المتجر" onPress={() => void set({ storeName: store.trim(), supportPhone: phone.trim() })} />
        </Card>
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 17 }}>اللغة</Txt>
          <Txt muted>العربية هي لغة التطبيق. الإنجليزية غير متوفرة بشكل كامل حاليا، لذلك لا يوجد مفتاح تبديل يعرض ترجمة ناقصة.</Txt>
        </Card>
      </ScrollView>
    </Screen>
  );
}
