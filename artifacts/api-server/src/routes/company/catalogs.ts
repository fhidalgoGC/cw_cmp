import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  companySlotsTable,
  companyBlockedDatesTable,
  companyPackagesTable,
  packagesTable,
  washTypesTable,
  companyWashTypesTable,
  companyAddOnsTable,
  addOnsTable,
} from "@workspace/db";
import {
  UpdateCompanyAvailabilityBody,
  UpdateCompanyPackagesBody,
  UpdateCompanyServicesBody,
} from "@workspace/api-zod";
import { requireCompany } from "../../lib/auth";

const router: IRouter = Router();

router.get("/company/availability", requireCompany(), async (req, res): Promise<void> => {
  const companyId = req.user!.companyId!;
  const [slots, blocked] = await Promise.all([
    db
      .select({ time: companySlotsTable.time, enabled: companySlotsTable.enabled })
      .from(companySlotsTable)
      .where(eq(companySlotsTable.companyId, companyId))
      .orderBy(companySlotsTable.time),
    db
      .select({ date: companyBlockedDatesTable.date })
      .from(companyBlockedDatesTable)
      .where(eq(companyBlockedDatesTable.companyId, companyId)),
  ]);
  res.json({
    slots,
    blockedDates: blocked.map((b) => b.date).sort(),
  });
});

router.put("/company/availability", requireCompany(), async (req, res): Promise<void> => {
  const parsed = UpdateCompanyAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const companyId = req.user!.companyId!;
  if (parsed.data.slots) {
    await db.delete(companySlotsTable).where(eq(companySlotsTable.companyId, companyId));
    if (parsed.data.slots.length > 0) {
      await db.insert(companySlotsTable).values(
        parsed.data.slots.map((s) => ({
          companyId,
          time: s.time,
          enabled: s.enabled,
        })),
      );
    }
  }
  if (parsed.data.blockedDates) {
    await db
      .delete(companyBlockedDatesTable)
      .where(eq(companyBlockedDatesTable.companyId, companyId));
    const uniq = [...new Set(parsed.data.blockedDates)];
    if (uniq.length > 0) {
      await db
        .insert(companyBlockedDatesTable)
        .values(uniq.map((d) => ({ companyId, date: d })));
    }
  }
  const [slots, blocked] = await Promise.all([
    db
      .select({ time: companySlotsTable.time, enabled: companySlotsTable.enabled })
      .from(companySlotsTable)
      .where(eq(companySlotsTable.companyId, companyId))
      .orderBy(companySlotsTable.time),
    db
      .select({ date: companyBlockedDatesTable.date })
      .from(companyBlockedDatesTable)
      .where(eq(companyBlockedDatesTable.companyId, companyId)),
  ]);
  res.json({ slots, blockedDates: blocked.map((b) => b.date).sort() });
});

// ---- Packages ----
async function listPackagesForCompany(companyId: string) {
  const rows = await db
    .select({
      id: packagesTable.id,
      slug: packagesTable.slug,
      name: packagesTable.name,
      color: packagesTable.color,
      washTypeId: packagesTable.washTypeId,
      washSlug: washTypesTable.slug,
      washName: washTypesTable.name,
    })
    .from(packagesTable)
    .innerJoin(washTypesTable, eq(packagesTable.washTypeId, washTypesTable.id))
    .orderBy(packagesTable.name);
  const active = await db
    .select({
      packageId: companyPackagesTable.packageId,
      active: companyPackagesTable.active,
    })
    .from(companyPackagesTable)
    .where(eq(companyPackagesTable.companyId, companyId));
  const activeMap = new Map(active.map((a) => [a.packageId, a.active]));
  return rows.map((p) => ({
    package: { id: p.id, slug: p.slug, name: p.name },
    name: p.name,
    color: p.color,
    washType: { id: p.washTypeId, slug: p.washSlug, name: p.washName },
    active: activeMap.get(p.id) ?? false,
  }));
}

router.get("/company/packages", requireCompany(), async (req, res): Promise<void> => {
  res.json(await listPackagesForCompany(req.user!.companyId!));
});

router.put("/company/packages", requireCompany(), async (req, res): Promise<void> => {
  const parsed = UpdateCompanyPackagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const companyId = req.user!.companyId!;
  for (const p of parsed.data.packages) {
    const existing = await db
      .select()
      .from(companyPackagesTable)
      .where(
        and(
          eq(companyPackagesTable.companyId, companyId),
          eq(companyPackagesTable.packageId, p.packageId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(companyPackagesTable)
        .set({ active: p.active })
        .where(
          and(
            eq(companyPackagesTable.companyId, companyId),
            eq(companyPackagesTable.packageId, p.packageId),
          ),
        );
    } else {
      await db
        .insert(companyPackagesTable)
        .values({ companyId, packageId: p.packageId, active: p.active });
    }
  }
  res.json(await listPackagesForCompany(companyId));
});

// ---- Services (wash types + add-ons) ----
async function listServicesForCompany(companyId: string) {
  const [washes, addons, cwt, cao] = await Promise.all([
    db
      .select()
      .from(washTypesTable)
      .orderBy(washTypesTable.name),
    db
      .select()
      .from(addOnsTable)
      .orderBy(addOnsTable.name),
    db
      .select()
      .from(companyWashTypesTable)
      .where(eq(companyWashTypesTable.companyId, companyId)),
    db
      .select()
      .from(companyAddOnsTable)
      .where(eq(companyAddOnsTable.companyId, companyId)),
  ]);
  const washActive = new Map(cwt.map((r) => [r.washTypeId, r.active]));
  const addOnActive = new Map(cao.map((r) => [r.addOnId, r.active]));
  return [
    ...washes.map((w) => ({
      service: { id: w.id, slug: w.slug, name: w.name },
      name: w.name,
      price: Number(w.basePrice),
      active: washActive.get(w.id) ?? false,
      kind: "wash_type" as const,
    })),
    ...addons.map((a) => ({
      service: { id: a.id, slug: a.slug, name: a.name },
      name: a.name,
      price: Number(a.price),
      active: addOnActive.get(a.id) ?? false,
      kind: "add_on" as const,
    })),
  ];
}

router.get("/company/services", requireCompany(), async (req, res): Promise<void> => {
  res.json(await listServicesForCompany(req.user!.companyId!));
});

router.put("/company/services", requireCompany(), async (req, res): Promise<void> => {
  const parsed = UpdateCompanyServicesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const companyId = req.user!.companyId!;

  const ids = parsed.data.services.map((s) => s.serviceId);
  const [matchingWashes, matchingAddOns] = await Promise.all([
    ids.length
      ? db.select({ id: washTypesTable.id }).from(washTypesTable).where(inArray(washTypesTable.id, ids))
      : Promise.resolve([]),
    ids.length
      ? db.select({ id: addOnsTable.id }).from(addOnsTable).where(inArray(addOnsTable.id, ids))
      : Promise.resolve([]),
  ]);
  const washIds = new Set(matchingWashes.map((w) => w.id));
  const addIds = new Set(matchingAddOns.map((a) => a.id));

  for (const s of parsed.data.services) {
    if (washIds.has(s.serviceId)) {
      const exists = await db
        .select()
        .from(companyWashTypesTable)
        .where(
          and(
            eq(companyWashTypesTable.companyId, companyId),
            eq(companyWashTypesTable.washTypeId, s.serviceId),
          ),
        )
        .limit(1);
      if (exists.length) {
        await db
          .update(companyWashTypesTable)
          .set({ active: s.active })
          .where(
            and(
              eq(companyWashTypesTable.companyId, companyId),
              eq(companyWashTypesTable.washTypeId, s.serviceId),
            ),
          );
      } else {
        await db.insert(companyWashTypesTable).values({
          companyId,
          washTypeId: s.serviceId,
          active: s.active,
        });
      }
    } else if (addIds.has(s.serviceId)) {
      const exists = await db
        .select()
        .from(companyAddOnsTable)
        .where(
          and(
            eq(companyAddOnsTable.companyId, companyId),
            eq(companyAddOnsTable.addOnId, s.serviceId),
          ),
        )
        .limit(1);
      if (exists.length) {
        await db
          .update(companyAddOnsTable)
          .set({ active: s.active })
          .where(
            and(
              eq(companyAddOnsTable.companyId, companyId),
              eq(companyAddOnsTable.addOnId, s.serviceId),
            ),
          );
      } else {
        await db.insert(companyAddOnsTable).values({
          companyId,
          addOnId: s.serviceId,
          active: s.active,
        });
      }
    }
  }

  res.json(await listServicesForCompany(companyId));
});

export default router;
