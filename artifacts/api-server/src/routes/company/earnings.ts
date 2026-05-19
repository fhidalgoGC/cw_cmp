import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  billingsTable,
  bookingsTable,
  bookingAddOnsTable,
  vehicleSizesTable,
  washTypesTable,
  addOnsTable,
} from "@workspace/db";
import { requireCompany, todayLocalIso } from "../../lib/auth";

const router: IRouter = Router();

function defaultRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);
  return {
    dateFrom: todayLocalIso(start),
    dateTo: todayLocalIso(today),
  };
}

router.get("/company/earnings", requireCompany(), async (req, res): Promise<void> => {
  const companyId = req.user!.companyId!;
  const def = defaultRange();
  const dateFrom =
    typeof req.query.dateFrom === "string" && req.query.dateFrom
      ? req.query.dateFrom
      : def.dateFrom;
  const dateTo =
    typeof req.query.dateTo === "string" && req.query.dateTo
      ? req.query.dateTo
      : def.dateTo;

  const rows = await db
    .select({
      amount: billingsTable.amount,
      paymentType: billingsTable.paymentType,
      paymentStatus: billingsTable.paymentStatus,
      date: bookingsTable.date,
    })
    .from(billingsTable)
    .innerJoin(bookingsTable, eq(billingsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(billingsTable.companyId, companyId),
        gte(bookingsTable.date, dateFrom),
        lte(bookingsTable.date, dateTo),
      ),
    );

  let total = 0,
    paid = 0,
    pending = 0,
    directo = 0,
    membresia = 0;
  const byDate = new Map<string, { amount: number; services: number }>();
  for (const r of rows) {
    const amt = Number(r.amount);
    total += amt;
    if (r.paymentStatus === "pagado") paid += amt;
    else pending += amt;
    if (r.paymentType === "directo") directo += amt;
    else membresia += amt;
    const e = byDate.get(r.date) ?? { amount: 0, services: 0 };
    e.amount += amt;
    e.services += 1;
    byDate.set(r.date, e);
  }

  const dailySeries: { date: string; amount: number; services: number }[] = [];
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const e = byDate.get(key) ?? { amount: 0, services: 0 };
    dailySeries.push({ date: key, amount: e.amount, services: e.services });
  }

  res.json({
    dateFrom,
    dateTo,
    totalServices: rows.length,
    totalAmount: total,
    pending,
    paid,
    byType: { directo, membresia },
    dailySeries,
  });
});

router.get(
  "/company/earnings/services",
  requireCompany(),
  async (req, res): Promise<void> => {
    const companyId = req.user!.companyId!;
    const def = defaultRange();
    const dateFrom =
      typeof req.query.dateFrom === "string" && req.query.dateFrom
        ? req.query.dateFrom
        : def.dateFrom;
    const dateTo =
      typeof req.query.dateTo === "string" && req.query.dateTo
        ? req.query.dateTo
        : def.dateTo;
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));

    const filters = [
      eq(billingsTable.companyId, companyId),
      gte(bookingsTable.date, dateFrom),
      lte(bookingsTable.date, dateTo),
    ];
    if (typeof req.query.paymentStatus === "string" && req.query.paymentStatus) {
      filters.push(eq(billingsTable.paymentStatus, req.query.paymentStatus));
    }
    if (typeof req.query.paymentType === "string" && req.query.paymentType) {
      filters.push(eq(billingsTable.paymentType, req.query.paymentType));
    }
    const whereExpr = and(...filters)!;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(billingsTable)
      .innerJoin(bookingsTable, eq(billingsTable.bookingId, bookingsTable.id))
      .where(whereExpr);

    const rows = await db
      .select({
        id: billingsTable.id,
        bookingId: billingsTable.bookingId,
        amount: billingsTable.amount,
        paymentType: billingsTable.paymentType,
        paymentStatus: billingsTable.paymentStatus,
        paidAt: billingsTable.paidAt,
        date: bookingsTable.date,
        time: bookingsTable.time,
        clientName: bookingsTable.clientName,
        vehicleSizeId: bookingsTable.vehicleSizeId,
        washTypeId: bookingsTable.washTypeId,
      })
      .from(billingsTable)
      .innerJoin(bookingsTable, eq(billingsTable.bookingId, bookingsTable.id))
      .where(whereExpr)
      .orderBy(desc(bookingsTable.date), desc(bookingsTable.time))
      .limit(limit)
      .offset((page - 1) * limit);

    const bookingIds = rows.map((r) => r.bookingId);
    const sizeIds = [...new Set(rows.map((r) => r.vehicleSizeId))];
    const washIds = [...new Set(rows.map((r) => r.washTypeId))];

    const [sizes, washes, addonLinks] = await Promise.all([
      sizeIds.length
        ? db
            .select({ id: vehicleSizesTable.id, slug: vehicleSizesTable.slug, name: vehicleSizesTable.name })
            .from(vehicleSizesTable)
            .where(inArray(vehicleSizesTable.id, sizeIds))
        : Promise.resolve([]),
      washIds.length
        ? db
            .select({ id: washTypesTable.id, slug: washTypesTable.slug, name: washTypesTable.name })
            .from(washTypesTable)
            .where(inArray(washTypesTable.id, washIds))
        : Promise.resolve([]),
      bookingIds.length
        ? db
            .select({
              bookingId: bookingAddOnsTable.bookingId,
              id: addOnsTable.id,
              slug: addOnsTable.slug,
              name: addOnsTable.name,
            })
            .from(bookingAddOnsTable)
            .innerJoin(addOnsTable, eq(bookingAddOnsTable.addOnId, addOnsTable.id))
            .where(inArray(bookingAddOnsTable.bookingId, bookingIds))
        : Promise.resolve([]),
    ]);
    const sizeMap = new Map(sizes.map((s) => [s.id, s]));
    const washMap = new Map(washes.map((w) => [w.id, w]));
    const addOnsByBooking = new Map<string, { id: string; slug: string; name: string }[]>();
    for (const l of addonLinks) {
      const list = addOnsByBooking.get(l.bookingId) ?? [];
      list.push({ id: l.id, slug: l.slug, name: l.name });
      addOnsByBooking.set(l.bookingId, list);
    }

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        date: r.date,
        time: r.time,
        clientName: r.clientName,
        vehicleSize: sizeMap.get(r.vehicleSizeId)!,
        washType: washMap.get(r.washTypeId)!,
        addOns: addOnsByBooking.get(r.bookingId) ?? [],
        amount: Number(r.amount),
        paymentType: r.paymentType,
        paymentStatus: r.paymentStatus,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      })),
      pagination: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
      },
    });
  },
);

export default router;
