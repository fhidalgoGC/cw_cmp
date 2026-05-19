# CW Empresa

Mobile-first web app (Spanish, Mexico) for car wash companies to manage their assigned bookings, schedule, packages, services, profile, and earnings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 5000, mounted at `/api`)
- `pnpm --filter @workspace/cw-company run dev` — web app (mounted at `/`)
- `pnpm --filter @workspace/scripts run seed` — reset DB with demo data
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks / Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

Test creds: `empresa1@carwash.mx` / `Empresa123`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, scrypt + bearer-token sessions
- DB: PostgreSQL + Drizzle ORM
- Web: React + Vite + wouter + react-query, Tailwind + shadcn/ui, sonner toasts
- API codegen: Orval (OpenAPI → react-query hooks + Zod)

## Where things live

- DB schema: `lib/db/src/schema/index.ts`
- API contract: `lib/api-spec/openapi.yaml` (regen client after edits)
- Auth + role guards: `artifacts/api-server/src/lib/auth.ts`
- Company routes: `artifacts/api-server/src/routes/company/{bookings,catalogs,earnings,profile}.ts`
- Frontend auth context: `artifacts/cw-company/src/lib/auth.tsx`
- Frontend shell / bottom nav: `artifacts/cw-company/src/components/Layout.tsx`
- Pages: `artifacts/cw-company/src/pages/*`
- Seed: `scripts/src/seed.ts`

## Architecture decisions

- Bearer session tokens stored server-side in `sessions` table; client puts token in `localStorage` and the generated Orval client picks it up via `setAuthTokenGetter`.
- Company users can only access their own data — `requireCompany()` middleware injects `req.user.companyId` and every query is scoped by it.
- All "today"/date-range defaults use **local time** (`todayLocalIso` on server, `todayIso` on client) to avoid UTC drift in Mexico.
- Completing a booking auto-creates a `billings` row with the computed total (package OR services + add-ons).
- App is intentionally mobile-only: a `MobileFrame` (max-w 440) wraps everything; desktop just shows the frame centered.

## Product

Logged-in company sees:
- **Dashboard**: today's stats, next booking, quick actions.
- **Bookings**: filterable list + detail with Accept / Reject / Start / Complete actions.
- **Schedule**: per-day slot availability and blocked dates.
- **Packages / Services**: company-specific pricing on catalog items.
- **Earnings**: 30-day totals, breakdown by payment type, per-service ledger.
- **Profile**: contact info, password change.

## User preferences

_None recorded yet._

## Gotchas

- Never use `Date.toISOString().slice(0,10)` for "today" — use the local helpers (`todayLocalIso` / `todayIso`).
- After editing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before relying on new hooks/types.
- `scripts/` is typechecked with `noEmit` and a strict `rootDir`; don't import from `artifacts/*`. Duplicate small utilities or move them to a shared lib.
- Bookings query keys come from generated helpers (e.g. `getGetCompanyBookingQueryKey(id)`); don't hand-roll cache keys.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
