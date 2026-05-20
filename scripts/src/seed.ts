import {
  db,
  usersTable,
  companiesTable,
  vehicleSizesTable,
  washTypesTable,
  addOnsTable,
  packagesTable,
  companyWashTypesTable,
  companyAddOnsTable,
  companyPackagesTable,
  companySlotsTable,
  bookingsTable,
  bookingReviewsTable,
  bookingAddOnsTable,
  billingsTable,
} from "@workspace/db";
import { scryptSync, randomBytes } from "node:crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function clear() {
  await db.delete(bookingReviewsTable);
  await db.delete(billingsTable);
  await db.delete(bookingAddOnsTable);
  await db.delete(bookingsTable);
  await db.delete(companySlotsTable);
  await db.delete(companyPackagesTable);
  await db.delete(companyWashTypesTable);
  await db.delete(companyAddOnsTable);
  await db.delete(packagesTable);
  await db.delete(addOnsTable);
  await db.delete(washTypesTable);
  await db.delete(vehicleSizesTable);
  await db.delete(usersTable);
  await db.delete(companiesTable);
}

async function main() {
  console.log("Seeding...");
  await clear();

  // Catalogs
  const sizes = await db
    .insert(vehicleSizesTable)
    .values([
      { slug: "chico", name: "Chico", multiplier: "1.00" },
      { slug: "mediano", name: "Mediano", multiplier: "1.20" },
      { slug: "grande", name: "Grande", multiplier: "1.50" },
    ])
    .returning();

  const washes = await db
    .insert(washTypesTable)
    .values([
      { slug: "basico", name: "Lavado Básico", basePrice: "150.00" },
      { slug: "premium", name: "Lavado Premium", basePrice: "280.00" },
      { slug: "detallado", name: "Detallado Completo", basePrice: "650.00" },
      { slug: "express", name: "Lavado Express", basePrice: "99.00" },
      { slug: "encerado", name: "Encerado a Mano", basePrice: "450.00" },
    ])
    .returning();

  const addons = await db
    .insert(addOnsTable)
    .values([
      { slug: "interior", name: "Limpieza Interior", price: "120.00" },
      { slug: "motor", name: "Lavado de Motor", price: "180.00" },
      { slug: "tapiceria", name: "Lavado de Tapicería", price: "350.00" },
      { slug: "aromatizante", name: "Aromatizante Premium", price: "60.00" },
      { slug: "rines", name: "Pulido de Rines", price: "140.00" },
      { slug: "vidrios", name: "Tratamiento de Vidrios", price: "200.00" },
      { slug: "llantas", name: "Brillo en Llantas", price: "80.00" },
      { slug: "cera", name: "Aplicación de Cera", price: "220.00" },
    ])
    .returning();

  const washBySlug = Object.fromEntries(washes.map((w) => [w.slug, w]));

  const packages = await db
    .insert(packagesTable)
    .values([
      {
        slug: "esencial",
        name: "Plan Esencial",
        color: "#0ea5e9",
        washTypeId: washBySlug["basico"].id,
      },
      {
        slug: "completo",
        name: "Plan Completo",
        color: "#6366f1",
        washTypeId: washBySlug["premium"].id,
      },
      {
        slug: "elite",
        name: "Plan Élite",
        color: "#f59e0b",
        washTypeId: washBySlug["detallado"].id,
      },
    ])
    .returning();

  // Company + user
  const [company] = await db
    .insert(companiesTable)
    .values({
      name: "Lavadero El Sol",
      email: "empresa1@carwash.mx",
      phone: "+52 55 1234 5678",
      active: true,
      status: "active",
      rating: "4.80",
    })
    .returning();

  await db.insert(usersTable).values([
    {
      name: "Admin",
      email: "admin@carwash.mx",
      phone: "+52 55 0000 0000",
      passwordHash: hashPassword("Admin123"),
      role: "admin",
    },
    {
      name: "Carlos Méndez",
      email: "empresa1@carwash.mx",
      phone: "+52 55 1234 5678",
      passwordHash: hashPassword("Empresa123"),
      role: "company",
      companyId: company.id,
    },
  ]);

  // Clients
  const clientUsers = await db
    .insert(usersTable)
    .values([
      {
        name: "Ana López",
        email: "ana@cliente.mx",
        phone: "+52 55 1010 2020",
        passwordHash: hashPassword("Cliente123"),
        role: "client",
      },
      {
        name: "Jorge Ramírez",
        email: "jorge@cliente.mx",
        phone: "+52 55 3030 4040",
        passwordHash: hashPassword("Cliente123"),
        role: "client",
      },
      {
        name: "María Fernanda",
        email: "mafer@cliente.mx",
        phone: "+52 55 5050 6060",
        passwordHash: hashPassword("Cliente123"),
        role: "client",
      },
      {
        name: "Diego Salas",
        email: "diego@cliente.mx",
        phone: "+52 55 7070 8080",
        passwordHash: hashPassword("Cliente123"),
        role: "client",
      },
    ])
    .returning();

  // Company offers everything
  await db.insert(companyWashTypesTable).values(
    washes.map((w) => ({ companyId: company.id, washTypeId: w.id, active: true })),
  );
  await db.insert(companyAddOnsTable).values(
    addons.map((a) => ({ companyId: company.id, addOnId: a.id, active: true })),
  );
  await db.insert(companyPackagesTable).values(
    packages.map((p) => ({ companyId: company.id, packageId: p.id, active: true })),
  );

  // Slots per weekday: Mon-Fri 08:00-17:30, Sat 09:00-14:30, Sunday closed
  const slots: {
    companyId: string;
    weekday: number;
    time: string;
    enabled: boolean;
  }[] = [];
  const ranges: Record<number, { from: number; to: number } | null> = {
    0: null, // Sunday closed
    1: { from: 8, to: 18 },
    2: { from: 8, to: 18 },
    3: { from: 8, to: 18 },
    4: { from: 8, to: 18 },
    5: { from: 8, to: 18 },
    6: { from: 9, to: 15 },
  };
  for (let wd = 0; wd < 7; wd++) {
    const r = ranges[wd];
    for (let h = 8; h < 18; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const hMin = h * 60 + m;
        const enabled = r ? hMin >= r.from * 60 && hMin < r.to * 60 : false;
        slots.push({ companyId: company.id, weekday: wd, time, enabled });
      }
    }
  }
  await db.insert(companySlotsTable).values(slots);

  // Bookings — across the last 30 days + today + tomorrow
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const bookingsToInsert: Array<{
    booking: typeof bookingsTable.$inferInsert;
    addOnIds: string[];
    billing?: { status: string; paid: boolean };
  }> = [];

  const fixtures = [
    { offset: -25, time: "09:00", client: 0, size: 0, wash: "basico", addons: ["interior"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: -22, time: "11:30", client: 1, size: 1, wash: "premium", addons: ["motor", "aromatizante"], status: "completed", companyStatus: "accepted_by_company", paymentType: "membresia" },
    { offset: -18, time: "14:00", client: 2, size: 2, wash: "detallado", addons: ["tapiceria", "cera"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: -14, time: "10:00", client: 3, size: 0, wash: "express", addons: [], status: "completed", companyStatus: "accepted_by_company", paymentType: "membresia" },
    { offset: -10, time: "16:00", client: 0, size: 1, wash: "encerado", addons: ["rines"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: -7, time: "12:00", client: 1, size: 2, wash: "premium", addons: ["interior", "vidrios"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: -5, time: "09:30", client: 2, size: 0, wash: "basico", addons: ["llantas"], status: "completed", companyStatus: "accepted_by_company", paymentType: "membresia" },
    { offset: -3, time: "15:30", client: 3, size: 1, wash: "premium", addons: ["aromatizante"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: -1, time: "11:00", client: 0, size: 2, wash: "detallado", addons: ["tapiceria"], status: "completed", companyStatus: "accepted_by_company", paymentType: "directo" },
    // today
    { offset: 0, time: "08:30", client: 1, size: 0, wash: "express", addons: [], status: "completed", companyStatus: "accepted_by_company", paymentType: "membresia" },
    { offset: 0, time: "10:00", client: 2, size: 1, wash: "premium", addons: ["interior"], status: "in_progress", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: 0, time: "12:30", client: 3, size: 2, wash: "detallado", addons: ["cera", "tapiceria"], status: "accepted", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: 0, time: "15:00", client: 0, size: 1, wash: "encerado", addons: ["rines"], status: "pending", companyStatus: "pending_acceptance", paymentType: "directo" },
    { offset: 0, time: "16:30", client: 1, size: 0, wash: "basico", addons: ["aromatizante"], status: "pending", companyStatus: "pending_acceptance", paymentType: "membresia" },
    // tomorrow
    { offset: 1, time: "09:00", client: 2, size: 2, wash: "premium", addons: ["motor"], status: "accepted", companyStatus: "accepted_by_company", paymentType: "directo" },
    { offset: 1, time: "13:00", client: 3, size: 1, wash: "detallado", addons: ["tapiceria", "vidrios"], status: "pending", companyStatus: "pending_acceptance", paymentType: "directo" },
  ] as const;

  const addOnBySlug = Object.fromEntries(addons.map((a) => [a.slug, a]));

  for (const f of fixtures) {
    const date = new Date(today);
    date.setDate(today.getDate() + f.offset);
    const wash = washBySlug[f.wash];
    const size = sizes[f.size];
    const selectedAddons = f.addons.map((s) => addOnBySlug[s]);
    const base =
      Number(wash.basePrice) * Number(size.multiplier) +
      selectedAddons.reduce((s, a) => s + Number(a.price), 0);
    const client = clientUsers[f.client];
    bookingsToInsert.push({
      booking: {
        companyId: company.id,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        addressFull: ["Av. Reforma 123, CDMX", "Insurgentes Sur 456, CDMX", "Polanco 789, CDMX", "Coyoacán 321, CDMX"][f.client],
        vehicleSizeId: size.id,
        vehicleBrand: ["Toyota", "Honda", "Mazda", "Volkswagen"][f.client],
        vehicleModel: ["Corolla", "Civic", "CX-5", "Jetta"][f.client],
        vehicleColor: ["Blanco", "Negro", "Rojo", "Azul"][f.client],
        vehiclePlate: `ABC-${100 + f.client}${f.offset + 30}`,
        washTypeId: wash.id,
        date: fmt(date),
        time: f.time,
        totalPrice: base.toFixed(2),
        status: f.status,
        companyStatus: f.companyStatus,
        paymentType: f.paymentType,
      },
      addOnIds: selectedAddons.map((a) => a.id),
      billing: f.status === "completed" ? { status: f.paymentType === "membresia" ? "pendiente" : "pagado", paid: f.paymentType !== "membresia" } : undefined,
    });
  }

  for (const item of bookingsToInsert) {
    const [b] = await db.insert(bookingsTable).values(item.booking).returning();
    if (item.addOnIds.length > 0) {
      await db
        .insert(bookingAddOnsTable)
        .values(item.addOnIds.map((id) => ({ bookingId: b.id, addOnId: id })));
    }
    if (item.billing) {
      await db.insert(billingsTable).values({
        bookingId: b.id,
        companyId: company.id,
        amount: b.totalPrice,
        paymentType: b.paymentType,
        paymentStatus: item.billing.status,
        paidAt: item.billing.paid ? new Date() : null,
      });
    }
  }

  // Reviews — most completed bookings get a customer review
  const allBookings = await db.select().from(bookingsTable);
  const completedBookings = allBookings.filter((b) => b.status === "completed");
  const reviewFixtures: Array<{ rating: number; comment: string | null }> = [
    { rating: 5, comment: "Excelente servicio, quedó como nuevo. Muy puntuales." },
    { rating: 5, comment: "Súper recomendados, atención de primera." },
    { rating: 4, comment: "Buen trabajo, aunque llegaron 10 min tarde." },
    { rating: 5, comment: "Increíble detallado, vale cada peso." },
    { rating: 4, comment: "Todo bien, repetiría." },
    { rating: 3, comment: "Cumplieron, pero esperaba un poco más en los rines." },
    { rating: 5, comment: null },
    { rating: 5, comment: "Muy amables y rápidos." },
    { rating: 4, comment: "Buena relación calidad-precio." },
  ];
  let ri = 0;
  for (const cb of completedBookings) {
    // Skip a couple to simulate pending reviews
    if (ri % 5 === 4) {
      ri++;
      continue;
    }
    const fx = reviewFixtures[ri % reviewFixtures.length];
    await db.insert(bookingReviewsTable).values({
      bookingId: cb.id,
      companyId: cb.companyId,
      clientId: cb.clientId,
      rating: fx.rating,
      comment: fx.comment,
    });
    ri++;
  }

  console.log("Seed done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
