import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

export const usersTable = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // client | company | admin
  companyId: text("company_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companiesTable = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  active: boolean("active").notNull().default(true),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehicleSizesTable = pgTable("vehicle_sizes", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  multiplier: numeric("multiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
});

export const washTypesTable = pgTable("wash_types", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
});

export const addOnsTable = pgTable("add_ons", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
});

export const packagesTable = pgTable("packages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#0ea5e9"),
  washTypeId: text("wash_type_id")
    .notNull()
    .references(() => washTypesTable.id),
});

export const companyWashTypesTable = pgTable(
  "company_wash_types",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    washTypeId: text("wash_type_id")
      .notNull()
      .references(() => washTypesTable.id),
    active: boolean("active").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.washTypeId] })],
);

export const companyAddOnsTable = pgTable(
  "company_add_ons",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    addOnId: text("add_on_id")
      .notNull()
      .references(() => addOnsTable.id),
    active: boolean("active").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.addOnId] })],
);

export const companyPackagesTable = pgTable(
  "company_packages",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    packageId: text("package_id")
      .notNull()
      .references(() => packagesTable.id),
    active: boolean("active").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.packageId] })],
);

export const companySlotsTable = pgTable(
  "company_slots",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0=Sunday ... 6=Saturday
    time: text("time").notNull(), // HH:MM
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.weekday, t.time] })],
);

export const companyBlockedDatesTable = pgTable(
  "company_blocked_dates",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
  },
  (t) => [primaryKey({ columns: [t.companyId, t.date] })],
);

export const bookingsTable = pgTable("bookings", {
  id: id(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id),
  clientId: text("client_id").references(() => usersTable.id),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull().default(""),
  addressFull: text("address_full").notNull(),
  vehicleSizeId: text("vehicle_size_id")
    .notNull()
    .references(() => vehicleSizesTable.id),
  vehicleBrand: text("vehicle_brand"),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  vehiclePlate: text("vehicle_plate"),
  washTypeId: text("wash_type_id")
    .notNull()
    .references(() => washTypesTable.id),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  companyStatus: text("company_status").notNull().default("pending_acceptance"),
  comments: text("comments"),
  rejectReason: text("reject_reason"),
  paymentType: text("payment_type").notNull().default("directo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const bookingAddOnsTable = pgTable(
  "booking_add_ons",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    addOnId: text("add_on_id")
      .notNull()
      .references(() => addOnsTable.id),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.addOnId] })],
);

export const billingsTable = pgTable(
  "billings",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    paymentType: text("payment_type").notNull(), // directo | membresia
    paymentStatus: text("payment_status").notNull().default("pendiente"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("billings_booking_uniq").on(t.bookingId)],
);
