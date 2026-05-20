import { Router, type IRouter, type Request } from "express";
import { and, eq, gte, lte, ilike, or, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingAddOnsTable,
  vehicleSizesTable,
  washTypesTable,
  addOnsTable,
  billingsTable,
  bookingReviewsTable,
} from "@workspace/db";
import { RejectCompanyBookingBody } from "@workspace/api-zod";
import { requireCompany, todayLocalIso } from "../../lib/auth";

const router: IRouter = Router();

type BookingRow = typeof bookingsTable.$inferSelect;
type CatalogRow = { id: string; slug: string; name: string };

async function serializeBookings(rows: BookingRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((b) => b.id);
  const sizeIds = [...new Set(rows.map((b) => b.vehicleSizeId))];
  const washIds = [...new Set(rows.map((b) => b.washTypeId))];

  const [sizes, washes, links, reviews] = await Promise.all([
    db
      .select({ id: vehicleSizesTable.id, slug: vehicleSizesTable.slug, name: vehicleSizesTable.name })
      .from(vehicleSizesTable)
      .where(inArray(vehicleSizesTable.id, sizeIds)),
    db
      .select({ id: washTypesTable.id, slug: washTypesTable.slug, name: washTypesTable.name })
      .from(washTypesTable)
      .where(inArray(washTypesTable.id, washIds)),
    db
      .select({
        bookingId: bookingAddOnsTable.bookingId,
        id: addOnsTable.id,
        slug: addOnsTable.slug,
        name: addOnsTable.name,
      })
      .from(bookingAddOnsTable)
      .innerJoin(addOnsTable, eq(bookingAddOnsTable.addOnId, addOnsTable.id))
      .where(inArray(bookingAddOnsTable.bookingId, ids)),
    db
      .select({
        bookingId: bookingReviewsTable.bookingId,
        rating: bookingReviewsTable.rating,
        comment: bookingReviewsTable.comment,
        createdAt: bookingReviewsTable.createdAt,
      })
      .from(bookingReviewsTable)
      .where(inArray(bookingReviewsTable.bookingId, ids)),
  ]);
  const reviewByBooking = new Map(reviews.map((r) => [r.bookingId, r]));

  const sizeMap = new Map(sizes.map((s) => [s.id, s]));
  const washMap = new Map(washes.map((w) => [w.id, w]));
  const addOnsByBooking = new Map<string, CatalogRow[]>();
  for (const l of links) {
    const list = addOnsByBooking.get(l.bookingId) ?? [];
    list.push({ id: l.id, slug: l.slug, name: l.name });
    addOnsByBooking.set(l.bookingId, list);
  }

  return rows.map((b) => ({
    id: b.id,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    addressFull: b.addressFull,
    vehicleSize: sizeMap.get(b.vehicleSizeId)!,
    vehicleBrand: b.vehicleBrand,
    vehicleModel: b.vehicleModel,
    vehicleColor: b.vehicleColor,
    vehiclePlate: b.vehiclePlate,
    washType: washMap.get(b.washTypeId)!,
    addOns: addOnsByBooking.get(b.id) ?? [],
    date: b.date,
    time: b.time,
    totalPrice: Number(b.totalPrice),
    status: b.status,
    companyStatus: b.companyStatus,
    comments: b.comments,
    review: (() => {
      const r = reviewByBooking.get(b.id);
      if (!r) return null;
      return {
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      };
    })(),
    createdAt: b.createdAt.toISOString(),
  }));
}

function buildFilters(req: Request) {
  const companyId = req.user!.companyId!;
  const filters = [eq(bookingsTable.companyId, companyId)];
  const q = req.query;
  if (typeof q.date === "string" && q.date) {
    filters.push(eq(bookingsTable.date, q.date));
  } else {
    if (typeof q.dateFrom === "string" && q.dateFrom) {
      filters.push(gte(bookingsTable.date, q.dateFrom));
    }
    if (typeof q.dateTo === "string" && q.dateTo) {
      filters.push(lte(bookingsTable.date, q.dateTo));
    }
  }
  if (typeof q.companyStatus === "string" && q.companyStatus) {
    filters.push(eq(bookingsTable.companyStatus, q.companyStatus));
  }
  if (typeof q.status === "string" && q.status) {
    filters.push(eq(bookingsTable.status, q.status));
  }
  if (typeof q.search === "string" && q.search) {
    const term = `%${q.search}%`;
    const orExpr = or(
      ilike(bookingsTable.clientName, term),
      ilike(bookingsTable.addressFull, term),
      ilike(bookingsTable.vehiclePlate, term),
    );
    if (orExpr) filters.push(orExpr);
  }
  return and(...filters)!;
}

router.get("/company/bookings", requireCompany(), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const whereExpr = buildFilters(req);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(whereExpr);

  const rows = await db
    .select()
    .from(bookingsTable)
    .where(whereExpr)
    .orderBy(desc(bookingsTable.date), desc(bookingsTable.time))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: await serializeBookings(rows),
    pagination: {
      total: Number(total),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    },
  });
});

router.get("/company/dashboard", requireCompany(), async (req, res): Promise<void> => {
  const companyId = req.user!.companyId!;
  const date =
    typeof req.query.date === "string" && req.query.date
      ? req.query.date
      : todayLocalIso();

  const todayRows = await db
    .select()
    .from(bookingsTable)
    .where(
      and(eq(bookingsTable.companyId, companyId), eq(bookingsTable.date, date)),
    )
    .orderBy(bookingsTable.time);

  const serialized = await serializeBookings(todayRows);

  const summary = {
    total: serialized.length,
    pendingAcceptance: serialized.filter((b) => b.companyStatus === "pending_acceptance").length,
    accepted: serialized.filter((b) => b.status === "accepted").length,
    inProgress: serialized.filter((b) => b.status === "in_progress").length,
    completed: serialized.filter((b) => b.status === "completed").length,
    cancelled: serialized.filter((b) => b.status === "cancelled").length,
    revenueToday: serialized
      .filter((b) => b.status === "completed")
      .reduce((s, b) => s + b.totalPrice, 0),
  };

  const active = serialized.find((b) => b.status === "in_progress");
  const upcoming = serialized.filter(
    (b) => b.status === "accepted" || b.status === "pending",
  );
  const nextBooking = active ?? upcoming[0] ?? null;

  res.json({
    date,
    summary,
    nextBooking,
    upcoming: serialized.filter(
      (b) => b.status !== "completed" && b.status !== "cancelled",
    ),
  });
});

async function getOneBookingOrFail(req: Request) {
  const id = req.params.bookingId;
  if (typeof id !== "string") return null;
  const [row] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(eq(bookingsTable.id, id), eq(bookingsTable.companyId, req.user!.companyId!)),
    )
    .limit(1);
  return row ?? null;
}

router.get(
  "/company/bookings/:bookingId",
  requireCompany(),
  async (req, res): Promise<void> => {
    const row = await getOneBookingOrFail(req);
    if (!row) {
      res.status(404).json({ error: "Reserva no encontrada" });
      return;
    }
    const [serialized] = await serializeBookings([row]);
    res.json(serialized);
  },
);

router.put(
  "/company/bookings/:bookingId/accept",
  requireCompany(),
  async (req, res): Promise<void> => {
    const row = await getOneBookingOrFail(req);
    if (!row) {
      res.status(404).json({ error: "Reserva no encontrada" });
      return;
    }
    if (row.companyStatus !== "pending_acceptance") {
      res.status(409).json({ error: "La reserva ya no está en aceptación" });
      return;
    }
    await db
      .update(bookingsTable)
      .set({ companyStatus: "accepted_by_company", status: "accepted" })
      .where(eq(bookingsTable.id, row.id));
    const [updated] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, row.id));
    const [serialized] = await serializeBookings([updated]);
    res.json(serialized);
  },
);

router.put(
  "/company/bookings/:bookingId/reject",
  requireCompany(),
  async (req, res): Promise<void> => {
    const parsed = RejectCompanyBookingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const row = await getOneBookingOrFail(req);
    if (!row) {
      res.status(404).json({ error: "Reserva no encontrada" });
      return;
    }
    if (row.companyStatus !== "pending_acceptance") {
      res.status(409).json({ error: "La reserva ya no se puede rechazar" });
      return;
    }
    await db
      .update(bookingsTable)
      .set({
        companyStatus: "rejected_by_company",
        status: "cancelled",
        rejectReason: parsed.data.reason,
      })
      .where(eq(bookingsTable.id, row.id));
    const [updated] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, row.id));
    const [serialized] = await serializeBookings([updated]);
    res.json(serialized);
  },
);

router.put(
  "/company/bookings/:bookingId/start",
  requireCompany(),
  async (req, res): Promise<void> => {
    const row = await getOneBookingOrFail(req);
    if (!row) {
      res.status(404).json({ error: "Reserva no encontrada" });
      return;
    }
    if (row.status !== "accepted") {
      res.status(409).json({ error: "Solo reservas aceptadas se pueden iniciar" });
      return;
    }
    await db
      .update(bookingsTable)
      .set({ status: "in_progress" })
      .where(eq(bookingsTable.id, row.id));
    const [updated] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, row.id));
    const [serialized] = await serializeBookings([updated]);
    res.json(serialized);
  },
);

router.put(
  "/company/bookings/:bookingId/complete",
  requireCompany(),
  async (req, res): Promise<void> => {
    const row = await getOneBookingOrFail(req);
    if (!row) {
      res.status(404).json({ error: "Reserva no encontrada" });
      return;
    }
    if (row.status !== "in_progress") {
      res.status(409).json({ error: "Solo reservas en curso se pueden completar" });
      return;
    }
    await db
      .update(bookingsTable)
      .set({ status: "completed" })
      .where(eq(bookingsTable.id, row.id));

    // Auto-create billing line (if not exists)
    const existing = await db
      .select({ id: billingsTable.id })
      .from(billingsTable)
      .where(eq(billingsTable.bookingId, row.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(billingsTable).values({
        bookingId: row.id,
        companyId: row.companyId,
        amount: row.totalPrice,
        paymentType: row.paymentType,
        paymentStatus: row.paymentType === "membresia" ? "pendiente" : "pagado",
        paidAt: row.paymentType === "membresia" ? null : new Date(),
      });
    }
    const [updated] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, row.id));
    const [serialized] = await serializeBookings([updated]);
    res.json(serialized);
  },
);

export default router;
