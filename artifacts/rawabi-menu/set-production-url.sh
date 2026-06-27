#!/bin/bash
# تشغيل هذا السكريبت بعد نشر التطبيق على Replit لتحديث رابط API الإنتاجي
# استخدام:  bash set-production-url.sh https://your-app.replit.app

if [ -z "$1" ]; then
  echo "الاستخدام: bash set-production-url.sh https://your-deployed-url.replit.app"
  exit 1
fi

NEW_URL="$1"
EAS_FILE="eas.json"

# Replace the placeholder with the actual URL
sed -i "s|REPLACE_WITH_DEPLOYED_URL|${NEW_URL}|g" "$EAS_FILE"

echo "✅ تم تحديث رابط الإنتاج في eas.json إلى: $NEW_URL"
echo "الخطوة التالية: eas build --platform android --profile production"
