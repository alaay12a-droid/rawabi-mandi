import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { dashboardUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const JWT_SECRET = process.env["DASHBOARD_JWT_SECRET"];
if (!JWT_SECRET) throw new Error("DASHBOARD_JWT_SECRET env var is required");
const JWT_SECRET_STR: string = JWT_SECRET;
const COOKIE_NAME = "dashboard_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET_STR, { expiresIn: "7d" });
}

function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET_STR) as { userId: number; role: string };
    return payload;
  } catch {
    return null;
  }
}

router.post("/dashboard/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    return;
  }

  const [user] = await db
    .select()
    .from(dashboardUsersTable)
    .where(eq(dashboardUsersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const token = signToken(user.id, user.role);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });

  req.log.info({ username: user.username }, "Dashboard login");
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.get("/dashboard/auth/me", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "جلسة منتهية" });
    return;
  }

  const [user] = await db
    .select()
    .from(dashboardUsersTable)
    .where(eq(dashboardUsersTable.id, payload.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود" });
    return;
  }

  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post("/dashboard/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

export async function seedDashboardAdmin(): Promise<void> {
  const existing = await db
    .select({ id: dashboardUsersTable.id })
    .from(dashboardUsersTable)
    .where(eq(dashboardUsersTable.role, "admin"))
    .limit(1);

  if (existing.length > 0) {
    logger.info("Dashboard admin already exists, skipping seed");
    return;
  }

  const passwordHash = await bcrypt.hash("Aa@123456", 12);
  await db.insert(dashboardUsersTable).values({
    username: "rwabi-almndi",
    passwordHash,
    role: "admin",
  });
  logger.info("Dashboard admin seeded (username: rwabi-almndi)");
}

export default router;
