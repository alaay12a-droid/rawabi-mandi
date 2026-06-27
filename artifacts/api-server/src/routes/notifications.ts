import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendPushToAll } from "../lib/sendPushNotification.js";

const router = Router();

router.get("/notifications/broadcast", async (_req, res) => {
  res.json({ sent: 0, remaining: 9999, limit: 9999 });
});

router.post("/notifications/broadcast", async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(100),
    body:  z.string().min(1).max(300),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  await sendPushToAll({ title: parsed.data.title, body: parsed.data.body, sound: "default" });

  req.log.info({ title: parsed.data.title }, "Broadcast notification sent");
  res.json({ ok: true, remaining: 9999 });
});

export default router;
