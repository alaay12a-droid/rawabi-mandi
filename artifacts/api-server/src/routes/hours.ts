import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const KEY = "branch_hours";

// Saudi Arabia timezone offset = UTC+3
function nowInSaudi() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 3 * 3600000);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface DaySchedule {
  enabled: boolean;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export interface BranchHours {
  enabled: boolean; // master toggle — if false, always open
  days: DaySchedule[]; // index 0=Sunday ... 6=Saturday
}

const DEFAULT: BranchHours = {
  enabled: false,
  days: [0, 1, 2, 3, 4, 5, 6].map(() => ({
    enabled: true,
    open: "09:00",
    close: "23:00",
  })),
};

async function getHours(): Promise<BranchHours> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, KEY));
  if (rows.length && rows[0].value) {
    try { return JSON.parse(rows[0].value) as BranchHours; } catch {}
  }
  return DEFAULT;
}

// ── GET /branch-hours  (admin)
router.get("/branch-hours", async (_req, res) => {
  const hours = await getHours();
  res.json(hours);
});

// ── PUT /branch-hours  (admin)
router.put("/branch-hours", async (req, res) => {
  const body = req.body as BranchHours;
  await db
    .insert(appSettingsTable)
    .values({ key: KEY, value: JSON.stringify(body) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: JSON.stringify(body), updatedAt: new Date() } });
  res.json({ ok: true });
});

// ── GET /branch-status  (public — used by app to show closed banner)
router.get("/branch-status", async (_req, res) => {
  const hours = await getHours();

  if (!hours.enabled) {
    return res.json({ isOpen: true, message: null });
  }

  const saudi = nowInSaudi();
  const dayIdx = saudi.getDay(); // 0=Sun
  const nowMin = saudi.getHours() * 60 + saudi.getMinutes();

  const today = hours.days[dayIdx];
  if (!today || !today.enabled) {
    return res.json({ isOpen: false, message: "خارج أوقات العمل — لا يمكن الطلب الآن" });
  }

  const openMin  = toMinutes(today.open);
  const closeMin = toMinutes(today.close);

  const isOpen = nowMin >= openMin && nowMin < closeMin;

  if (isOpen) {
    return res.json({ isOpen: true, message: null });
  }

  // Build next-open message
  let nextMsg = `يفتح اليوم الساعة ${today.open}`;
  if (nowMin >= closeMin) {
    // Already past close — find next enabled day
    for (let i = 1; i <= 7; i++) {
      const nextDay = hours.days[(dayIdx + i) % 7];
      if (nextDay && nextDay.enabled) {
        const names = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
        nextMsg = i === 1
          ? `يفتح غداً الساعة ${nextDay.open}`
          : `يفتح يوم ${names[(dayIdx + i) % 7]} الساعة ${nextDay.open}`;
        break;
      }
    }
  }

  return res.json({ isOpen: false, message: `خارج أوقات العمل — ${nextMsg}` });
});

export { router as hoursRouter };
