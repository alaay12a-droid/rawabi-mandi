import { Router } from "express";
import { z } from "zod";
import { sendPinOtpEmail } from "../lib/sendEmail.js";

const router = Router();

// In-memory store: token → { code, expiresAt }
const pinOtpStore = new Map<string, { code: string; expiresAt: number }>();

const FIXED_TOKEN = "pin_change";

// POST /auth/pin-otp/send
router.post("/auth/pin-otp/send", async (_req, res) => {
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pinOtpStore.set(FIXED_TOKEN, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendPinOtpEmail(code);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل إرسال الإيميل";
    res.status(500).json({ error: msg });
  }
});

// POST /auth/pin-otp/verify
router.post("/auth/pin-otp/verify", (req, res) => {
  const parsed = z.object({ code: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "الرمز يجب أن يكون 6 أرقام" }); return; }

  const entry = pinOtpStore.get(FIXED_TOKEN);
  if (!entry) { res.status(400).json({ error: "لم يتم طلب رمز بعد، أرسل الرمز أولاً" }); return; }

  if (Date.now() > entry.expiresAt) {
    pinOtpStore.delete(FIXED_TOKEN);
    res.status(400).json({ error: "انتهت صلاحية الرمز، اطلب رمزاً جديداً" });
    return;
  }

  if (entry.code !== parsed.data.code) {
    res.status(400).json({ error: "الرمز غير صحيح" });
    return;
  }

  pinOtpStore.delete(FIXED_TOKEN);
  res.json({ ok: true });
});

export default router;
