import React from 'react';
import { ScrollView, View } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { Card, INK, ROW, Screen, Txt } from '../../components/ui';

const GUIDES: { title: string; steps: string[] }[] = [
  { title: 'استقبال طلب جديد', steps: ['افتح طلبات اليوم وستجد الطلب تحت جديدة.', 'اضغط على البطاقة لعرض التفاصيل والملاحظات.', 'اختر وقت التحضير ثم اضغط قبول، وسيُطبع الطلب حسب إعدادات الطباعة.', 'لرفض الطلب اختر السبب ثم أكد الرفض. السبب ووقت التحضير يحفظان على هذا الجهاز فقط.'] },
  { title: 'من التحضير إلى التسليم', steps: ['عند انتهاء المطبخ اضغط الطلب جاهز.', 'طلب الاستلام: اضغط تم التسليم للعميل عند استلامه.', 'طلب التوصيل: أسند سائقا من تبويب السائق ثم اضغط خرج للتوصيل وبعدها تأكيد التوصيل.'] },
  { title: 'إعادة الطباعة', steps: ['افتح تفاصيل الطلب من اليوم أو من الطلبات السابقة.', 'اكتب سبب إعادة الطباعة إن رغبت ثم اضغط طباعة.', 'تأكد من الورق إن لم تخرج النسخة، وجرب الطباعة التجريبية من التشخيص.'] },
  { title: 'إدارة الأصناف', steps: ['من قائمة الأصناف اختر فئة لتصفية الأصناف.', 'استخدم المفتاح لإيقاف صنف نفد، أو إيقاف الفئة كاملة دفعة واحدة.', 'السعر يكتب بالريال، والخيارات والأحجام تكتب كقائمة JSON.'] },
  { title: 'ساعات العمل', steps: ['فعّل الجدول الأسبوعي وحدد وقت الفتح والإغلاق لكل يوم بصيغة 24 ساعة مثل 09:00.', 'أوقف اليوم ليكون إجازة، ثم احفظ.', 'الفترات المتعددة والإغلاق المؤقت المجدول غير مدعومين حاليا.'] },
  { title: 'التواصل مع العميل', steps: ['افتح تفاصيل الطلب ثم تبويب المحادثة، أو افتح رسائل العملاء.', 'الرسائل غير المقروءة تظهر بعدد أحمر وتُعلَّم كمقروءة عند فتح المحادثة.'] },
];

export default function TutorialsScreen() {
  const c = useColors();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        {GUIDES.map((g, i) => (
          <Card key={g.title}>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ color: c.primary, textAlign: 'center', fontFamily: 'Inter_700Bold' }}>{i + 1}</Txt></View>
              <Txt style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 17 }}>{g.title}</Txt>
            </View>
            {g.steps.map((s, k) => <Txt key={k} muted>{k + 1}. {s}</Txt>)}
          </Card>))}
      </ScrollView>
    </Screen>
  );
}
