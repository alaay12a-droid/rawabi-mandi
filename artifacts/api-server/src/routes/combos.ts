import { Router } from "express";
import { db, combosTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

const router = Router();

const componentSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

const comboBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().positive(),
  imageUrl: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
  components: z.array(componentSchema).min(1),
  available: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// GET /combos — public
router.get("/combos", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const rows = await db.select().from(combosTable).orderBy(asc(combosTable.sortOrder), asc(combosTable.createdAt));
  res.json(rows.map((r) => ({ ...r, price: r.price / 100 })));
});

// POST /combos — admin
router.post("/combos", async (req, res) => {
  const parsed = comboBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const [row] = await db.insert(combosTable).values({
    comboId: randomUUID(),
    name: d.name,
    description: d.description ?? null,
    price: Math.round(d.price * 100),
    imageUrl: d.imageUrl ?? null,
    imageKey: d.imageKey ?? null,
    components: d.components,
    available: d.available ?? true,
    sortOrder: d.sortOrder ?? 0,
  }).returning();
  res.status(201).json({ ...row, price: row.price / 100 });
});

// PUT /combos/:id — admin
router.put("/combos/:id", async (req, res) => {
  const parsed = comboBodySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const d = parsed.data;
  const updates: Partial<typeof combosTable.$inferInsert> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.description !== undefined) updates.description = d.description ?? null;
  if (d.price !== undefined) updates.price = Math.round(d.price * 100);
  if (d.imageUrl !== undefined) updates.imageUrl = d.imageUrl ?? null;
  if (d.imageKey !== undefined) updates.imageKey = d.imageKey ?? null;
  if (d.components !== undefined) updates.components = d.components;
  if (d.available !== undefined) updates.available = d.available;
  if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
  const [row] = await db.update(combosTable).set(updates).where(eq(combosTable.comboId, req.params.id)).returning();
  if (!row) { res.status(404).json({ error: "لم يُعثر على الوجبة" }); return; }
  res.json({ ...row, price: row.price / 100 });
});

// DELETE /combos/:id — admin
router.delete("/combos/:id", async (req, res) => {
  await db.delete(combosTable).where(eq(combosTable.comboId, req.params.id));
  res.json({ ok: true });
});

export default router;
