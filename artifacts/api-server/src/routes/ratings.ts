import { Router } from "express";
import { db, ordersTable, orderRatingsTable, appSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const rateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

// ── POST /orders/:id/rate — customer submits rating ───────────────────────────
router.post("/orders/:id/rate", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const [rating] = await db
    .insert(orderRatingsTable)
    .values({ orderId: id, stars: parsed.data.stars, comment: parsed.data.comment ?? null })
    .onConflictDoUpdate({
      target: orderRatingsTable.orderId,
      set: { stars: parsed.data.stars, comment: parsed.data.comment ?? null },
    })
    .returning();

  res.json(rating);
});

// ── GET /orders/:id/rate — get single order rating ───────────────────────────
router.get("/orders/:id/rate", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [rating] = await db.select().from(orderRatingsTable).where(eq(orderRatingsTable.orderId, id));
  res.json(rating ?? null);
});

// ── GET /ratings — admin: list all ratings with customer info ─────────────────
router.get("/ratings", async (_req, res) => {
  const ratings = await db
    .select({
      orderId: orderRatingsTable.orderId,
      stars: orderRatingsTable.stars,
      comment: orderRatingsTable.comment,
      ratedAt: orderRatingsTable.createdAt,
      customerName: ordersTable.customerName,
      customerPhone: ordersTable.customerPhone,
      orderTotal: ordersTable.totalPrice,
      orderNotes: ordersTable.notes,
    })
    .from(orderRatingsTable)
    .leftJoin(ordersTable, eq(orderRatingsTable.orderId, ordersTable.id))
    .orderBy(desc(orderRatingsTable.createdAt));

  res.json(ratings);
});

// ── DELETE /ratings/:orderId — admin: delete a rating ────────────────────────
router.delete("/ratings/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(orderRatingsTable).where(eq(orderRatingsTable.orderId, orderId));
  res.json({ ok: true });
});

// ── GET /settings/favorites-enabled ──────────────────────────────────────────
router.get("/settings/favorites-enabled", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "favorites_enabled"));
  const enabled = row ? row.value !== "false" : true;
  res.json({ enabled });
});

// ── PUT /settings/favorites-enabled ──────────────────────────────────────────
router.put("/settings/favorites-enabled", async (req, res) => {
  const { enabled } = req.body;
  await db
    .insert(appSettingsTable)
    .values({ key: "favorites_enabled", value: String(!!enabled) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(!!enabled), updatedAt: new Date() } });
  res.json({ enabled: !!enabled });
});

export default router;
