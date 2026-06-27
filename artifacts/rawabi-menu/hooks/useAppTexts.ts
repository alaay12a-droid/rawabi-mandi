import { useState, useEffect } from "react";
import { apiGet } from "@/constants/api";
import { RESTAURANT_INFO } from "@/constants/menu";

export interface AppTexts {
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  phone: string;
  whatsapp: string;
  location: string;
  locationEn: string;
  instagram: string;
  dhabihaPhone: string;
  dhabihaWhatsapp: string;
  announcement: string;
  deliveryArea: string;
  snapchat: string;
  tiktok: string;
}

export const DEFAULT_TEXTS: AppTexts = {
  name:             RESTAURANT_INFO.name,
  nameEn:           RESTAURANT_INFO.nameEn,
  tagline:          RESTAURANT_INFO.tagline,
  taglineEn:        RESTAURANT_INFO.taglineEn,
  phone:            RESTAURANT_INFO.phone,
  whatsapp:         RESTAURANT_INFO.whatsapp,
  location:         RESTAURANT_INFO.location,
  locationEn:       RESTAURANT_INFO.locationEn,
  instagram:        RESTAURANT_INFO.instagram,
  dhabihaPhone:     RESTAURANT_INFO.dhabihaPhone,
  dhabihaWhatsapp:  RESTAURANT_INFO.dhabihaWhatsapp,
  announcement:     "",
  deliveryArea:     "تبوك - حي الروضة وما حولها",
  snapchat:         "rwabi-almndi",
  tiktok:           "rwabialmndi",
};

let _cache: AppTexts | null = null;
let _promise: Promise<AppTexts> | null = null;

function mapRaw(data: Record<string, string>): AppTexts {
  return {
    name:            data.txt_name             || DEFAULT_TEXTS.name,
    nameEn:          data.txt_name_en          || DEFAULT_TEXTS.nameEn,
    tagline:         data.txt_tagline          || DEFAULT_TEXTS.tagline,
    taglineEn:       data.txt_tagline_en       || DEFAULT_TEXTS.taglineEn,
    phone:           data.txt_phone            || DEFAULT_TEXTS.phone,
    whatsapp:        data.txt_whatsapp         || DEFAULT_TEXTS.whatsapp,
    location:        data.txt_location         || DEFAULT_TEXTS.location,
    locationEn:      data.txt_location_en      || DEFAULT_TEXTS.locationEn,
    instagram:       data.txt_instagram        || DEFAULT_TEXTS.instagram,
    dhabihaPhone:    data.txt_dhabiha_phone    || DEFAULT_TEXTS.dhabihaPhone,
    dhabihaWhatsapp: data.txt_dhabiha_whatsapp || DEFAULT_TEXTS.dhabihaWhatsapp,
    announcement:    data.txt_announcement     ?? "",
    deliveryArea:    data.txt_delivery_area    || DEFAULT_TEXTS.deliveryArea,
    snapchat:        data.txt_snapchat         || DEFAULT_TEXTS.snapchat,
    tiktok:          data.txt_tiktok           || DEFAULT_TEXTS.tiktok,
  };
}

function fetchTexts(): Promise<AppTexts> {
  if (_promise) return _promise;
  _promise = apiGet<Record<string, string>>("/app-texts")
    .then((data) => {
      const t = mapRaw(data);
      _cache = t;
      return t;
    })
    .catch(() => {
      _promise = null;
      return DEFAULT_TEXTS;
    });
  return _promise;
}

export function invalidateAppTextsCache(): void {
  _cache = null;
  _promise = null;
}

export function useAppTexts(): AppTexts {
  const [texts, setTexts] = useState<AppTexts>(_cache ?? DEFAULT_TEXTS);

  useEffect(() => {
    if (_cache) {
      setTexts(_cache);
      return;
    }
    fetchTexts().then(setTexts);
  }, []);

  return texts;
}
