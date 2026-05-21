# Documentación funcional — CW Empresa

Una ficha por pantalla del panel de empresa. Cada ficha describe:

- **Qué hace** — visión de producto (qué problema resuelve y qué ve el usuario).
- **Ruta** — path en el frontend.
- **Datos** — endpoints `GET` que la pantalla consume y la forma del payload.
- **Acciones** — mutaciones (POST/PUT) con su payload de entrada.
- **Estados y variantes** — qué cambia según rol, estatus o filtros.
- **Componentes clave** — referencias al código.

## Índice de pantallas

| Pantalla | Ruta | Archivo |
| --- | --- | --- |
| Login | `/login` | [login.md](./login.md) |
| Dashboard | `/` | [dashboard.md](./dashboard.md) |
| Reservas (lista) | `/bookings` | [bookings.md](./bookings.md) |
| Detalle de reserva | `/bookings/:id` | [booking-detail.md](./booking-detail.md) |
| Horarios | `/schedule` | [schedule.md](./schedule.md) |
| Paquetes | `/packages` | [packages.md](./packages.md) |
| Servicios | `/services` | [services.md](./services.md) |
| Ingresos | `/earnings` | [earnings.md](./earnings.md) |
| Perfil | `/profile` | [profile.md](./profile.md) |
| Datos del negocio | `/company-data` | [company-data.md](./company-data.md) |

## Convenciones globales

- App **mobile-only**, envuelta en `MobileFrame` (máx. 440 px).
- Idioma **español (MX)**, monedas en **MXN**, fechas en **hora local** (helpers `todasIso` / `todayLocalIso`).
- Autenticación por **bearer token** (`Authorization: Bearer <token>`) almacenado en `localStorage`.
- Cliente API generado con **Orval** desde `lib/api-spec/openapi.yaml` → hooks `react-query` y schemas Zod.
- Toasts con **sonner**, badges de estado en `components/StatusBadge.tsx`.
- Todas las rutas de empresa cuelgan de `/api/company/*` y exigen `requireCompany()`, que inyecta `req.user.companyId` y limita los queries a esa empresa.
