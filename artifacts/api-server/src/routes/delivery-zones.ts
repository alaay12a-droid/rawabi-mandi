import { Router } from "express";
import { db, deliveryZonesTable, branchesTable } from "@workspace/db";
import { eq, asc, and, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireDashboardUser } from "./dashboard-auth";
import { pointInPolygon, type LatLng } from "../lib/geo";

const router = Router();

router.get("/delivery-zones", requireDashboardUser, async (_req, res) => {
  const actor = res.locals.dashboardActor;
  if (actor.role !== "admin" && actor.branchIds.length === 0) {
    res.json([]);
    return;
  }
  const zones = await db
    .select()
    .from(deliveryZonesTable)
    .where(actor && actor.role !== "admin"
      ? and(isNotNull(deliveryZonesTable.branchId), inArray(deliveryZonesTable.branchId, actor.branchIds))
      : undefined)
    .orderBy(asc(deliveryZonesTable.sortOrder), asc(deliveryZonesTable.id));
  res.json(zones);
});

router.get("/delivery-zones/check", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat و lng مطلوبان" });
    return;
  }

  const zones = await db
    .select()
    .from(deliveryZonesTable)
    .where(eq(deliveryZonesTable.enabled, true))
    .orderBy(asc(deliveryZonesTable.sortOrder), asc(deliveryZonesTable.id));

  const totalZones = await db.select().from(deliveryZonesTable);

  for (const zone of zones) {
    const poly = zone.polygon as LatLng[];
    if (pointInPolygon({ lat, lng }, poly)) {
      res.json({
        found: true,
        zone: {
          id: zone.id,
          name: zone.name,
          deliveryFee: zone.deliveryFee,
          minOrder: zone.minOrder,
        },
        hasZones: totalZones.length > 0,
      });
      return;
    }
  }

  res.json({ found: false, zone: null, hasZones: totalZones.length > 0 });
});

const zoneSchema = z.object({
  name: z.string().min(1),
  polygon: z.array(z.object({ lat: z.number(), lng: z.number() })).min(3),
  deliveryFee: z.number().int().min(0),
  minOrder: z.number().int().min(0),
  enabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  branchId: z.number().int().positive().nullable().optional(),
});

router.post("/delivery-zones", requireDashboardUser, async (req, res) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() });
    return;
  }
  const { name, polygon, deliveryFee, minOrder, enabled, sortOrder, branchId } = parsed.data;
  const actor = res.locals.dashboardActor;
  if (actor.role !== "admin" && (branchId == null || !actor.branchIds.includes(branchId))) {
    res.status(403).json({ error: "غير مصرح لهذا الفرع" }); return;
  }
  if (branchId !== undefined && branchId !== null) {
    const [branch] = await db
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(eq(branchesTable.id, branchId))
      .limit(1);
    if (!branch) { res.status(400).json({ error: "الفرع غير موجود" }); return; }
  }
  const [zone] = await db
    .insert(deliveryZonesTable)
    .values({ name, polygon, deliveryFee, minOrder, enabled, sortOrder, branchId: branchId ?? null })
    .returning();
  res.status(201).json(zone);
});

router.put("/delivery-zones/:id", requireDashboardUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const patchSchema = zoneSchema.partial();
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  const actor = res.locals.dashboardActor;
  const [existing] = await db.select({ branchId: deliveryZonesTable.branchId })
    .from(deliveryZonesTable).where(eq(deliveryZonesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }
  if (actor.role !== "admin" && (existing.branchId == null || !actor.branchIds.includes(existing.branchId))) {
    res.status(403).json({ error: "غير مصرح لهذا الفرع" }); return;
  }
  if (actor.role !== "admin" && (parsed.data.branchId === null || (parsed.data.branchId !== undefined && !actor.branchIds.includes(parsed.data.branchId)))) {
    res.status(403).json({ error: "غير مصرح لهذا الفرع" }); return;
  }
  if (parsed.data.branchId !== undefined && parsed.data.branchId !== null) {
    const [branch] = await db
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(eq(branchesTable.id, parsed.data.branchId))
      .limit(1);
    if (!branch) { res.status(400).json({ error: "الفرع غير موجود" }); return; }
  }
  const [zone] = await db
    .update(deliveryZonesTable)
    .set(parsed.data)
    .where(eq(deliveryZonesTable.id, id))
    .returning();
  if (!zone) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }
  res.json(zone);
});

router.delete("/delivery-zones/:id", requireDashboardUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const actor = res.locals.dashboardActor;
  const [existing] = await db.select({ branchId: deliveryZonesTable.branchId })
    .from(deliveryZonesTable).where(eq(deliveryZonesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "المنطقة غير موجودة" }); return; }
  if (actor.role !== "admin" && (existing.branchId == null || !actor.branchIds.includes(existing.branchId))) {
    res.status(403).json({ error: "غير مصرح لهذا الفرع" }); return;
  }
  await db.delete(deliveryZonesTable).where(eq(deliveryZonesTable.id, id));
  res.json({ ok: true });
});

export default router;
