import { Router } from "express";
import { db, branchesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireDashboardAdmin } from "./dashboard-auth";

const router = Router();

const branchSchema = z.object({
  name:    z.string().min(1),
  address: z.string().nullable().optional(),
  phone:   z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  active:  z.boolean().optional(),
  lat:     z.number().min(-90).max(90).nullable().optional(),
  lng:     z.number().min(-180).max(180).nullable().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
});

// ── GET /branches ─────────────────────────────────────────────────────────────
router.get("/branches", async (_req, res) => {
  const branches = await db
    .select()
    .from(branchesTable)
    .orderBy(desc(branchesTable.createdAt));
  res.json(branches);
});

// ── POST /branches ────────────────────────────────────────────────────────────
router.post("/branches", requireDashboardAdmin, async (req, res) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const [branch] = await db
    .insert(branchesTable)
    .values({
      name:    parsed.data.name,
      address: parsed.data.address ?? null,
      phone:   parsed.data.phone   ?? null,
      mapsUrl: parsed.data.mapsUrl ?? null,
      active:  parsed.data.active  ?? true,
      lat:     parsed.data.lat     ?? null,
      lng:     parsed.data.lng     ?? null,
      deliveryEnabled: parsed.data.deliveryEnabled ?? true,
      pickupEnabled: parsed.data.pickupEnabled ?? true,
    })
    .returning();
  res.json(branch);
});

// ── PUT /branches/:id ─────────────────────────────────────────────────────────
router.put("/branches/:id", requireDashboardAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const parsed = branchSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const [branch] = await db
    .update(branchesTable)
    .set({
      ...(parsed.data.name    !== undefined ? { name:    parsed.data.name }    : {}),
      ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
      ...(parsed.data.phone   !== undefined ? { phone:   parsed.data.phone }   : {}),
      ...(parsed.data.mapsUrl !== undefined ? { mapsUrl: parsed.data.mapsUrl } : {}),
      ...(parsed.data.active  !== undefined ? { active:  parsed.data.active }  : {}),
      ...(parsed.data.lat     !== undefined ? { lat:     parsed.data.lat }     : {}),
      ...(parsed.data.lng     !== undefined ? { lng:     parsed.data.lng }     : {}),
      ...(parsed.data.deliveryEnabled !== undefined ? { deliveryEnabled: parsed.data.deliveryEnabled } : {}),
      ...(parsed.data.pickupEnabled !== undefined ? { pickupEnabled: parsed.data.pickupEnabled } : {}),
    })
    .where(eq(branchesTable.id, id))
    .returning();
  if (!branch) { res.status(404).json({ error: "فرع غير موجود" }); return; }
  res.json(branch);
});

// ── DELETE /branches/:id ──────────────────────────────────────────────────────
router.delete("/branches/:id", requireDashboardAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(branchesTable).where(eq(branchesTable.id, id));
  res.json({ ok: true });
});

export default router;
