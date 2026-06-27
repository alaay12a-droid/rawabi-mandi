# دليل رفع تطبيق روابي المندي على Google Play

## ما تم إعداده تلقائياً ✅

| العنصر | الحالة | التفاصيل |
|--------|--------|----------|
| أيقونة التطبيق | ✅ جاهز | 1024×1024 RGBA |
| الأيقونة التكيفية (Adaptive Icon) | ✅ جاهز | 1024×1024 RGBA |
| أيقونة الإشعارات | ✅ جاهز | 96×96 بيضاء شفافة |
| Feature Graphic | ✅ جاهز | 1024×500 (في assets/store/) |
| اسم الحزمة | ✅ جاهز | com.rawabialmandi.app |
| إصدار التطبيق | ✅ جاهز | 1.0.0 (versionCode: 1) |
| Android SDK | ✅ جاهز | min:26 / target:35 |
| EAS Build | ✅ جاهز | ملف eas.json محضّر |

---

## الخطوات المطلوبة منك

### الخطوة 1: نشر الـ API على Replit
- اضغط **Deploy** في Replit
- بعد النشر ستحصل على رابط مثل: `https://rawabi-menu-xxx.replit.app`
- شغّل الأمر التالي لتحديث رابط الإنتاج:
```bash
cd artifacts/rawabi-menu
bash set-production-url.sh https://YOUR_DEPLOYED_URL.replit.app
```

### الخطوة 2: تثبيت EAS CLI وتسجيل الدخول
```bash
npm install -g eas-cli
eas login
# اسم المستخدم: 021837ala
```

### الخطوة 3: بناء التطبيق (AAB)
```bash
cd artifacts/rawabi-menu
eas build --platform android --profile production
```
⏱️ يستغرق حوالي 10-15 دقيقة — EAS يبني على السحابة تلقائياً ولا تحتاج Android Studio

### الخطوة 4: رفع الـ AAB على Google Play Console
**يدوياً:**
1. افتح [play.google.com/console](https://play.google.com/console)
2. أنشئ تطبيقاً جديداً باسم "روابي المندي"
3. اذهب لـ **Production** ← **Create new release**
4. ارفع ملف `.aab` الذي أنتجه EAS
5. أضف **Feature Graphic** من `assets/store/feature_graphic.jpg`

**أو تلقائياً عبر EAS Submit:**
```bash
# احصل على ملف google-service-account.json من Google Play Console
# ضعه في مجلد artifacts/rawabi-menu/
eas submit --platform android --profile production
```

---

## معلومات التطبيق للـ Play Store

- **اسم التطبيق:** روابي المندي
- **اسم الحزمة:** com.rawabialmandi.app
- **الفئة:** Food & Drink
- **التصنيف:** للجميع (Everyone)
- **اللغة الرئيسية:** العربية

## وصف التطبيق (جاهز للنسخ)

**عربي:**
```
تطبيق روابي المندي — اطلب وجبتك المفضلة من مطعم روابي المندي في تبوك بكل سهولة.
تصفّح القائمة الكاملة، اختر وجبتك، وتتبع طلبك لحظة بلحظة حتى يصل إلى بابك.
```

---

## ملاحظات مهمة
- عند كل تحديث للتطبيق: زِد `versionCode` بمقدار 1 في `app.json`
- رابط الـ API في `eas.json` يجب أن يكون رابط Replit المنشور (ليس Dev)
- لا تحتاج Google Services JSON ما لم تستخدم Firebase مباشرة
