import { Router } from "express";
import { db, branchesTable, deliveryZonesTable } from "@workspace/db";
import { asc, inArray } from "drizzle-orm";
import {
  resolveNearestBranch,
  validateResolveCoordinates,
} from "../lib/branchResolver";
import { requireDashboardUser } from "./dashboard-auth";

const router = Router();

router.get("/branches/resolve-preview", requireDashboardUser, async (req, res) => {
  const validated = validateResolveCoordinates(req.query.lat, req.query.lng);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const actor = res.locals.dashboardActor;
  if (actor.role !== "admin" && actor.branchIds.length === 0) {
    res.json(resolveNearestBranch(validated.point, [], []));
    return;
  }

  const branchFilter = actor.role === "admin" ? undefined : inArray(branchesTable.id, actor.branchIds);
  const [branches, zones] = await Promise.all([
    db.select({
      id: branchesTable.id,
      name: branchesTable.name,
      active: branchesTable.active,
      deliveryEnabled: branchesTable.deliveryEnabled,
      lat: branchesTable.lat,
      lng: branchesTable.lng,
    }).from(branchesTable).where(branchFilter),
    db.select({
      id: deliveryZonesTable.id,
      branchId: deliveryZonesTable.branchId,
      enabled: deliveryZonesTable.enabled,
      sortOrder: deliveryZonesTable.sortOrder,
      polygon: deliveryZonesTable.polygon,
    }).from(deliveryZonesTable)
      .where(actor.role === "admin" ? undefined : inArray(deliveryZonesTable.branchId, actor.branchIds))
      .orderBy(asc(deliveryZonesTable.sortOrder), asc(deliveryZonesTable.id)),
  ]);

  res.json(resolveNearestBranch(validated.point, branches, zones));
});

export default router;