import React from 'react';
import { Alert, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTerminal } from '../../lib/TerminalContext';
import { Btn, Card, Notice, Screen, Txt } from '../../components/ui';

const FAQ: [string, string][] = [
  ['لا تصل طلبات جديدة', 'افتح التشخيص وتأكد من اتصال الخادم. اسحب قائمة الطلبات للتحديث. التطبيق يحدّث الطلبات دوريا أثناء فتحه ولا يضمن العمل في الخلفية، لذلك أبقِ الشاشة مفتوحة وفعّل إبقاء الشاشة مضاءة من الإعدادات.'],
  ['لا تطبع الطابعة', 'من التشخيص اضغط طباعة تجريبية. إن فشلت فتحقق من الورق وغطاء الطابعة. يمكنك إعادة طباعة أي طلب من تفاصيله.'],
  ['الطباعة مكررة', 'القبول من التطبيق يطبع مرة واحدة. راجع عدد النسخ ونسخة المطبخ ونسخة العميل في الإعدادات.'],
  ['تم تسجيل الخروج', 'انتهت الجلسة. سجّل الدخول مرة أخرى بحساب الفرع.'],
  ['اللغة الإنجليزية', 'الواجهة عربية بالكامل حاليا. الإنجليزية غير متوفرة بشكل كامل ولم نضف ترجمة جزئية.'],
];

export default function HelpScreen() {
  const { settings } = useTerminal();
  const router = useRouter();
  const phone = settings.supportPhone.trim();
  const digits = phone.replace(/[^\d+]/g, '');
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('تعذر الفتح', 'لا يوجد تطبيق مناسب على الجهاز'));
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <Card>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 18 }}>التواصل مع الدعم</Txt>
          {phone ? (<>
            <Txt muted>{phone}</Txt>
            <Btn icon="call" label="اتصال" onPress={() => open(`tel:${digits}`)} />
            <Btn tone="success" icon="chat" label="واتساب" onPress={() => open(`https://wa.me/${digits.replace(/^\+/, '').replace(/^00/, '')}`)} />
          </>) : (<>
            <Notice tone="warn" text="لم يتم ضبط رقم الدعم. أدخله في الإعدادات ليظهر زرا الاتصال وواتساب." />
            <Btn tone="soft" icon="settings" label="فتح الإعدادات" onPress={() => router.navigate('/settings' as any)} />
          </>)}
        </Card>
        {FAQ.map(([q, a]) => <Card key={q}><Txt style={{ fontFamily: 'Inter_700Bold' }}>{q}</Txt><Txt muted>{a}</Txt></Card>)}
        <Btn tone="ghost" icon="school" label="الشروحات" onPress={() => router.navigate('/tutorials' as any)} />
      </ScrollView>
    </Screen>
  );
}
