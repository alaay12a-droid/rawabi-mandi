import { db, pushTokensTable } from "@workspace/db";
import { logger } from "./logger.js";

interface PushMessage {
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
  channelId?: string;
}

async function sendToExpo(messages: object[]): Promise<void> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    logger.error({ status: res.status }, "Push notification failed");
    return;
  }

  const result = await res.json() as { data: Array<{ status: string; id?: string; message?: string }> };
  const failed = result.data?.filter((d) => d.status !== "ok") ?? [];
  if (failed.length > 0) {
    logger.warn({ failed }, "Some push notifications failed");
  }
}

/** Send to all registered customer devices */
export async function sendPushToAll(msg: PushMessage): Promise<void> {
  try {
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(pushTokensTable).where(eq(pushTokensTable.role, "customer"));
    if (rows.length === 0) return;

    const messages = rows.map((r) => ({
      to: r.token,
      title: msg.title,
      body: msg.body,
      sound: msg.sound ?? "default",
      data: msg.data ?? {},
      channelId: msg.channelId ?? "orders",
    }));

    await sendToExpo(messages);
  } catch (err) {
    logger.error({ err }, "Error sending push notifications");
  }
}

/** Send to a single device token (e.g. specific customer) */
export async function sendPushToToken(token: string, msg: PushMessage): Promise<void> {
  try {
    await sendToExpo([{
      to: token,
      title: msg.title,
      body: msg.body,
      sound: msg.sound ?? "default",
      data: msg.data ?? {},
      channelId: msg.channelId ?? "order-status",
    }]);
  } catch (err) {
    logger.error({ err }, "Error sending push notification to token");
  }
}
