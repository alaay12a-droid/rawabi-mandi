import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable } from "@workspace/db";

const router = Router();

async function getOrCreateWallet(phone: string) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.phone, phone));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ phone, balance: 0 }).returning();
  return created;
}

// GET /wallet?phone=xxx
router.get("/", async (req, res) => {
  const { phone } = req.query as { phone?: string };
  if (!phone) { res.status(400).json({ error: "phone is required" }); return; }
  const wallet = await getOrCreateWallet(phone);
  res.json(wallet);
});

// GET /wallet/transactions?phone=xxx&type=deposit|withdrawal|expiry
router.get("/transactions", async (req, res) => {
  const { phone, type } = req.query as { phone?: string; type?: string };
  if (!phone) { res.status(400).json({ error: "phone is required" }); return; }
  await getOrCreateWallet(phone);
  let rows;
  if (type && ["deposit", "withdrawal", "expiry"].includes(type)) {
    rows = await db.select().from(walletTransactionsTable)
      .where(and(
        eq(walletTransactionsTable.phone, phone),
        eq(walletTransactionsTable.type, type as "deposit" | "withdrawal" | "expiry"),
      ))
      .orderBy(desc(walletTransactionsTable.createdAt));
  } else {
    rows = await db.select().from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.phone, phone))
      .orderBy(desc(walletTransactionsTable.createdAt));
  }
  res.json(rows);
});

// POST /wallet/deposit — admin adds credit { phone, amount, note }
router.post("/deposit", async (req, res) => {
  const { phone, amount, note } = req.body as { phone: string; amount: number; note?: string };
  if (!phone || !amount || amount <= 0) {
    res.status(400).json({ error: "phone and positive amount required" });
    return;
  }
  const wallet = await getOrCreateWallet(phone);
  const newBalance = wallet.balance + amount;
  await db.update(walletsTable)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(walletsTable.phone, phone));
  await db.insert(walletTransactionsTable).values({
    phone,
    type: "deposit",
    amount,
    balanceAfter: newBalance,
    note: note || null,
  });
  res.json({ balance: newBalance });
});

// POST /wallet/pay — deduct from wallet { phone, amount, orderId }
router.post("/pay", async (req, res) => {
  const { phone, amount, orderId } = req.body as { phone: string; amount: number; orderId?: number };
  if (!phone || !amount || amount <= 0) {
    res.status(400).json({ error: "phone and positive amount required" });
    return;
  }
  const wallet = await getOrCreateWallet(phone);
  if (wallet.balance < amount) {
    res.status(400).json({ error: "رصيد غير كافٍ في المحفظة" });
    return;
  }
  const newBalance = wallet.balance - amount;
  await db.update(walletsTable)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(walletsTable.phone, phone));
  await db.insert(walletTransactionsTable).values({
    phone,
    type: "withdrawal",
    amount: -amount,
    balanceAfter: newBalance,
    note: orderId ? `طلب #${orderId}` : "دفع طلب",
    orderId: orderId || null,
  });
  res.json({ balance: newBalance });
});

export default router;
