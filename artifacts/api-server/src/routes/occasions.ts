import { Router } from "express";
import { db } from "@workspace/db";
import { occasionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SEED_OCCASIONS = [
  { occasionId: "oc1", name: "عروض رمضان الكريم",        description: "أسعار مميزة طوال الشهر الكريم",  imageKey: "ramadan",      sortOrder: 1 },
  { occasionId: "oc2", name: "عروض عيد الفطر المبارك",  description: "احتفل مع أهلك بأشهى المأكولات",   imageKey: "eid_fitr",     sortOrder: 2 },
  { occasionId: "oc3", name: "عروض عيد الأضحى المبارك", description: "ذبائح وولائم العيد",               imageKey: "eid_adha",     sortOrder: 3 },
  { occasionId: "oc4", name: "عروض اليوم الوطني",        description: "احتفالاً باليوم الوطني السعودي",  imageKey: "national_day", sortOrder: 4 },
  { occasionId: "oc5", name: "عروض المناسبات الخاصة",   description: "أعراس • مآتم • تجمعات",           imageKey: "occasions",    sortOrder: 5 },
];

export async function seedOccasions() {
  for (const occ of SEED_OCCASIONS) {
    await db.insert(occasionsTable).values({ ...occ }).onConflictDoNothing();
  }
}

router.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const occasions = await db
    .select()
    .from(occasionsTable)
    .orderBy(occasionsTable.sortOrder);
  res.json(occasions);
});

router.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
    imageKey: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const maxOrder = await db
    .select({ sortOrder: occasionsTable.sortOrder })
    .from(occasionsTable)
    .orderBy(occasionsTable.sortOrder);
  const nextOrder = maxOrder.length > 0 ? maxOrder[maxOrder.length - 1].sortOrder + 1 : 1;

  const occasionId = `oc_${Date.now()}`;
  const [created] = await db
    .insert(occasionsTable)
    .values({ occasionId, sortOrder: nextOrder, ...parsed.data })
    .returning();
  req.log.info({ occasionId }, "Occasion created");
  res.status(201).json(created);
});

router.put("/:occasionId", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    imageKey: z.string().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const [updated] = await db
    .update(occasionsTable)
    .set(parsed.data)
    .where(eq(occasionsTable.occasionId, req.params.occasionId))
    .returning();
  if (!updated) { res.status(404).json({ error: "المناسبة غير موجودة" }); return; }
  res.json(updated);
});

router.delete("/:occasionId", async (req, res) => {
  await db.delete(occasionsTable).where(eq(occasionsTable.occasionId, req.params.occasionId));
  res.json({ success: true });
});

export default router;
