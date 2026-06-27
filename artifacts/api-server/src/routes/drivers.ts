import { Router } from "express";
import { db, deliveryDriversTable, orderDriverAssignmentsTable, ordersTable, appSettingsTable, messagesTable } from "@workspace/db";
import { eq, desc, and, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { sendPushToToken } from "../lib/sendPushNotification.js";

const router = Router();

const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "").trim();

const driverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  photoUrl: z.string().nullable().optional(),
  photoKey: z.string().nullable().optional(),
  active: z.boolean().optional(),
  pin: z.string().min(4).max(8).optional(),
});

// ── GET /drivers ──────────────────────────────────────────────────────────────
router.get("/drivers", async (_req, res) => {
  const drivers = await db.select().from(deliveryDriversTable).orderBy(desc(deliveryDriversTable.createdAt));
  res.json(drivers);
});

// ── POST /drivers ─────────────────────────────────────────────────────────────
router.post("/drivers", async (req, res) => {
  const parsed = driverSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  try {
    const [driver] = await db.insert(deliveryDriversTable).values({
      name: parsed.data.name,
      phone: cleanPhone(parsed.data.phone),
      photoUrl: parsed.data.photoUrl ?? null,
      photoKey: parsed.data.photoKey ?? null,
      active: parsed.data.active ?? true,
      pin: parsed.data.pin ?? "0000",
    }).returning();
    res.json(driver);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "رقم الجوال مسجل مسبقاً لدى مندوب آخر" }); return; }
    throw e;
  }
});

// ── PUT /drivers/:id ──────────────────────────────────────────────────────────
router.put("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const parsed = driverSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  try {
    const updateData = { ...parsed.data, ...(parsed.data.phone ? { phone: cleanPhone(parsed.data.phone) } : {}) };
    const [driver] = await db.update(deliveryDriversTable).set(updateData).where(eq(deliveryDriversTable.id, id)).returning();
    res.json(driver);
  } catch (e: any) {
    if (e?.code === "23505") { res.status(409).json({ error: "رقم الجوال مسجل مسبقاً لدى مندوب آخر" }); return; }
    throw e;
  }
});

// ── DELETE /drivers/:id ───────────────────────────────────────────────────────
router.delete("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(messagesTable).where(eq(messagesTable.driverId, id));
  await db.delete(orderDriverAssignmentsTable).where(eq(orderDriverAssignmentsTable.driverId, id));
  await db.delete(deliveryDriversTable).where(eq(deliveryDriversTable.id, id));
  res.json({ ok: true });
});

// ── POST /drivers/login ───────────────────────────────────────────────────────
router.post("/drivers/login", async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) { res.status(400).json({ error: "أدخل رقم الجوال والرقم السري" }); return; }
  const normalizedPhone = cleanPhone(String(phone));
  const [driver] = await db.select().from(deliveryDriversTable)
    .where(and(eq(deliveryDriversTable.phone, normalizedPhone), eq(deliveryDriversTable.pin, String(pin).trim())));
  if (!driver) { res.status(401).json({ error: "رقم الجوال أو الرقم السري غير صحيح" }); return; }
  if (!driver.active) { res.status(403).json({ error: "حسابك موقوف، تواصل مع المشرف" }); return; }
  res.json(driver);
});

// ── GET /drivers/active-assignments  (all picked_up — cashier view) ──────────
router.get("/drivers/active-assignments", async (_req, res) => {
  const rows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable, driver: deliveryDriversTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .leftJoin(deliveryDriversTable, eq(orderDriverAssignmentsTable.driverId, deliveryDriversTable.id))
    .where(eq(orderDriverAssignmentsTable.status, "picked_up"))
    .orderBy(desc(orderDriverAssignmentsTable.pickedUpAt));
  res.json(rows.map(r => ({
    orderId: r.assignment.orderId,
    driverId: r.assignment.driverId,
    pickedUpAt: r.assignment.pickedUpAt,
    driverName: r.driver?.name ?? "مندوب",
    driverPhone: r.driver?.phone ?? "",
    dailyNumber: r.order?.dailyNumber ?? null,
    customerName: r.order?.customerName ?? "",
    customerAddress: r.order?.customerAddress ?? null,
    totalPrice: (r.order?.totalPrice ?? 0) / 100,
    paymentMethod: r.order?.paymentMethod ?? "cash",
    locationUpdatedAt: r.assignment.locationUpdatedAt ? r.assignment.locationUpdatedAt.toISOString() : null,
  })));
});

// ── GET /drivers/all-deliveries?date=YYYY-MM-DD  (all drivers flat list) ──────
router.get("/drivers/all-deliveries", async (req, res) => {
  const dateStr = String(req.query.date ?? "");
  const dayStart = dateStr ? new Date(dateStr) : new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const rows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable, driver: deliveryDriversTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .leftJoin(deliveryDriversTable, eq(orderDriverAssignmentsTable.driverId, deliveryDriversTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.status, "delivered"),
      gte(orderDriverAssignmentsTable.deliveredAt, dayStart),
      lt(orderDriverAssignmentsTable.deliveredAt, dayEnd),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

  res.json(rows.map(r => ({
    orderId:       r.assignment.orderId,
    dailyNumber:   r.order?.dailyNumber ?? null,
    customerName:  r.order?.customerName ?? "",
    customerPhone: r.order?.customerPhone ?? "",
    totalPrice:    (r.order?.totalPrice ?? 0) / 100,
    paymentMethod: r.order?.paymentMethod ?? "cash",
    driverName:    r.driver?.name ?? "",
    deliveredAt:   r.assignment.deliveredAt ? r.assignment.deliveredAt.toISOString() : null,
  })));
});

// ── GET /drivers/daily-summaries  (all drivers — admin view) ─────────────────
router.get("/drivers/daily-summaries", async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const drivers = await db.select().from(deliveryDriversTable).orderBy(deliveryDriversTable.name);
  const results = await Promise.all(drivers.map(async (driver) => {
    const rows = await db
      .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
      .from(orderDriverAssignmentsTable)
      .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
      .where(and(
        eq(orderDriverAssignmentsTable.driverId, driver.id),
        eq(orderDriverAssignmentsTable.status, "delivered"),
        gte(orderDriverAssignmentsTable.deliveredAt, today),
        lt(orderDriverAssignmentsTable.deliveredAt, tomorrow),
      ))
      .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

    const totalCollected = rows.reduce((s, r) => s + (r.order?.totalPrice ?? 0), 0);
    return {
      driver: { id: driver.id, name: driver.name, phone: driver.phone, photoUrl: driver.photoUrl, active: driver.active },
      ordersCount: rows.length,
      totalCollected: totalCollected / 100,
      orders: rows.map(r => ({
        orderId: r.assignment.orderId,
        dailyNumber: r.order?.dailyNumber ?? null,
        customerName: r.order?.customerName ?? "",
        totalPrice: (r.order?.totalPrice ?? 0) / 100,
        deliveredAt: r.assignment.deliveredAt,
      })),
    };
  }));
  res.json(results);
});

// ── GET /drivers/:id/statement  (full history + cancelled orders) ─────────────
router.get("/drivers/:id/statement", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  // Delivered orders
  const deliveredRows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      eq(orderDriverAssignmentsTable.status, "delivered"),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

  // Cancelled orders that were once assigned to this driver
  const cancelledRows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      ne(orderDriverAssignmentsTable.status, "delivered"),
      eq(ordersTable.status, "cancelled"),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.assignedAt));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  type PeriodAcc = { ordersCount: number; totalCollected: number; cashCollected: number; electronicCollected: number; cancelledCount: number };
  const mkPeriod = (): PeriodAcc => ({ ordersCount: 0, totalCollected: 0, cashCollected: 0, electronicCollected: 0, cancelledCount: 0 });
  const today     = mkPeriod();
  const thisMonth = mkPeriod();
  const thisYear  = mkPeriod();
  const allTime   = mkPeriod();

  type DayOrder = { orderId: number; dailyNumber: number | null; customerName: string; totalPrice: number; paymentMethod: string; assignedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; cancelled: boolean };
  const dayMap = new Map<string, { ordersCount: number; totalCollected: number; cashCollected: number; electronicCollected: number; cancelledCount: number; orders: DayOrder[] }>();
  const ensureDay = (key: string) => {
    if (!dayMap.has(key)) dayMap.set(key, { ordersCount: 0, totalCollected: 0, cashCollected: 0, electronicCollected: 0, cancelledCount: 0, orders: [] });
    return dayMap.get(key)!;
  };

  // Process delivered
  for (const r of deliveredRows) {
    const deliveredAt = r.assignment.deliveredAt;
    if (!deliveredAt) continue;
    const d = new Date(deliveredAt);
    const price = (r.order?.totalPrice ?? 0) / 100;
    const pm = r.order?.paymentMethod ?? "cash";
    const isCash = pm === "cash";

    const addTo = (acc: PeriodAcc) => {
      acc.ordersCount++;
      acc.totalCollected += price;
      if (isCash) acc.cashCollected += price; else acc.electronicCollected += price;
    };
    addTo(allTime);
    if (d >= yearStart)  addTo(thisYear);
    if (d >= monthStart) addTo(thisMonth);
    if (d >= todayStart) addTo(today);

    const dayKey = d.toISOString().slice(0, 10);
    const day = ensureDay(dayKey);
    day.ordersCount++;
    day.totalCollected += price;
    if (isCash) day.cashCollected += price; else day.electronicCollected += price;
    day.orders.push({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: price,
      paymentMethod: pm,
      assignedAt: r.assignment.assignedAt ? r.assignment.assignedAt.toISOString() : null,
      pickedUpAt: r.assignment.pickedUpAt ? r.assignment.pickedUpAt.toISOString() : null,
      deliveredAt: deliveredAt.toISOString(),
      cancelled: false,
    });
  }

  // Process cancelled
  for (const r of cancelledRows) {
    const refDate = r.assignment.assignedAt ?? r.order?.createdAt;
    if (!refDate) continue;
    const d = new Date(refDate);

    allTime.cancelledCount++;
    if (d >= yearStart)  thisYear.cancelledCount++;
    if (d >= monthStart) thisMonth.cancelledCount++;
    if (d >= todayStart) today.cancelledCount++;

    const dayKey = d.toISOString().slice(0, 10);
    const day = ensureDay(dayKey);
    day.cancelledCount++;
    day.orders.push({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: 0,
      paymentMethod: r.order?.paymentMethod ?? "cash",
      assignedAt: r.assignment.assignedAt ? r.assignment.assignedAt.toISOString() : null,
      pickedUpAt: null,
      deliveredAt: null,
      cancelled: true,
    });
  }

  const daily = Array.from(dayMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => ({ date, ...v }));

  res.json({ today, thisMonth, thisYear, allTime, daily });
});

// ── GET /drivers/:id/daily-summary ───────────────────────────────────────────
router.get("/drivers/:id/daily-summary", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      eq(orderDriverAssignmentsTable.status, "delivered"),
      gte(orderDriverAssignmentsTable.deliveredAt, today),
      lt(orderDriverAssignmentsTable.deliveredAt, tomorrow),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

  const totalCollected = rows.reduce((s, r) => s + (r.order?.totalPrice ?? 0), 0);
  res.json({
    ordersCount: rows.length,
    totalCollected: totalCollected / 100,
    orders: rows.map(r => ({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: (r.order?.totalPrice ?? 0) / 100,
      deliveredAt: r.assignment.deliveredAt,
    })),
  });
});

// ── GET /drivers/:id/orders ───────────────────────────────────────────────────
router.get("/drivers/:id/orders", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const rows = await db
    .select({
      assignment: orderDriverAssignmentsTable,
      order: ordersTable,
    })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(eq(orderDriverAssignmentsTable.driverId, id))
    .orderBy(desc(orderDriverAssignmentsTable.assignedAt));
  res.json(rows);
});

// ── POST /orders/:id/assign-driver ────────────────────────────────────────────
router.post("/orders/:id/assign-driver", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { driverId } = req.body;
  if (!driverId) { res.status(400).json({ error: "اختر مندوباً" }); return; }
  const [assignment] = await db
    .insert(orderDriverAssignmentsTable)
    .values({ orderId, driverId: parseInt(driverId), status: "assigned" })
    .onConflictDoUpdate({
      target: orderDriverAssignmentsTable.orderId,
      set: { driverId: parseInt(driverId), status: "assigned", assignedAt: new Date() },
    })
    .returning();
  res.json(assignment);
});

// ── DELETE /orders/:id/assign-driver ─────────────────────────────────────────
router.delete("/orders/:id/assign-driver", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(orderDriverAssignmentsTable).where(eq(orderDriverAssignmentsTable.orderId, orderId));
  res.json({ ok: true });
});

// ── PUT /orders/:id/driver-status ─────────────────────────────────────────────
router.put("/orders/:id/driver-status", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { status } = req.body;
  if (!["assigned", "picked_up", "delivered"].includes(status)) {
    res.status(400).json({ error: "حالة غير صحيحة" }); return;
  }
  const set: Record<string, unknown> = { status };
  if (status === "picked_up") set.pickedUpAt = new Date();
  if (status === "delivered") set.deliveredAt = new Date();
  const [assignment] = await db
    .update(orderDriverAssignmentsTable)
    .set(set)
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  res.json(assignment);

  // Send push notification to customer
  const [order] = await db
    .select({ customerPushToken: ordersTable.customerPushToken, id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (order?.customerPushToken) {
    if (status === "picked_up") {
      sendPushToToken(order.customerPushToken, {
        title: "🛵 المندوب في الطريق إليك",
        body: "المندوب استلم طلبك وهو الآن في الطريق إليك",
        sound: "default",
        data: { orderId, driverStatus: "picked_up" },
        channelId: "order-status",
      }).catch(() => {});
    } else if (status === "delivered") {
      sendPushToToken(order.customerPushToken, {
        title: "✅ طلبك وصل! 🎉",
        body: "تم تسليم طلبك — نتمنى تكون استمتعت بوجبتك 🙏",
        sound: "default",
        data: { orderId, driverStatus: "delivered" },
        channelId: "order-status",
      }).catch(() => {});
    }
  }
});

// ── GET /orders/:id/assignment ────────────────────────────────────────────────
router.get("/orders/:id/assignment", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [row] = await db
    .select({ assignment: orderDriverAssignmentsTable, driver: deliveryDriversTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(deliveryDriversTable, eq(orderDriverAssignmentsTable.driverId, deliveryDriversTable.id))
    .where(eq(orderDriverAssignmentsTable.orderId, orderId));
  res.json(row ?? null);
});

// ── PUT /orders/:id/driver-location ──────────────────────────────────────────
router.put("/orders/:id/driver-location", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { lat, lng } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "إحداثيات غير صحيحة" }); return;
  }
  const [assignment] = await db
    .update(orderDriverAssignmentsTable)
    .set({ driverLat: lat, driverLng: lng, locationUpdatedAt: new Date() })
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  res.json(assignment);
});

// ── POST /orders/:id/driver-rating ────────────────────────────────────────────
router.post("/orders/:id/driver-rating", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const stars = parseInt(req.body.stars);
  if (isNaN(stars) || stars < 1 || stars > 5) {
    res.status(400).json({ error: "تقييم غير صحيح (1-5)" }); return;
  }
  const [row] = await db
    .update(orderDriverAssignmentsTable)
    .set({ driverRating: stars })
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  if (!row) { res.status(404).json({ error: "لم يُوجد تعيين" }); return; }
  res.json({ ok: true, stars });
});

// ── GET /settings/ui-density ──────────────────────────────────────────────────
router.get("/settings/ui-density", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ui_density"));
  res.json({ value: row?.value ?? "normal" });
});

// ── PUT /settings/ui-density ──────────────────────────────────────────────────
router.put("/settings/ui-density", async (req, res) => {
  const { value } = req.body;
  if (!["compact", "normal", "spacious"].includes(value)) {
    res.status(400).json({ error: "قيمة غير صحيحة" }); return;
  }
  await db.insert(appSettingsTable)
    .values({ key: "ui_density", value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  res.json({ value });
});

// ── GET /settings/drivers-enabled ────────────────────────────────────────────
router.get("/settings/drivers-enabled", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "drivers_enabled"));
  const enabled = row ? row.value !== "false" : false;
  res.json({ enabled });
});

// ── PUT /settings/drivers-enabled ────────────────────────────────────────────
router.put("/settings/drivers-enabled", async (req, res) => {
  const { enabled } = req.body;
  await db.insert(appSettingsTable)
    .values({ key: "drivers_enabled", value: String(!!enabled) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(!!enabled), updatedAt: new Date() } });
  res.json({ enabled: !!enabled });
});

// ── GET /settings/commission-rate ─────────────────────────────────────────────
router.get("/settings/commission-rate", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "commission_rate"));
  res.json({ rate: row ? parseFloat(row.value) : 5 });
});

// ── PUT /settings/commission-rate ─────────────────────────────────────────────
router.put("/settings/commission-rate", async (req, res) => {
  const rate = parseFloat(req.body.rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ error: "نسبة غير صحيحة" }); return;
  }
  await db.insert(appSettingsTable)
    .values({ key: "commission_rate", value: String(rate) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(rate), updatedAt: new Date() } });
  res.json({ rate });
});

// ── GET /map/:orderId  (live driver tracking HTML page) ───────────────────────
router.get("/map/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).send("معرّف غير صحيح"); return; }

  // Restaurant location — روابي المندي، تبوك حي الروضة
  const RESTAURANT_LAT = 28.410769;
  const RESTAURANT_LNG = 36.532353;

  // Fetch order info for customer address + names
  let customerLat: number | null = null;
  let customerLng: number | null = null;
  let customerName = "";
  let driverName   = "";
  let dailyNumber: number | null = null;

  try {
    const rows = await db
      .select({
        customerAddress: ordersTable.customerAddress,
        customerName:    ordersTable.customerName,
        dailyNumber:     ordersTable.dailyNumber,
        driverName:      deliveryDriversTable.name,
        driverLat:       orderDriverAssignmentsTable.driverLat,
        driverLng:       orderDriverAssignmentsTable.driverLng,
      })
      .from(ordersTable)
      .leftJoin(orderDriverAssignmentsTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
      .leftJoin(deliveryDriversTable, eq(deliveryDriversTable.id, orderDriverAssignmentsTable.driverId))
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (rows.length > 0) {
      const row = rows[0];
      customerName = row.customerName ?? "";
      driverName   = row.driverName   ?? "المندوب";
      dailyNumber  = row.dailyNumber  ?? null;
      // Parse Google Maps URL: https://maps.google.com/?q=LAT,LNG
      const addr = row.customerAddress ?? "";
      const match = addr.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (match) {
        customerLat = parseFloat(match[1]);
        customerLng = parseFloat(match[2]);
      }
    }
  } catch (_) { /* serve the page even if DB query fails */ }

  const customerLatJs = customerLat !== null ? customerLat.toString() : "null";
  const customerLngJs = customerLng !== null ? customerLng.toString() : "null";

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <title>تتبع المندوب</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#0D1117;font-family:Cairo,sans-serif;overflow:hidden}
    #map{width:100%;height:100vh}

    /* ── top info bar ── */
    #infoBar{
      position:fixed;top:0;left:0;right:0;z-index:1000;
      background:linear-gradient(135deg,rgba(10,5,2,.97) 0%,rgba(20,10,5,.97) 100%);
      border-bottom:1px solid #C8171A44;
      padding:10px 16px 8px;
      display:flex;flex-direction:column;gap:4px;
    }
    #infoTitle{color:#E8920C;font-size:14px;font-weight:700;text-align:center}
    #infoSub{color:#aaa;font-size:11px;font-weight:600;text-align:center}
    #statusRow{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:2px}
    .dot{width:7px;height:7px;border-radius:50%;background:#4CAF50;animation:blink 1.2s infinite;flex-shrink:0}
    .dot.delivered{background:#4CAF50;animation:none}
    #statusText{color:#4CAF50;font-size:11px;font-weight:700}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}

    /* ── delivered overlay banner ── */
    #deliveredBanner{
      display:none;
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2000;
      background:rgba(10,20,10,.95);border:1.5px solid #4CAF50;border-radius:20px;
      padding:24px 32px;text-align:center;flex-direction:column;align-items:center;gap:10px;
      box-shadow:0 0 40px rgba(76,175,80,.25);min-width:220px;
    }
    #deliveredBanner .db-icon{font-size:48px;line-height:1;margin-bottom:4px}
    #deliveredBanner .db-title{color:#4CAF50;font-size:18px;font-weight:700}
    #deliveredBanner .db-sub{color:#aaa;font-size:12px;font-weight:600}

    /* ── ETA badge ── */
    #etaBar{
      position:fixed;bottom:60px;left:50%;transform:translateX(-50%);z-index:1000;
      background:rgba(10,5,2,.92);border:1px solid #29B6F655;border-radius:24px;
      padding:8px 20px;display:none;align-items:center;gap:8px;white-space:nowrap;
    }
    #etaIcon{font-size:16px}
    #etaText{color:#29B6F6;font-size:13px;font-weight:700}
    #etaDivider{color:#555;font-size:13px;font-weight:400}
    #distText{color:#81C784;font-size:13px;font-weight:700}

    /* ── legend ── */
    #legend{
      position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000;
      background:rgba(10,5,2,.92);border:1px solid #333;border-radius:14px;
      padding:8px 16px;display:flex;gap:16px;align-items:center;
    }
    .leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:#ccc;font-weight:600}

    /* ── marker styles ── */
    .pulse-ring{
      width:50px;height:50px;border-radius:50%;
      background:rgba(41,182,246,.18);border:2px solid #29B6F6;
      display:flex;align-items:center;justify-content:center;
      animation:pulseBlue 1.8s ease-in-out infinite;
    }
    @keyframes pulseBlue{
      0%{box-shadow:0 0 0 0 rgba(41,182,246,.5)}
      70%{box-shadow:0 0 0 18px rgba(41,182,246,0)}
      100%{box-shadow:0 0 0 0 rgba(41,182,246,0)}
    }
    .scooter{font-size:26px;line-height:1}

    .home-marker{
      width:42px;height:42px;border-radius:50%;
      background:rgba(232,146,12,.18);border:2px solid #E8920C;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;line-height:1;
    }
    .restaurant-marker{
      width:42px;height:42px;border-radius:50%;
      background:rgba(200,23,26,.18);border:2px solid #C8171A;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;line-height:1;
    }

    /* ── no location ── */
    .no-loc{
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      text-align:center;color:#aaa;display:none;
    }
    .no-loc span{font-size:48px;display:block;margin-bottom:12px}
    .leaflet-tile{filter:brightness(.78) saturate(.85)}
    .leaflet-control-zoom{border:1px solid #333!important;background:#111!important}
    .leaflet-control-zoom a{color:#E8920C!important;background:#111!important;border-color:#333!important}
  </style>
</head>
<body>
<div id="map"></div>

<div id="infoBar">
  <div id="infoTitle">
    ${dailyNumber ? `طلب #${dailyNumber}` : `طلب #${orderId}`}
    ${customerName ? ` — ${customerName}` : ""}
  </div>
  <div id="infoSub">🛵 ${driverName}</div>
  <div id="statusRow"><div class="dot"></div><span id="statusText">جاري تحديد موقع المندوب...</span></div>
</div>

<div id="etaBar">
  <span id="etaIcon">🕐</span>
  <span id="etaText">جاري الحساب...</span>
  <span id="etaDivider">|</span>
  <span id="distText">📍 ...</span>
</div>

<div id="legend">
  <div class="leg-item">🛵 <span>المندوب</span></div>
  <div class="leg-item" style="color:#E8920C">🏠 <span>العميل</span></div>
  <div class="leg-item" style="color:#C8171A">🏪 <span>المطعم</span></div>
  <div class="leg-item" id="routeLegend" style="display:none;color:#29B6F6">
    <svg width="22" height="8" viewBox="0 0 22 8" style="vertical-align:middle"><line x1="0" y1="4" x2="22" y2="4" stroke="#29B6F6" stroke-width="2.5" stroke-dasharray="5,4"/></svg>
    <span>المسار</span>
  </div>
</div>

<div class="no-loc" id="noLoc"><span>📍</span>لم يشارك المندوب موقعه بعد</div>

<div id="deliveredBanner">
  <div class="db-icon">✅</div>
  <div class="db-title">تم التسليم!</div>
  <div class="db-sub">وصل طلبك — آخر موقع للمندوب معروض على الخريطة</div>
</div>

<script>
  var ORDER_ID      = ${orderId};
  var POLL_MS       = 10000;
  var CUSTOMER_LAT  = ${customerLatJs};
  var CUSTOMER_LNG  = ${customerLngJs};
  var REST_LAT      = ${RESTAURANT_LAT};
  var REST_LNG      = ${RESTAURANT_LNG};

  var map = null, driverMarker = null, routeLine = null;
  var curLat = null, curLng = null, animReq = null;
  var staticMarkersAdded = false;
  var isDelivered = false;
  var pollIntervalId = null;

  /* ── Haversine distance (km) ── */
  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  /* ── Update route polyline driver → customer ── */
  function updateRouteLine(dLat, dLng) {
    if (CUSTOMER_LAT === null || CUSTOMER_LNG === null) return;
    if (!map) return;
    var latlngs = [[dLat, dLng], [CUSTOMER_LAT, CUSTOMER_LNG]];
    if (routeLine) {
      routeLine.setLatLngs(latlngs);
    } else {
      routeLine = L.polyline(latlngs, {
        color: '#29B6F6',
        weight: 3,
        opacity: 0.85,
        dashArray: '8, 6',
      }).addTo(map);
      var leg = document.getElementById('routeLegend');
      if (leg) leg.style.display = 'flex';
    }
  }

  /* ── Update ETA banner ── */
  function updateEta(dLat, dLng) {
    if (CUSTOMER_LAT === null || CUSTOMER_LNG === null) return;
    var distKm = haversineKm(dLat, dLng, CUSTOMER_LAT, CUSTOMER_LNG);
    var AVG_SPEED_KMH = 35;
    var minutes = Math.max(1, Math.round((distKm / AVG_SPEED_KMH) * 60));
    var etaBar  = document.getElementById('etaBar');
    var etaText = document.getElementById('etaText');
    var etaIcon = document.getElementById('etaIcon');
    var distText = document.getElementById('distText');
    if (minutes <= 2) {
      etaIcon.textContent = '🏁';
      etaText.textContent = 'الوصول خلال دقيقتين أو أقل';
    } else {
      etaIcon.textContent = '🕐';
      etaText.textContent = 'الوصول المتوقع: ' + minutes + ' دقيقة';
    }
    distText.textContent = distKm < 1
      ? '📍 ' + (Math.round(distKm * 100) * 10) + ' م'
      : '📍 ' + distKm.toFixed(1) + ' كم';
    etaBar.style.display = 'flex';
  }

  /* ── icon factories ── */
  var driverIcon = L.divIcon({
    html: '<div class="pulse-ring"><div class="scooter">🛵</div></div>',
    iconSize:[50,50], iconAnchor:[25,25], className:''
  });
  var homeIcon = L.divIcon({
    html: '<div class="home-marker">🏠</div>',
    iconSize:[42,42], iconAnchor:[21,21], className:''
  });
  var restaurantIcon = L.divIcon({
    html: '<div class="restaurant-marker">🏪</div>',
    iconSize:[42,42], iconAnchor:[21,21], className:''
  });

  /* ── init map with driver position, then add static markers ── */
  function initMap(lat, lng) {
    map = L.map('map',{zoomControl:true,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    curLat = lat; curLng = lng;
    driverMarker = L.marker([lat,lng],{icon:driverIcon}).addTo(map);
    addStaticMarkers();
    updateRouteLine(lat, lng);
    fitAll(lat, lng);
    document.getElementById('statusText').textContent = 'موقع مباشر ● يُحدَّث كل 10 ثوانٍ';
    document.getElementById('noLoc').style.display = 'none';
    updateEta(lat, lng);
  }

  function addStaticMarkers() {
    if (staticMarkersAdded) return;
    staticMarkersAdded = true;
    /* restaurant always shown */
    var restMarker = L.marker([REST_LAT, REST_LNG],{icon:restaurantIcon}).addTo(map);
    restMarker.bindPopup('<div style="font-family:Cairo,sans-serif;font-weight:700;color:#C8171A;text-align:center;direction:rtl">🏪 روابي المندي</div>');
    /* customer home — only if coords available */
    if (CUSTOMER_LAT !== null && CUSTOMER_LNG !== null) {
      var homeMarker = L.marker([CUSTOMER_LAT, CUSTOMER_LNG],{icon:homeIcon}).addTo(map);
      homeMarker.bindPopup('<div style="font-family:Cairo,sans-serif;text-align:center;direction:rtl"><div style="font-weight:700;color:#E8920C;margin-bottom:6px">🏠 موقع العميل</div><a href="https://maps.google.com/?q='+CUSTOMER_LAT+','+CUSTOMER_LNG+'" target="_blank" style="display:inline-block;background:#1a1a1a;color:#E8920C;border:1px solid #E8920C;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-decoration:none">📍 فتح في خرائط Google</a></div>');
    }
  }

  /* ── fit bounds to show driver + customer + restaurant ── */
  function fitAll(dLat, dLng) {
    var points = [[dLat, dLng], [REST_LAT, REST_LNG]];
    if (CUSTOMER_LAT !== null && CUSTOMER_LNG !== null) points.push([CUSTOMER_LAT, CUSTOMER_LNG]);
    var bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {padding:[60,60], maxZoom:15, animate:true});
  }

  /* ── smooth driver animation ── */
  function animateTo(tLat, tLng) {
    var STEPS = 40;
    var sLat = curLat, sLng = curLng;
    var step = 0;
    if (animReq) cancelAnimationFrame(animReq);
    function frame() {
      step++;
      var t = step/STEPS;
      curLat = sLat + (tLat-sLat)*t;
      curLng = sLng + (tLng-sLng)*t;
      driverMarker.setLatLng([curLat,curLng]);
      updateRouteLine(curLat, curLng);
      if (step < STEPS) animReq = requestAnimationFrame(frame);
      else { curLat=tLat; curLng=tLng; }
    }
    frame();
  }

  /* ── show delivered state (freeze pin, show banner, stop polling) ── */
  function showDelivered(lat, lng) {
    if (isDelivered) return;
    isDelivered = true;
    if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
    // Ensure pin is shown at last known location
    if (!map && lat && lng) { initMap(lat, lng); }
    else if (lat && lng && driverMarker) { driverMarker.setLatLng([lat, lng]); curLat = lat; curLng = lng; }
    // Remove pulsing animation from driver marker
    if (driverMarker) {
      var frozenIcon = L.divIcon({
        html: '<div style="width:50px;height:50px;border-radius:50%;background:rgba(76,175,80,.18);border:2px solid #4CAF50;display:flex;align-items:center;justify-content:center;"><div style="font-size:26px;line-height:1">✅</div></div>',
        iconSize:[50,50], iconAnchor:[25,25], className:''
      });
      driverMarker.setIcon(frozenIcon);
    }
    // Remove route line — delivery complete
    if (routeLine && map) { map.removeLayer(routeLine); routeLine = null; }
    // Hide ETA + noLoc
    document.getElementById('etaBar').style.display = 'none';
    document.getElementById('noLoc').style.display = 'none';
    // Update status bar
    var dot = document.querySelector('.dot');
    if (dot) { dot.classList.add('delivered'); }
    var st = document.getElementById('statusText');
    if (st) { st.textContent = 'تم التسليم ✅'; st.style.color = '#4CAF50'; }
    // Show delivered banner (centred overlay)
    var banner = document.getElementById('deliveredBanner');
    if (banner) { banner.style.display = 'flex'; }
    // Auto-hide banner after 6 seconds
    setTimeout(function() { if (banner) banner.style.display = 'none'; }, 6000);
  }

  /* ── poll for driver location ── */
  async function poll() {
    try {
      var r = await fetch('/api/orders/'+ORDER_ID+'/assignment');
      if (!r.ok) return;
      var data = await r.json();
      if (!data || !data.assignment) return;
      var lat = data.assignment.driverLat;
      var lng = data.assignment.driverLng;
      // Handle delivered state — freeze pin with last known coords
      if (data.assignment.status === 'delivered') {
        showDelivered(lat, lng);
        return;
      }
      if (!lat || !lng) {
        document.getElementById('noLoc').style.display = 'block';
        return;
      }
      document.getElementById('noLoc').style.display = 'none';
      if (!map) { initMap(lat, lng); }
      else { animateTo(lat, lng); updateEta(lat, lng); }
    } catch(e){}
  }

  /* ── if no driver location yet, show static map with restaurant + customer ── */
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!map && (CUSTOMER_LAT !== null || true)) {
        map = L.map('map',{zoomControl:true,attributionControl:false});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
        addStaticMarkers();
        var pts = [[REST_LAT, REST_LNG]];
        if (CUSTOMER_LAT !== null && CUSTOMER_LNG !== null) pts.push([CUSTOMER_LAT, CUSTOMER_LNG]);
        map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:15});
        document.getElementById('statusText').textContent = 'في انتظار مشاركة موقع المندوب...';
        document.getElementById('statusText').style.color = '#aaa';
      }
    }, 3000);
  });

  poll();
  pollIntervalId = setInterval(poll, POLL_MS);
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

export default router;
