import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, companiesTable, bookingsTable } from "@workspace/db";
import { UpdateCompanyProfileBody } from "@workspace/api-zod";
import { requireCompany } from "../../lib/auth";

const router: IRouter = Router();

async function respondWithProfile(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId!;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (!company) {
    res.status(404).json({ error: "Empresa no encontrada" });
    return;
  }
  const [{ total }] = await db
    .select({ total: count() })
    .from(bookingsTable)
    .where(eq(bookingsTable.companyId, companyId));
  const [{ completed }] = await db
    .select({ completed: count() })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.companyId, companyId),
        eq(bookingsTable.status, "completed"),
      ),
    );

  res.json({
    id: company.id,
    name: company.name,
    email: company.email,
    phone: company.phone,
    active: company.active,
    status: company.status,
    rating: company.rating != null ? Number(company.rating) : null,
    totalBookings: Number(total),
    completedBookings: Number(completed),
    createdAt: company.createdAt.toISOString(),
  });
}

router.get("/company/profile", requireCompany(), respondWithProfile);

router.put("/company/profile", requireCompany(), async (req, res): Promise<void> => {
  const parsed = UpdateCompanyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const companyId = req.user!.companyId!;
  const updates: Record<string, string> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (Object.keys(updates).length > 0) {
    await db.update(companiesTable).set(updates).where(eq(companiesTable.id, companyId));
  }
  await respondWithProfile(req, res);
});

export default router;
