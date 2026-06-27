import { useLanguage } from "@/context/LanguageContext";
import { translations, TranslationKey } from "@/constants/translations";

export function useTranslation() {
  const { language } = useLanguage();
  const t = (key: TranslationKey): string => translations[language][key] ?? translations.ar[key];
  return { t, language };
}
