import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  setLanguage: () => {},
  isRTL: true,
});

const STORAGE_KEY = "@rawabi_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>("ar");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "en") {
        setLangState("en");
      } else {
        setLangState("ar");
        if (!val) AsyncStorage.setItem(STORAGE_KEY, "ar");
      }
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL: language === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
