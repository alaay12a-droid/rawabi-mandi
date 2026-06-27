export type OccasionId = "none" | "ramadan" | "eid" | "founding" | "national";

export interface OccasionTheme {
  id: OccasionId;
  name: string;
  emoji: string;
  greeting: string;
  decorRow: string;
  bg: string;
  secondBg: string;
  textColor: string;
  subColor: string;
}

// ── Gregorian → Julian Day Number ──────────────────────────────────────────
function toJulianDay(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

// ── Julian Day Number → Hijri ───────────────────────────────────────────────
export function getHijriDate(date: Date): { year: number; month: number; day: number } {
  const jdn = toJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  let l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

// ── Auto-detect occasion from current date ─────────────────────────────────
export function detectCurrentOccasion(date: Date = new Date()): OccasionId {
  const gMonth = date.getMonth() + 1;
  const gDay = date.getDate();
  const hijri = getHijriDate(date);

  // Ramadan: Hijri month 9 (full month)
  if (hijri.month === 9) return "ramadan";

  // Eid Al-Fitr: Hijri month 10, days 1–4
  if (hijri.month === 10 && hijri.day <= 4) return "eid";

  // Saudi Founding Day: Feb 22 (±5 days window)
  if (gMonth === 2 && gDay >= 17 && gDay <= 27) return "founding";

  // Saudi National Day: Sep 23 (±5 days window)
  if (gMonth === 9 && gDay >= 18 && gDay <= 28) return "national";

  return "none";
}

export const OCCASION_THEMES: Record<OccasionId, OccasionTheme> = {
  none: {
    id: "none",
    name: "بدون مناسبة",
    emoji: "✨",
    greeting: "",
    decorRow: "",
    bg: "transparent",
    secondBg: "transparent",
    textColor: "#fff",
    subColor: "#ccc",
  },
  ramadan: {
    id: "ramadan",
    name: "رمضان كريم",
    emoji: "🌙",
    greeting: "رمضان كريم • وكل عام وأنتم بخير",
    decorRow: "🕌  🌙  ⭐  🏮  ✨  🏮  ⭐  🌙  🕌",
    bg: "#0D1540",
    secondBg: "#1A236A",
    textColor: "#E8D48C",
    subColor: "#C8B060",
  },
  eid: {
    id: "eid",
    name: "عيد الفطر المبارك",
    emoji: "🎊",
    greeting: "تقبّل الله منا ومنكم صالح الأعمال",
    decorRow: "🌙  🎊  ✨  🌟  🎉  🌟  ✨  🎊  🌙",
    bg: "#0D3A1A",
    secondBg: "#1A5C2A",
    textColor: "#B8F0A0",
    subColor: "#80CC68",
  },
  founding: {
    id: "founding",
    name: "يوم التأسيس السعودي",
    emoji: "🇸🇦",
    greeting: "22 فبراير • نحتفل بذكرى تأسيس المملكة العربية السعودية",
    decorRow: "🇸🇦  🌴  ⚔️  🏰  🌴  🏰  ⚔️  🌴  🇸🇦",
    bg: "#004D26",
    secondBg: "#006C35",
    textColor: "#FFFFFF",
    subColor: "#AAFFCC",
  },
  national: {
    id: "national",
    name: "اليوم الوطني السعودي",
    emoji: "🇸🇦",
    greeting: "23 سبتمبر • نحتفل بعيدنا الوطني",
    decorRow: "🇸🇦  ✨  🎉  ⭐  🌙  ⭐  🎉  ✨  🇸🇦",
    bg: "#004D26",
    secondBg: "#006C35",
    textColor: "#FFFFFF",
    subColor: "#AAFFCC",
  },
};

export const OCCASION_KEY = "rawabi_occasion";

// All selectable occasions (excluding "none" from the auto badge row)
export const OCCASION_LIST: OccasionTheme[] = [
  OCCASION_THEMES.ramadan,
  OCCASION_THEMES.eid,
  OCCASION_THEMES.founding,
  OCCASION_THEMES.national,
];
