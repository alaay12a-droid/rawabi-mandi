import { Router } from "express";
import { db, ordersTable, menuItemsTable, appSettingsTable, orderDriverAssignmentsTable } from "@workspace/db";
import { eq, desc, gte, lt, count, and } from "drizzle-orm";
import { sendPushToAll } from "../lib/sendPushNotification.js";
import { sendSms } from "../lib/sendSms.js";
import { z } from "zod";

const router = Router();

const createOrderSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerAddress: z.string().nullable().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  totalPrice: z.number().positive(),
  deliveryFee: z.number().min(0).default(0),
  discountCode: z.string().nullable().optional(),
  discountAmount: z.number().min(0).nullable().optional(),
  paymentMethod: z.enum(["cash", "moyasar"]).default("cash"),
  notes: z.string().nullable().optional(),
  customerPushToken: z.string().nullable().optional(),
});

router.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // ── Rate-limit: reject if same phone placed an order within the last 10 seconds ──
  const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
  const [recentOrder] = await db
    .select({ id: ordersTable.id, createdAt: ordersTable.createdAt })
    .from(ordersTable)
    .where(and(eq(ordersTable.customerPhone, data.customerPhone), gte(ordersTable.createdAt, tenSecondsAgo)))
    .limit(1);
  if (recentOrder) {
    const secondsLeft = Math.ceil((recentOrder.createdAt.getTime() + 10 * 1000 - Date.now()) / 1000);
    res.status(429).json({
      error: `طلبك السابق قيد الانتظار — انتظر ${secondsLeft} ثانية`,
      retryAfter: secondsLeft,
    });
    return;
  }

  // Calculate today's order sequence number (resets at midnight, Saudi time UTC+3)
  const nowUtc = new Date();
  const offsetMs = 3 * 60 * 60 * 1000; // UTC+3
  const nowLocal = new Date(nowUtc.getTime() + offsetMs);
  const todayStart = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - offsetMs);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [{ value: todayCount }] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(and(gte(ordersTable.createdAt, todayStart), lt(ordersTable.createdAt, tomorrowStart)));

  const dailyNumber = Number(todayCount) + 1;

  // ── Minimum order amount check ─────────────────────────────────────────────
  const [minOrderSetting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "appearance_minOrderAmount"));
  const minOrderSAR = parseFloat(minOrderSetting?.value ?? "0") || 0;
  if (minOrderSAR > 0 && data.totalPrice < minOrderSAR) {
    res.status(422).json({
      error: `الحد الأدنى للطلب هو ${minOrderSAR} ر.س`,
      minOrderAmount: minOrderSAR,
    });
    return;
  }

  // ── Validate stock before inserting ────────────────────────────────────────
  for (const item of data.items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.itemId, item.id));
    if (menuItem && menuItem.stock !== null) {
      if (menuItem.stock < item.quantity) {
        res.status(409).json({
          error: menuItem.stock === 0
            ? `نفد المخزون: ${item.name}`
            : `الكمية المتاحة من "${item.name}" هي ${menuItem.stock} فقط`,
          itemId: item.id,
          available: menuItem.stock,
        });
        return;
      }
    }
  }

  const [order] = await db.insert(ordersTable).values({
    dailyNumber,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress ?? null,
    items: data.items,
    totalPrice: Math.round(data.totalPrice * 100),
    deliveryFee: Math.round((data.deliveryFee ?? 0) * 100),
    discountCode: data.discountCode ?? null,
    discountAmount: data.discountAmount != null ? Math.round(data.discountAmount * 100) : null,
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? null,
    status: "pending",
    customerPushToken: data.customerPushToken ?? null,
  }).returning();

  for (const item of data.items) {
    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.itemId, item.id));
    if (menuItem && menuItem.stock !== null) {
      const newStock = Math.max(0, menuItem.stock - item.quantity);
      await db.update(menuItemsTable)
        .set({ stock: newStock, available: newStock > 0 })
        .where(eq(menuItemsTable.itemId, item.id));
    }
  }

  req.log.info({ orderId: order.id }, "New order created");
  res.status(201).json(order);

  // Send push notification to all registered cashier devices (fire and forget)
  const itemsSummary = data.items.map((i) => `${i.quantity}× ${i.name}`).join("، ");
  sendPushToAll({
    title: `🔔 طلب جديد #${dailyNumber}`,
    body: `${data.customerName} — ${itemsSummary}`,
    sound: "default",
    data: { orderId: order.id },
  });
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  res.json(order);
});

router.get("/orders", async (req, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  res.json(orders);
});

const RESTAURANT_NAME = "روابي المندي";

function buildCustomerStatusMessage(status: string, dailyNumber: number): { title: string; body: string } | null {
  switch (status) {
    case "preparing":
      return {
        title: "🍳 جاري تحضير طلبك",
        body: `طلبك رقم #${dailyNumber} من ${RESTAURANT_NAME} قيد التحضير الآن — سيكون جاهز قريباً!`,
      };
    case "ready":
      return {
        title: "✅ طلبك جاهز!",
        body: `طلبك رقم #${dailyNumber} من ${RESTAURANT_NAME} أصبح جاهزاً، تفضّل بالاستلام 🎉`,
      };
    case "done":
      // pickup orders only (delivery orders notified via driver "delivered" event)
      return {
        title: "🙏 شكراً لك",
        body: `تم استلام طلبك رقم #${dailyNumber} — نتمنى تكون استمتعت بوجبتك!`,
      };
    case "cancelled":
      return {
        title: "❌ تم إلغاء طلبك",
        body: `نأسف، تم إلغاء طلبك رقم #${dailyNumber} من قِبل ${RESTAURANT_NAME}. للاستفسار تواصل معنا مباشرة.`,
      };
    default:
      return null;
  }
}

router.patch("/orders/:id/status", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صحيح" });
    return;
  }
  const { status } = req.body as { status: string };
  const validStatuses = ["pending", "preparing", "ready", "done", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "حالة غير صحيحة" });
    return;
  }
  const [order] = await db
    .update(ordersTable)
    .set({ status: status as "pending" | "preparing" | "ready" | "done" | "cancelled" })
    .where(eq(ordersTable.id, id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  res.json(order);

  // Send push notification to customer if they have a token
  const customerMsg = buildCustomerStatusMessage(status, order.dailyNumber);
  if (order.customerPushToken && customerMsg) {
    // For "done": skip if order has a driver assignment (delivery order) —
    // the driver's "delivered" event sends the notification instead
    let shouldSend = true;
    if (status === "done") {
      const [driverRow] = await db
        .select({ id: orderDriverAssignmentsTable.orderId })
        .from(orderDriverAssignmentsTable)
        .where(eq(orderDriverAssignmentsTable.orderId, order.id))
        .limit(1);
      if (driverRow) shouldSend = false;
    }
    if (shouldSend) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: order.customerPushToken,
          title: customerMsg.title,
          body: customerMsg.body,
          sound: "default",
          data: { orderId: order.id, status },
          channelId: "order-status",
        }),
      }).catch(() => {});
    }
  }

  // Send SMS to customer on cancellation (works for web users who have no push token)
  if (status === "cancelled" && order.customerPhone) {
    sendSms(
      order.customerPhone,
      `عزيزنا ${order.customerName}، نأسف لإبلاغك بأنه تم إلغاء طلبك رقم #${order.dailyNumber} من روابي المندي. للاستفسار تواصل معنا مباشرة. شكراً لتفهمك 🙏`
    ).catch(() => {});
  }
});

// ── GET /settings/customer-cancel — check if customers can cancel
router.get("/settings/customer-cancel", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "allow_customer_cancel"));
  res.json({ allowed: rows[0]?.value === "true" });
});

// ── PUT /settings/customer-cancel — admin toggles the setting
router.put("/settings/customer-cancel", async (req, res) => {
  const { allowed } = req.body as { allowed: boolean };
  await db
    .insert(appSettingsTable)
    .values({ key: "allow_customer_cancel", value: String(allowed) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(allowed), updatedAt: new Date() } });
  res.json({ ok: true });
});

// ── PATCH /orders/:id/cancel — customer requests cancellation
router.patch("/orders/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  // Check if customer cancellation is allowed
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "allow_customer_cancel"));
  if (rows[0]?.value !== "true") {
    res.status(403).json({ error: "إلغاء الطلب غير مسموح حالياً، تواصل مع الكاشير" });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "لا يمكن إلغاء الطلب بعد بدء التحضير" });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set({ status: "cancelled" })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json(order);
});

export default router;
