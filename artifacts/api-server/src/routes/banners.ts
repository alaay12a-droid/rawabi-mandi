import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// GET all active banners (public)
router.get("/banners", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const banners = await db
    .select()
    .from(bannersTable)
    .orderBy(bannersTable.sortOrder);
  res.json(banners);
});

// POST new banner (admin)
router.post("/banners", async (req, res) => {
  const schema = z.object({
    imageUrl: z.string().min(1),
    imageKey: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const maxOrder = await db
    .select({ sortOrder: bannersTable.sortOrder })
    .from(bannersTable)
    .orderBy(bannersTable.sortOrder);
  const nextOrder = maxOrder.length > 0 ? maxOrder[maxOrder.length - 1].sortOrder + 1 : 0;

  const bannerId = `banner_${Date.now()}`;
  const [banner] = await db.insert(bannersTable).values({
    bannerId,
    imageUrl: parsed.data.imageUrl,
    imageKey: parsed.data.imageKey ?? null,
    title: parsed.data.title ?? null,
    sortOrder: nextOrder,
    active: true,
  }).returning();

  res.status(201).json(banner);
});

// PUT update banner (toggle active / title)
router.put("/banners/:bannerId", async (req, res) => {
  const schema = z.object({
    active: z.boolean().optional(),
    title: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const [banner] = await db
    .update(bannersTable)
    .set(parsed.data)
    .where(eq(bannersTable.bannerId, req.params.bannerId))
    .returning();

  if (!banner) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(banner);
});

// DELETE banner (admin)
router.delete("/banners/:bannerId", async (req, res) => {
  await db.delete(bannersTable).where(eq(bannersTable.bannerId, req.params.bannerId));
  res.json({ ok: true });
});

export default router;
