# Plan de API — App Empresa (Car Wash)

> Documento de planeación. Ningún endpoint existe aún. Describe todos los endpoints que consume la **app de la empresa de lavado** para gestionar las citas que le son asignadas, sus horarios, los paquetes que trabaja y los servicios que ofrece.
>
> Prefijo base: `/api/company`  
> Auth compartida: `/api/auth`  
> Formato: JSON  
> Autenticación: header `token: <jwt>` requerido en todos los endpoints excepto `/api/auth/login` — ver `api-rules.md`  
> Todos los endpoints requieren `role: "company"`. El backend retorna `403 FORBIDDEN` si un cliente o admin intenta acceder.

---

## Tipos compartidos

> Los tipos base (`User`, `Booking`, `BookingStatus`, `CatalogRef`, `ApiResponse<T>`, `PaginatedResponse<T>`, etc.) están definidos en `shared/types.ts`. Ver `api-plan-client.md` para la referencia completa. `VehicleSize` y `WashType` ya no son enums — se expresan como `CatalogRef`.

Tipos adicionales propios de empresa:

```typescript
// Perfil de la empresa autenticada
interface CompanyProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  rating?: number;
  createdAt: string; // ISO
}

// Disponibilidad de la empresa
interface CompanyAvailability {
  slots: CompanySlot[];
  blockedDates: string[]; // "YYYY-MM-DD"
}

interface CompanySlot {
  time: string;       // "09:00 AM"
  enabled: boolean;
}

// Referencia a cualquier ítem de catálogo — siempre con id + slug
interface CatalogRef {
  id: string;   // UUID del ítem en el catálogo
  slug: string; // identificador legible, ej. "premium", "small", "rines"
}

// Cita asignada a la empresa (vista de empresa)
interface CompanyBookingItem {
  id: string;
  clientName: string;
  clientPhone: string;
  addressFull: string;         // dirección formateada del servicio
  vehicleSize: CatalogRef;     // ref a carwash_catalog_vehicle_sizes
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  washType: CatalogRef;        // ref a carwash_catalog_wash_types
  addOns: CatalogRef[];        // refs a carwash_catalog_services
  date: string;                // "YYYY-MM-DD"
  time: string;                // "10:00 AM"
  totalPrice: number;
  status: BookingStatus;
  companyStatus:
    | "pending_acceptance"     // recién asignada, esperando respuesta
    | "accepted_by_company"    // empresa aceptó
    | "rejected_by_company";   // empresa rechazó
  comments?: string;           // comentarios del cliente
  createdAt: string;
}

// Paquete del catálogo con bandera de si la empresa lo trabaja
interface CompanyPackageOption {
  package: CatalogRef;   // ref a carwash_catalog_packages
  name: string;
  washType: CatalogRef;  // ref a carwash_catalog_wash_types
  active: boolean;       // true = esta empresa trabaja este paquete
}

// Servicio del catálogo con bandera de si la empresa lo ofrece
interface CompanyServiceOption {
  service: CatalogRef;   // ref a carwash_catalog_services
  name: string;
  price: number;
  active: boolean;       // true = esta empresa ofrece este servicio
}
```

---

## 1. Autenticación — `/api/auth`

La empresa usa los mismos endpoints de auth compartidos. El token resultante tiene `role: "company"`.

### `POST /api/auth/login`
> **Tablas DynamoDB:** `users` (R), `sessions` (W — crea sesión con token, userId, role, expiresAt)

Inicia sesión con las credenciales asignadas por la plataforma.

**Request body:**
```typescript
interface LoginRequest {
  email: string;    // obligatorio
  password: string; // obligatorio
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `email` o `password`
- `400 INVALID_EMAIL_FORMAT` — el email no tiene formato válido

**Response `200`:**
```typescript
interface LoginResponse {
  user: User; // user.role === "company"
  token: string; // JWT — debe enviarse en el header `token` en todas las requests posteriores
}
// ApiResponse<LoginResponse>
```

**Errores:**
- `401 INVALID_CREDENTIALS`

---

### `GET /api/auth/me`
> **Tablas DynamoDB:** `users` (R)

Devuelve la empresa autenticada.

**Response `200`:** `ApiResponse<User>`

---

### `POST /api/auth/logout`
> **Tablas DynamoDB:** `sessions` (W — asigna `deletedAt` → now)

Invalida la sesión actual. El backend lee el token del header `token`, busca el registro en `sessions` y asigna `deletedAt = ahora`. Requiere auth.

**Request body:** vacío  
**Response `200`:** `ApiResponse<{ message: string }>`

---

## 2. Perfil de Empresa — `/api/company/profile`

### `GET /api/company/profile`
> **Tablas DynamoDB:** `carwash_companies`, `users` (R)

Devuelve los datos de la empresa autenticada.

**Response `200`:** `ApiResponse<CompanyProfile>`

---

### `PUT /api/company/profile`
> **Tablas DynamoDB:** `carwash_companies` (W)

Actualiza nombre y teléfono. El email y contraseña los gestiona la plataforma.

**Request body:**
```typescript
interface UpdateCompanyProfileRequest {
  name?: string;  // opcional — mín. 2 caracteres si se envía
  phone?: string; // opcional — 10 dígitos numéricos si se envía
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar al menos un campo
- `400 INVALID_PHONE` — teléfono no tiene 10 dígitos numéricos

**Response `200`:** `ApiResponse<CompanyProfile>`

---

## 3. Citas Asignadas — `/api/company/bookings`

### `GET /api/company/bookings`
> **Tablas DynamoDB:** `carwash_bookings` (R — GSI: `companyId-date-index`)

Lista las citas asignadas a esta empresa. Por defecto muestra las de hoy.

**Query params:**
```typescript
interface GetCompanyBookingsQuery {
  date?: string;         // opcional — "YYYY-MM-DD" (exclusivo con dateFrom/dateTo)
  dateFrom?: string;     // opcional — "YYYY-MM-DD"
  dateTo?: string;       // opcional — "YYYY-MM-DD", debe ser >= dateFrom
  companyStatus?:        // opcional
    | "pending_acceptance"
    | "accepted_by_company"
    | "rejected_by_company";
  status?: BookingStatus;// opcional
  search?: string;       // opcional
  page?: number;         // opcional — default: 1, entero positivo
  limit?: number;        // opcional — default: 20, máx. 100
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — `date`, `dateFrom` o `dateTo` no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`
- `400 INVALID_STATUS` — `status` o `companyStatus` no es un valor válido

**Response `200`:** `PaginatedResponse<CompanyBookingItem>`

---

### `GET /api/company/bookings/:bookingId`
> **Tablas DynamoDB:** `carwash_bookings` (R)

Detalle completo de una cita asignada a esta empresa.

**Response `200`:** `ApiResponse<CompanyBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN` — la cita no está asignada a esta empresa

---

### `PUT /api/company/bookings/:bookingId/accept`
> **Tablas DynamoDB:** `carwash_bookings` (W)

La empresa acepta la cita asignada. Solo válido cuando `companyStatus === "pending_acceptance"`.

**Request body:** vacío

**Response `200`:** `ApiResponse<CompanyBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 INVALID_STATUS_TRANSITION` — la cita ya fue aceptada o rechazada

---

### `PUT /api/company/bookings/:bookingId/reject`
> **Tablas DynamoDB:** `carwash_bookings` (W), `carwash_company_availability`, `carwash_company_packages`, `carwash_company_services` (R — para buscar empresa alternativa)

La empresa rechaza la cita. El sistema busca automáticamente otra empresa disponible en el mismo horario. Si no hay más empresas, la cita se cancela.

**Request body:**
```typescript
interface RejectBookingRequest {
  reason: string; // obligatorio — razón del rechazo
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `reason`

**Response `200`:** `ApiResponse<CompanyBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 INVALID_STATUS_TRANSITION` — solo se puede rechazar en `pending_acceptance`

---

### `PUT /api/company/bookings/:bookingId/start`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Marca la cita como en curso. Solo válido cuando `status === "accepted"`.

**Request body:** vacío

**Response `200`:** `ApiResponse<CompanyBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 INVALID_STATUS_TRANSITION` — la cita no está en estado `accepted`

---

### `PUT /api/company/bookings/:bookingId/complete`
> **Tablas DynamoDB:** `carwash_bookings` (W), `carwash_billings` (W — crea registro de cobro), `carwash_companies` (W — actualiza stats)

Marca la cita como completada. Solo válido cuando `status === "in_progress"`.

**Request body:** vacío

**Response `200`:** `ApiResponse<CompanyBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 INVALID_STATUS_TRANSITION` — la cita no está en curso

---

## 4. Disponibilidad — `/api/company/availability`

### `GET /api/company/availability`
> **Tablas DynamoDB:** `carwash_company_availability` (R)

Devuelve los horarios activos y fechas bloqueadas de esta empresa.

**Response `200`:** `ApiResponse<CompanyAvailability>`

---

### `PUT /api/company/availability`
> **Tablas DynamoDB:** `carwash_global_availability` (R — valida slots permitidos), `carwash_company_availability` (W)

Actualiza los horarios disponibles y las fechas bloqueadas de esta empresa.

La empresa solo puede activar horarios que la plataforma haya habilitado globalmente. Cambiar los slots afecta el `spotsLeft` visible para los clientes al agendar: habilitar un horario suma un cupo, deshabilitarlo lo quita.

**Request body:**
```typescript
interface UpdateCompanyAvailabilityRequest {
  slots?: CompanySlot[];   // opcional — lista de slots con su estado enabled/disabled
  blockedDates?: string[]; // opcional — "YYYY-MM-DD" — reemplaza la lista completa
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar `slots` o `blockedDates`
- `400 INVALID_DATE_FORMAT` — alguna fecha en `blockedDates` no tiene formato `YYYY-MM-DD`
- `400 PAST_DATE` — alguna fecha en `blockedDates` es anterior a hoy
- `400 INVALID_SLOT_TIME` — algún `time` en `slots` no coincide con los slots globales

**Response `200`:** `ApiResponse<CompanyAvailability>`

**Errores:**
- `400 SLOT_NOT_ALLOWED` — el horario no está habilitado globalmente por la plataforma

---

## 5. Paquetes que Trabaja — `/api/company/packages`

### `GET /api/company/packages`
> **Tablas DynamoDB:** `carwash_catalog_packages`, `carwash_company_packages` (R)

Lista todos los paquetes del catálogo con la bandera de si esta empresa los trabaja o no.

**Response `200`:** `ApiResponse<CompanyPackageOption[]>`

---

### `PUT /api/company/packages`
> **Tablas DynamoDB:** `carwash_catalog_packages` (R — valida IDs), `carwash_company_packages` (W)

Actualiza qué paquetes trabaja esta empresa. Un cliente con membresía de un paquete que la empresa no trabaja no será asignado a ella.

**Request body:**
```typescript
interface UpdateCompanyPackagesRequest {
  packages: {             // obligatorio — array con al menos 1 elemento
    package: CatalogRef;  // obligatorio — ref a carwash_catalog_packages
    active: boolean;      // obligatorio — true o false
  }[];
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `packages` o el array está vacío
- `400 INVALID_PACKAGES_FORMAT` — algún elemento no tiene `package`, `package.id`, `package.slug` o `active`
- `400 INVALID_PACKAGE` — algún `package.id` no existe en `carwash_catalog_packages`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<CompanyPackageOption[]>`

**Errores:**
- `400 INVALID_PACKAGE` — algún packageId no existe en el catálogo

---

## 6. Servicios que Ofrece — `/api/company/services`

### `GET /api/company/services`
> **Tablas DynamoDB:** `carwash_catalog_services`, `carwash_catalog_wash_types`, `carwash_company_services` (R)

Lista todos los servicios del catálogo (tipos de lavado + add-ons) con la bandera de si esta empresa los ofrece.

**Response `200`:** `ApiResponse<CompanyServiceOption[]>`

---

### `PUT /api/company/services`
> **Tablas DynamoDB:** `carwash_catalog_services` (R — valida IDs), `carwash_company_services` (W)

Actualiza qué servicios ofrece esta empresa. Solo se asignarán a esta empresa las citas que incluyan servicios que ella tiene activos.

**Request body:**
```typescript
interface UpdateCompanyServicesRequest {
  services: {              // obligatorio — array con al menos 1 elemento
    service: CatalogRef;   // obligatorio — ref a carwash_catalog_services
    active: boolean;       // obligatorio — true o false
  }[];
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `services` o el array está vacío
- `400 INVALID_SERVICES_FORMAT` — algún elemento no tiene `service`, `service.id`, `service.slug` o `active`
- `400 INVALID_SERVICE` — algún `service.id` no existe en `carwash_catalog_services`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<CompanyServiceOption[]>`

**Errores:**
- `400 INVALID_SERVICE` — algún serviceId no existe en el catálogo

---

## 7. Cobros y Liquidaciones — `/api/company/earnings`

Cada vez que la empresa completa un servicio (`status → completed`), ese servicio genera automáticamente un registro de cobro. La empresa puede ver cuánto ha ganado y en qué estado está el pago de cada servicio por parte de la plataforma.

### Tipos

```typescript
// Resumen de ganancias por período
interface CompanyEarningsSummary {
  period: {
    from: string; // "YYYY-MM-DD"
    to: string;   // "YYYY-MM-DD"
  };
  totalServices: number;   // total de servicios completados en el período
  totalAmount: number;     // suma total en MXN
  pendingAmount: number;   // monto aún no liquidado por la plataforma
  paidAmount: number;      // monto ya liquidado
  byPaymentType: {
    directo:  { count: number; amount: number }; // cliente pagó individualmente
    membresia: { count: number; amount: number }; // cliente usó membresía
  };
}

// Detalle de un servicio facturado (cobro individual)
interface CompanyServiceBilling {
  billingId: string;
  bookingId: string;
  date: string;           // "YYYY-MM-DD"
  time: string;           // "10:00 AM"
  clientName: string;
  vehicleSize: CatalogRef; // ref a carwash_catalog_vehicle_sizes
  washType: CatalogRef;    // ref a carwash_catalog_wash_types
  addOns: CatalogRef[];    // refs a carwash_catalog_services
  totalAmount: number;  // lo que la empresa cobra a la plataforma por este servicio
  paymentType:
    | "directo"    // el cliente pagó por la cita individualmente
    | "membresia"; // el cliente usó una membresía (la plataforma ya cobró al cliente)
  paymentStatus:
    | "pendiente"  // la plataforma aún no ha pagado a la empresa
    | "pagado";    // la plataforma ya liquidó este servicio
  paidAt?: string; // ISO — fecha en que la plataforma liquidó
}
```

---

### `GET /api/company/earnings`
> **Tablas DynamoDB:** `carwash_billings` (R — PK=companyId)

Resumen de ganancias de la empresa autenticada. Por defecto devuelve el mes en curso.

**Query params:**
```typescript
interface GetEarningsSummaryQuery {
  dateFrom?: string; // opcional — "YYYY-MM-DD" (default: primer día del mes en curso)
  dateTo?: string;   // opcional — "YYYY-MM-DD" (default: hoy)
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — `dateFrom` o `dateTo` no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:** `ApiResponse<CompanyEarningsSummary>`

---

### `GET /api/company/earnings/services`
> **Tablas DynamoDB:** `carwash_billings` (R — GSI: `companyId-paymentStatus-index`)

Lista los servicios completados con su estado de cobro. Soporta filtros por estado de pago y tipo de pago.

**Query params:**
```typescript
interface GetEarningsServicesQuery {
  paymentStatus?: "pendiente" | "pagado" | "all"; // opcional — default: "all"
  paymentType?:   "directo" | "membresia" | "all";// opcional — default: "all"
  dateFrom?: string;  // opcional — "YYYY-MM-DD"
  dateTo?: string;    // opcional — "YYYY-MM-DD"
  page?: number;      // opcional — default: 1, entero positivo
  limit?: number;     // opcional — default: 20, máx. 100
}
```

**Validaciones:**
- `400 INVALID_PAYMENT_STATUS` — valor no es `pendiente`, `pagado` ni `all`
- `400 INVALID_PAYMENT_TYPE` — valor no es `directo`, `membresia` ni `all`
- `400 INVALID_DATE_FORMAT` — `dateFrom` o `dateTo` no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:** `PaginatedResponse<CompanyServiceBilling>`

> **Filtros clave:**
> - `paymentStatus=pendiente` → servicios completados pero aún sin pago de la plataforma
> - `paymentStatus=pagado` → servicios ya liquidados
> - `paymentType=membresia` → servicios donde el cliente pagó con membresía (la plataforma ya tiene ese dinero)
> - `paymentType=directo` → servicios donde el cliente pagó directamente por la cita

---

## 8. Tabla resumen

| Método | Endpoint                                    | Descripción                                                   |
|--------|---------------------------------------------|---------------------------------------------------------------|
| POST   | `/api/auth/login`                           | Login de la empresa                                           |
| GET    | `/api/auth/me`                              | Empresa autenticada actual                                    |
| POST   | `/api/auth/logout`                          | Cerrar sesión                                                 |
| GET    | `/api/company/profile`                      | Ver perfil de la empresa                                      |
| PUT    | `/api/company/profile`                      | Actualizar nombre y teléfono                                  |
| GET    | `/api/company/bookings`                     | Listar citas asignadas (filtros: fecha, estado, búsqueda)     |
| GET    | `/api/company/bookings/:id`                 | Detalle de cita asignada                                      |
| PUT  | `/api/company/bookings/:id/accept`          | Aceptar cita asignada                                         |
| PUT  | `/api/company/bookings/:id/reject`          | Rechazar cita (sistema reasigna o cancela automáticamente)    |
| PUT  | `/api/company/bookings/:id/start`           | Marcar cita en curso                                          |
| PUT  | `/api/company/bookings/:id/complete`        | Marcar cita completada                                        |
| GET    | `/api/company/availability`                 | Ver horarios y fechas bloqueadas de la empresa                |
| PUT    | `/api/company/availability`                 | Actualizar horarios y fechas bloqueadas                       |
| GET    | `/api/company/packages`                     | Ver paquetes del catálogo con bandera activo/inactivo         |
| PUT    | `/api/company/packages`                     | Elegir qué paquetes trabaja la empresa                        |
| GET    | `/api/company/services`                     | Ver servicios del catálogo con bandera activo/inactivo        |
| PUT    | `/api/company/services`                     | Elegir qué servicios ofrece la empresa                        |
| GET    | `/api/company/earnings`                     | Resumen de ganancias por período                              |
| GET    | `/api/company/earnings/services`            | Lista de cobros con filtros de estado y tipo de pago          |

---

## 9. Transiciones de estado para la empresa

La empresa solo puede accionar sobre citas que le están asignadas.

| Estado actual (`status`) | `companyStatus` actual    | Acción disponible | Resultado                              |
|--------------------------|---------------------------|-------------------|----------------------------------------|
| `pending`                | `pending_acceptance`      | `accept`          | `companyStatus → accepted_by_company`  |
| `pending`                | `pending_acceptance`      | `reject`          | Sistema reasigna o cancela             |
| `accepted`               | `accepted_by_company`     | `start`           | `status → in_progress`                 |
| `in_progress`            | `accepted_by_company`     | `complete`        | `status → completed`                   |
| `completed`              | —                         | — (ninguna)       | —                                      |
| `cancelled`              | —                         | — (ninguna)       | —                                      |

> La empresa **no puede cancelar** citas. Si hay un problema, debe rechazar antes de aceptar, o contactar a la plataforma.
