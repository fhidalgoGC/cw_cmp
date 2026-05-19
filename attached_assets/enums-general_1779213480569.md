# Enums Generales — Car Wash

> Tipos enumerados y uniones que se usan en los **tres APIs** (cliente, empresa, plataforma). Definición canónica — estos tipos viven en `shared/types.ts` en el proyecto.

---

## `BookingStatus` — estado de una cita

```typescript
type BookingStatus =
  | "pending"      // recién creada, esperando que la empresa la acepte
  | "accepted"     // empresa aceptó
  | "in_progress"  // servicio en curso
  | "completed"    // servicio terminado
  | "cancelled";   // cancelada por cliente, empresa o admin
```

---

## `CompanyBookingStatus` — estado de aceptación por la empresa

```typescript
type CompanyBookingStatus =
  | "pending_acceptance"    // la empresa aún no ha respondido
  | "accepted_by_company"   // empresa confirmó la cita
  | "rejected_by_company";  // empresa rechazó la cita
```

---

## `MembershipStatus` — estado de una membresía

```typescript
type MembershipStatus =
  | "active"     // vigente y con lavadas disponibles
  | "expired"    // fecha de expiración alcanzada o lavadas agotadas
  | "cancelled"; // cancelada antes de expirar
```

---

## `CancelledBy` — actor que canceló una cita

```typescript
type CancelledBy =
  | "client"   // el propio cliente canceló
  | "company"  // la empresa rechazó o canceló
  | "admin"    // la plataforma canceló
  | "system";  // cancelación automática (ej. expiración de reserva)
```

---

## `PaymentStatus` — estado de liquidación de un cobro

```typescript
type PaymentStatus =
  | "pendiente"  // cobro generado, aún no liquidado a la empresa
  | "pagado";    // la plataforma liquidó el cobro a la empresa
```

---

## `PaymentType` — origen del pago de una cita

```typescript
type PaymentType =
  | "directo"   // cliente pagó el servicio individualmente
  | "membresia"; // la cita fue cubierta por una membresía activa
```

---

## `UserRole` — rol de usuario

```typescript
type UserRole = "client" | "company" | "admin";
```

| Valor | Descripción | Prefijo de API |
|---|---|---|
| `"client"` | Cliente que solicita servicios | `/api/client` |
| `"company"` | Usuario de empresa de lavado | `/api/company` |
| `"admin"` | Operador de la plataforma | `/api/platform` |

---

## `Collection` — colecciones del sistema

Alias opacos que identifican tablas en requests y responses. Los valores **no coinciden** con ningún nombre de tabla DynamoDB. El backend mantiene el mapeo alias → tabla de forma privada.

```typescript
enum Collection {
  // Entidades principales
  USERS                 = "usr",
  COMPANIES             = "cmp",
  VEHICLES              = "vhc",
  ADDRESSES             = "adr",
  MEMBERSHIPS           = "mbs",
  BOOKINGS              = "bkg",
  BILLINGS              = "bil",
  SESSIONS              = "ses",

  // Configuración de empresa
  COMPANY_AVAILABILITY  = "cav",
  COMPANY_PACKAGES      = "cpk",
  COMPANY_SERVICES      = "csrv",

  // Configuración global
  GLOBAL_AVAILABILITY   = "gav",
  ID_REGISTRY           = "idr",

  // Catálogos
  CATALOG_PACKAGES      = "ctpk",
  CATALOG_SERVICES      = "ctsv",
  CATALOG_WASH_TYPES    = "ctwt",
  CATALOG_VEHICLE_SIZES = "ctvs",
  CATALOG_ZONES         = "ctzn",
}
```

**Regla:** ningún campo de request o response expone el nombre real de una tabla. Si un campo identifica una colección, usa este enum.

**Mapeo interno (solo backend — nunca expuesto en el API):**

| Alias    | Tabla DynamoDB                  |
|----------|---------------------------------|
| `"usr"`  | `users`                 |
| `"cmp"`  | `carwash_companies`             |
| `"vhc"`  | `carwash_vehicles`              |
| `"adr"`  | `carwash_addresses`             |
| `"mbs"`  | `carwash_memberships`           |
| `"bkg"`  | `carwash_bookings`              |
| `"bil"`  | `carwash_billings`              |
| `"ses"`  | `sessions`              |
| `"cav"`  | `carwash_company_availability`  |
| `"cpk"`  | `carwash_company_packages`      |
| `"csrv"` | `carwash_company_services`      |
| `"gav"`  | `carwash_global_availability`   |
| `"idr"`  | `id_registry`           |
| `"ctpk"` | `carwash_catalog_packages`      |
| `"ctsv"` | `carwash_catalog_services`      |
| `"ctwt"` | `carwash_catalog_wash_types`    |
| `"ctvs"` | `carwash_catalog_vehicle_sizes` |
| `"ctzn"` | `carwash_catalog_zones`         |

---

## `ErrorCode` — códigos de error estándar

Códigos que el backend usa en el campo `error.code` del wrapper `ApiError`. Los códigos específicos de cada endpoint se documentan en su propia sección; estos son los que aplican a **todos los endpoints**.

```typescript
enum ErrorCode {
  // Autenticación
  MISSING_TOKEN     = "MISSING_TOKEN",      // 401 — header `token` ausente
  INVALID_TOKEN     = "INVALID_TOKEN",      // 401 — token inválido, expirado o sesión cerrada
  UNAUTHORIZED_ROLE = "UNAUTHORIZED_ROLE",  // 403 — rol no autorizado para este API

  // Esquema de request (POST y PUT)
  MISSING_FIELD     = "MISSING_FIELD",      // 400 — campo requerido ausente o null
  INVALID_TYPE      = "INVALID_TYPE",       // 400 — tipo de dato incorrecto
  UNKNOWN_FIELD     = "UNKNOWN_FIELD",      // 400 — propiedad no definida en la interfaz

  // Referencias de catálogo (CatalogRef)
  INVALID_SIZE      = "INVALID_SIZE",       // 400 — vehicleSize no válido
  INVALID_WASH_TYPE = "INVALID_WASH_TYPE",  // 400 — washType no válido
  INVALID_PACKAGE   = "INVALID_PACKAGE",    // 400 — package no válido
  INVALID_SERVICE   = "INVALID_SERVICE",    // 400 — service no válido
  INVALID_ADDON     = "INVALID_ADDON",      // 400 — addOn no válido
  INVALID_LOCATION  = "INVALID_LOCATION",   // 400 — zona de cobertura no válida
}
```

> Los códigos de validación de `CatalogRef` aplican cuando el `id` no existe, el `slug` no coincide o el registro está eliminado (`deletedAt ≠ null`). Ver `api-rules.md` § 2 para el detalle del flujo.
