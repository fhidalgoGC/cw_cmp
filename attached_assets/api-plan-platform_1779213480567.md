# Plan de API — Plataforma / Super Admin (Car Wash)

> Documento de planeación. Ningún endpoint existe aún. Describe todos los endpoints que consume la **app de la plataforma** para gestionar el negocio: empresas, citas, catálogos, reportes y clientes.
>
> Prefijo base: `/api/platform`  
> Auth compartida: `/api/auth`  
> Formato: JSON  
> Autenticación: header `token: <jwt>` requerido en todos los endpoints excepto `/api/auth/login` — ver `api-rules.md`  
> Todos los endpoints requieren `role: "admin"`. El backend retorna `403 FORBIDDEN` si cualquier otro rol intenta acceder.

---

## Tipos compartidos

> Los tipos base (`User`, `Booking`, `Membership`, `CatalogRef`, `BookingStatus`, `ApiResponse<T>`, `PaginatedResponse<T>`, etc.) están definidos en `shared/types.ts`. Ver `api-plan-client.md` para la referencia completa. `VehicleSize` y `WashType` ya no son enums — se expresan como `CatalogRef`.

Tipos adicionales exclusivos del admin:

```typescript
// Empresa de lavado registrada en el sistema
interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  rating?: number;           // promedio de calificaciones
  totalBookings: number;
  completedBookings: number;
  createdAt: string;         // ISO
}

// Disponibilidad de una empresa (sus propios horarios)
interface CompanyAvailability {
  companyId: string;
  slots: CompanySlot[];
  blockedDates: string[];    // "YYYY-MM-DD"
}

interface CompanySlot {
  time: string;              // "09:00 AM"
  enabled: boolean;
}

// Referencia a cualquier ítem de catálogo — siempre con id + slug
interface CatalogRef {
  id: string;   // UUID del ítem en el catálogo
  slug: string; // identificador legible, ej. "premium", "small", "rines"
}

// Booking enriquecido para el admin (incluye datos del cliente y empresa asignada)
interface AdminBookingItem {
  id: string;
  userId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  vehicleSize: CatalogRef;       // ref a carwash_catalog_vehicle_sizes
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  addressLabel?: string;
  addressFull?: string;          // dirección completa formateada
  washType: CatalogRef;          // ref a carwash_catalog_wash_types
  addOns: CatalogRef[];          // refs a carwash_catalog_services
  date: string;                  // "YYYY-MM-DD"
  time: string;                  // "10:00 AM"
  totalPrice: number;
  status: BookingStatus;
  assignedCompanyId?: string;    // empresa asignada actualmente
  assignedCompanyName?: string;
  companyStatus:                 // estado de aceptación de la empresa
    | "pending_acceptance"       // asignada, esperando respuesta
    | "accepted_by_company"      // empresa aceptó
    | "rejected_by_company";     // empresa rechazó → el sistema reasigna
  assignmentAttempts: number;    // cuántas empresas han rechazado esta cita
  usedMembershipId?: string;
  comments?: string;
  feedback?: BookingFeedback;
  cancelledBy?: "client" | "admin" | "company";
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Ítem de cliente en listado
interface AdminClientItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  activeMembershipsCount: number;
  totalSpent: number;
}

// Detalle completo de cliente
interface AdminClientDetail {
  user: User;
  vehicles: SavedVehicle[];
  addresses: SavedAddress[];
  memberships: Membership[];
  recentBookings: AdminBookingItem[];
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalSpent: number;
  };
}
```

---

## 0. Generación de IDs — `/api/platform/ids`

### `POST /api/platform/ids`
> **Tablas DynamoDB:** `id_registry` (W — crea registro con `action: "create"`), tabla destino (W — crea stub con el ID generado)

Genera un UUID único exclusivo para recursos de la plataforma. Solo acepta colecciones que el admin puede crear. Requiere auth admin.

**Request body:**
```typescript
interface GenerateIdRequest {
  collection: Collection; // obligatorio — único valor válido para este API: Collection.COMPANIES
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `collection`
- `400 INVALID_COLLECTION` — `collection` no es `Collection.COMPANIES`

**Response `201`:** `ApiResponse<IdRegistryEntry>`

---

## 1. Autenticación Admin — `/api/auth`

El admin usa los mismos endpoints de auth que el cliente. La diferencia es que el backend devuelve `role: "admin"` en el objeto `User` y el token tiene permisos elevados.

### `POST /api/auth/login`
> **Tablas DynamoDB:** `users` (R), `sessions` (W — crea sesión con token, userId, role, expiresAt)

Inicia sesión con credenciales de administrador.

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
  user: User; // user.role === "admin"
  token: string; // JWT — debe enviarse en el header `token` en todas las requests posteriores
}
// ApiResponse<LoginResponse>
```

**Errores:**
- `401 INVALID_CREDENTIALS`

---

### `GET /api/auth/me`
> **Tablas DynamoDB:** `users` (R)

Devuelve el administrador autenticado.

**Response `200`:** `ApiResponse<User>`

---

## 2. Gestión de Citas — `/api/platform/bookings`

### `GET /api/platform/bookings`
> **Tablas DynamoDB:** `carwash_bookings` (R — GSI: `status-date-index`)

Lista todas las citas del sistema con filtros y paginación.

**Query params:**
```typescript
interface AdminGetBookingsQuery {
  status?: BookingStatus; // opcional
  date?: string;          // opcional — "YYYY-MM-DD" (exclusivo con dateFrom/dateTo)
  dateFrom?: string;      // opcional — "YYYY-MM-DD"
  dateTo?: string;        // opcional — "YYYY-MM-DD", debe ser >= dateFrom
  userId?: string;        // opcional
  companyId?: string;     // opcional
  companyStatus?:         // opcional
    | "pending_acceptance"
    | "accepted_by_company"
    | "rejected_by_company";
  search?: string;        // opcional
  page?: number;          // opcional — default: 1
  limit?: number;         // opcional — default: 20, máx. 100
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — `date`, `dateFrom` o `dateTo` no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`
- `400 INVALID_STATUS` — `status` o `companyStatus` no es un valor válido

**Response `200`:** `PaginatedResponse<AdminBookingItem>`

---

### `GET /api/platform/bookings/:bookingId`
> **Tablas DynamoDB:** `carwash_bookings`, `users`, `carwash_companies` (R)

Detalle completo de una cita.

**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`

---

### `PUT /api/platform/bookings/:bookingId/accept`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Acepta una cita (cambia `status` de `pending` → `accepted`).

**Request body:** vacío  
**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 INVALID_STATUS_TRANSITION` — solo se puede aceptar si está en `pending`

---

### `PUT /api/platform/bookings/:bookingId/reject`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Rechaza una cita pendiente (cambia `status` de `pending` → `cancelled`, `cancelledBy: "admin"`).

**Request body:**
```typescript
interface RejectBookingRequest {
  reason: string; // obligatorio — razón del rechazo/cancelación
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `reason`

**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 INVALID_STATUS_TRANSITION` — solo se puede rechazar si está en `pending`

---

### `PUT /api/platform/bookings/:bookingId/start`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Marca la cita como en curso (cambia `status` de `accepted` → `in_progress`).

**Request body:** vacío  
**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 INVALID_STATUS_TRANSITION` — solo se puede iniciar si está en `accepted`

---

### `PUT /api/platform/bookings/:bookingId/complete`
> **Tablas DynamoDB:** `carwash_bookings` (W), `carwash_billings` (W — crea cobro), `carwash_companies` (W — actualiza stats)

Marca la cita como completada (cambia `status` de `in_progress` → `completed`).

**Request body:** vacío  
**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 INVALID_STATUS_TRANSITION` — solo se puede completar si está en `in_progress`

---

### `PUT /api/platform/bookings/:bookingId/reassign`
> **Tablas DynamoDB:** `carwash_company_availability`, `carwash_company_packages`, `carwash_company_services` (R — busca empresa), `carwash_bookings` (W)

Reasigna manualmente una cita a otra empresa disponible. Se usa cuando la empresa asignada rechaza o cuando el admin quiere cambiar la asignación. El backend elige la siguiente empresa disponible en el mismo horario. Si no hay empresas disponibles, la cita queda con `status: "cancelled"`.

**Request body:**
```typescript
interface ReassignBookingRequest {
  companyId?: string; // opcional — si se omite, el backend elige automáticamente
}
```

**Validaciones:**
- `400 COMPANY_NOT_FOUND` — el `companyId` indicado no existe en el sistema

**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 NO_COMPANIES_AVAILABLE` — no hay empresas disponibles en ese horario
- `400 INVALID_STATUS_TRANSITION` — solo se puede reasignar en `pending` o cuando `companyStatus === "rejected_by_company"`

---

### `PUT /api/platform/bookings/:bookingId/cancel`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Cancela una cita desde el admin (disponible en `pending`, `accepted` e `in_progress`).

**Request body:**
```typescript
interface AdminCancelBookingRequest {
  reason?: string; // opcional
}
```

**Response `200`:** `ApiResponse<AdminBookingItem>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `400 CANNOT_CANCEL` — no se puede cancelar una cita `completed`

---

## 3. Agenda del Día — `/api/platform/agenda`

### `GET /api/platform/agenda`
> **Tablas DynamoDB:** `carwash_bookings` (R — GSI: `date-time-index`)

Vista de todas las citas de un día específico, ordenadas por hora. Ideal para la vista principal del admin.

**Query params:**
```typescript
interface AdminAgendaQuery {
  date: string; // obligatorio — "YYYY-MM-DD"
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `date`
- `400 INVALID_DATE_FORMAT` — `date` no tiene formato `YYYY-MM-DD`

**Response `200`:**
```typescript
interface AgendaResponse {
  date: string;
  summary: {
    total: number;
    pending: number;
    accepted: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  bookings: AdminBookingItem[]; // ordenadas por time asc
}

// ApiResponse<AgendaResponse>
```

---

## 4. Disponibilidad Global — `/api/platform/availability`

La disponibilidad global define qué horarios existen en el sistema (ej. 9 AM, 10 AM, 11 AM…) y qué fechas están completamente bloqueadas. La **capacidad** de cada slot (cuántos clientes puede recibir) se calcula automáticamente contando las empresas activas disponibles en ese horario. Si en la fecha X a las 11 AM hay 3 empresas disponibles, el slot tiene capacidad 3.

> **Regla:** un horario aparece como `available: false` en la app del cliente si ninguna empresa activa está disponible en él, o si la fecha está bloqueada globalmente o en el calendario de todas las empresas.

### `GET /api/platform/availability`
> **Tablas DynamoDB:** `carwash_global_availability`, `carwash_company_availability` (R — para calcular companiesAvailable)

Devuelve la configuración global de horarios y fechas bloqueadas, junto con la capacidad calculada por slot.

**Response `200`:**
```typescript
interface AvailabilityConfig {
  slots: ScheduleSlot[];
  blockedDates: BlockedDate[];
}

interface ScheduleSlot {
  time: string;           // "09:00 AM"
  enabled: boolean;       // si el horario existe en el sistema
  companiesAvailable: number; // empresas activas con este horario habilitado
}

interface BlockedDate {
  date: string;    // "YYYY-MM-DD"
  reason?: string;
}

// ApiResponse<AvailabilityConfig>
```

---

### `PUT /api/platform/availability`
> **Tablas DynamoDB:** `carwash_global_availability` (W)

Actualiza los horarios que existen en el sistema (activa o desactiva slots globalmente). Desactivar un slot significa que ninguna empresa puede recibir citas en ese horario.

**Request body:**
```typescript
interface UpdateAvailabilityRequest {
  slots?: ScheduleSlot[]; // obligatorio — array con al menos 1 elemento
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `slots` o el array está vacío
- `400 INVALID_SLOTS_FORMAT` — algún slot no tiene `time` (string) o `enabled` (boolean)
- `400 INVALID_SLOT_TIME` — algún `time` no tiene formato válido (ej. "09:00 AM")

**Response `200`:** `ApiResponse<AvailabilityConfig>`

---

### `POST /api/platform/availability/block`
> **Tablas DynamoDB:** `carwash_global_availability` (W)

Bloquea una o varias fechas (los clientes no podrán agendar en esas fechas).

**Request body:**
```typescript
interface BlockDatesRequest {
  dates: string[]; // obligatorio — ["YYYY-MM-DD", ...], mín. 1 elemento
  reason?: string; // opcional
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `dates` o el array está vacío
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`
- `400 PAST_DATE` — alguna fecha es anterior a hoy

**Response `200`:** `ApiResponse<{ blockedDates: BlockedDate[] }>`

---

### `DELETE /api/platform/availability/block`
> **Tablas DynamoDB:** `carwash_global_availability` (W)

Desbloquea fechas previamente bloqueadas.

**Request body:**
```typescript
interface UnblockDatesRequest {
  dates: string[]; // obligatorio — ["YYYY-MM-DD", ...], mín. 1 elemento
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `dates` o el array está vacío
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`

**Response `200`:** `ApiResponse<{ blockedDates: BlockedDate[] }>`

---

## 5. Empresas — `/api/platform/companies`

Las empresas son los prestadores de servicio que realizan los lavados. Cada empresa define sus propios horarios disponibles. La capacidad de cada slot horario = número de empresas activas disponibles en ese slot. Cuando se agenda una cita, el sistema asigna automáticamente una empresa; si la empresa rechaza, el sistema intenta con la siguiente disponible.

---

### `GET /api/platform/companies`
> **Tablas DynamoDB:** `carwash_companies` (R)

Lista todas las empresas registradas (activas e inactivas).

**Query params:**
```typescript
interface GetCompaniesQuery {
  active?: boolean;    // filtrar solo activas
  search?: string;     // búsqueda por nombre
  page?: number;
  limit?: number;
}
```

**Response `200`:** `PaginatedResponse<Company>`

---

### `POST /api/platform/companies`
> **Tablas DynamoDB:** `id_registry` (W — crea registro con `action: "create"`), `carwash_companies` (W — crea stub con el ID)

Solo genera y devuelve un nuevo ID de empresa. Equivale a llamar `POST /api/platform/ids { collection: Collection.COMPANIES }`. Se llama al abrir el formulario de nueva empresa. Requiere auth admin.

**Request body:** vacío  
**Response `201`:** `ApiResponse<IdRegistryEntry>`

---

### `GET /api/platform/companies/:companyId`
> **Tablas DynamoDB:** `carwash_companies`, `carwash_bookings`, `carwash_company_availability` (R)

Detalle de una empresa con sus estadísticas.

**Response `200`:**
```typescript
interface CompanyDetail extends Company {
  availability: CompanyAvailability;
  recentBookings: AdminBookingItem[];
  stats: {
    totalBookings: number;
    completedBookings: number;
    rejectedBookings: number;
    averageRating: number;
  };
}

// ApiResponse<CompanyDetail>
```

**Errores:**
- `404 COMPANY_NOT_FOUND`

---

### `PUT /api/platform/companies/:companyId`
> **Tablas DynamoDB:** `carwash_companies` (W), `users` (W — crea o actualiza credenciales), `id_registry` (W — `action` → `"update"`, `updateTime` → now)

Crea o actualiza una empresa con el ID generado. Idempotente. En la primera llamada (`action: "create"` en el registro) los campos de creación son obligatorios; en llamadas posteriores basta con enviar al menos un campo.

**Request body:**
```typescript
interface UpsertCompanyRequest {
  // Obligatorios en la primera llamada (action: "create")
  name: string;      // obligatorio al crear — nombre de la empresa
  email: string;     // obligatorio al crear — se usará como usuario de login
  phone: string;     // obligatorio al crear — 10 dígitos numéricos
  password: string;  // obligatorio al crear — contraseña inicial, mín. 6 caracteres

  // Opcionales siempre
  active?: boolean;  // opcional — default: true al crear
}
```

**Validaciones:**
- `400 ID_NOT_FOUND` — el ID no existe en `id_registry` o no corresponde a `Collection.COMPANIES`
- `400 MISSING_FIELD` — es la primera llamada (`action: "create"`) y falta `name`, `email`, `phone` o `password`
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — es una actualización y no se envió ningún campo
- `400 INVALID_EMAIL_FORMAT` — email con formato inválido
- `400 INVALID_PHONE` — teléfono no tiene 10 dígitos numéricos
- `400 WEAK_PASSWORD` — contraseña tiene menos de 6 caracteres

**Response `200`:** `ApiResponse<Company>`

**Errores:**
- `400 EMAIL_ALREADY_EXISTS`

---

### `GET /api/platform/companies/:companyId/availability`
> **Tablas DynamoDB:** `carwash_company_availability` (R)

Consulta los horarios configurados por una empresa específica.

**Response `200`:** `ApiResponse<CompanyAvailability>`

**Errores:**
- `404 COMPANY_NOT_FOUND`

---

### `PUT /api/platform/companies/:companyId/availability`
> **Tablas DynamoDB:** `carwash_company_availability` (W)

Actualiza los horarios disponibles de una empresa. Se puede configurar qué días y horas está disponible la empresa para recibir citas.

**Request body:**
```typescript
interface UpdateCompanyAvailabilityRequest {
  slots: CompanySlot[];    // obligatorio — lista de todos los slots con enabled/disabled
  blockedDates?: string[]; // opcional — "YYYY-MM-DD" — reemplaza la lista completa
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `slots` o el array está vacío
- `400 INVALID_SLOTS_FORMAT` — algún slot no tiene `time` o `enabled`
- `400 INVALID_SLOT_TIME` — algún `time` no coincide con los slots globales habilitados
- `400 INVALID_DATE_FORMAT` — alguna fecha en `blockedDates` no tiene formato `YYYY-MM-DD`

**Response `200`:** `ApiResponse<CompanyAvailability>`

**Errores:**
- `404 COMPANY_NOT_FOUND`

---

## 6. Catálogo — `/api/platform/catalog`

El admin puede ver y editar los catálogos que la app cliente consume. Cambios aquí se reflejan automáticamente en la app sin necesidad de actualización.

---

### 5.1 Paquetes / Suscripciones

#### `GET /api/platform/catalog/packages`
> **Tablas DynamoDB:** `carwash_catalog_packages` (R)

Lista todos los paquetes (activos e inactivos).

**Response `200`:**
```typescript
interface AdminPackage {
  id: string;
  slug: string;
  name: string;
  washType: CatalogRef;  // ref a carwash_catalog_wash_types
  description: string;
  color: string;
  popular: boolean;
  active: boolean;        // si está visible para los clientes
  perks: string[];
  addOnsIncluded: PackageAddOnCatalog[];
  durations: PackageDurationCatalog[];
}

// ApiResponse<AdminPackage[]>
```

---

#### `PUT /api/platform/catalog/packages/:packageId`
> **Tablas DynamoDB:** `carwash_catalog_packages` (W)

Actualiza un paquete existente (precio, descripción, beneficios, add-ons incluidos, etc.).

**Request body:**
```typescript
interface UpdatePackageRequest {
  name?: string;                            // opcional
  description?: string;                     // opcional
  color?: string;                           // opcional
  popular?: boolean;                        // opcional
  active?: boolean;                         // opcional
  perks?: string[];                         // opcional
  addOnsIncluded?: PackageAddOnCatalog[];   // opcional
  durations?: PackageDurationCatalog[];     // opcional
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar al menos un campo
- `400 INVALID_PRICE` — algún precio en `durations` es negativo o cero
- `400 INVALID_DURATION_FORMAT` — algún elemento de `durations` tiene campos faltantes
- `400 INVALID_ADDON` — algún `id` en `addOnsIncluded` no existe en `carwash_catalog_services`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<AdminPackage>`

**Errores:**
- `404 PACKAGE_NOT_FOUND`

---

### 5.2 Servicios y Tipos de Lavado

#### `GET /api/platform/catalog/services`
> **Tablas DynamoDB:** `carwash_catalog_services`, `carwash_catalog_wash_types`, `carwash_catalog_vehicle_sizes` (R)

Lista todos los servicios (tipos de lavado, add-ons y precios base por tamaño).

**Response `200`:**
```typescript
interface AdminServiceCatalog {
  vehicleSizes: { catalogRef: CatalogRef; basePrice: number }[];
  washTypes: { catalogRef: CatalogRef; additionalCost: number }[];
  services: AdminServiceOption[];
}

interface AdminServiceOption {
  id: string;
  slug: string;
  name: string;
  price: number;
  includedIn: CatalogRef[];  // wash types que incluyen este servicio
  minMinutes: number;
  maxMinutes: number;
  active: boolean;
}

// ApiResponse<AdminServiceCatalog>
```

---

#### `PUT /api/platform/catalog/services/vehicle-prices`
> **Tablas DynamoDB:** `carwash_catalog_vehicle_sizes` (W)

Actualiza los precios base por tamaño de vehículo.

**Request body:**
```typescript
interface UpdateVehiclePricesRequest {
  // obligatorio — array con los tres tamaños; cada elemento incluye la ref de catálogo y el nuevo precio
  sizes: {
    vehicleSize: CatalogRef; // obligatorio — ref a carwash_catalog_vehicle_sizes
    basePrice: number;       // obligatorio — precio base en MXN, mayor a 0
  }[];
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `sizes` o algún `vehicleSize`, `vehicleSize.id`, `vehicleSize.slug` o `basePrice`
- `400 MISSING_SIZES` — no se enviaron los tres tamaños (`small`, `suv`, `large`)
- `400 INVALID_SIZE` — algún `vehicleSize.id` no existe en `carwash_catalog_vehicle_sizes`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)
- `400 INVALID_PRICE` — algún `basePrice` es negativo o cero

**Response `200`:** `ApiResponse<{ catalogRef: CatalogRef; basePrice: number }[]>`

---

#### `PUT /api/platform/catalog/services/wash-type-prices`
> **Tablas DynamoDB:** `carwash_catalog_wash_types` (W)

Actualiza los precios adicionales por tipo de lavado.

**Request body:**
```typescript
interface UpdateWashTypePricesRequest {
  // obligatorio — array con los tipos de lavado a actualizar
  washTypes: {
    washType: CatalogRef; // obligatorio — ref a carwash_catalog_wash_types
    additionalCost: number; // obligatorio — costo adicional en MXN, >= 0
  }[];
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `washTypes` o algún `washType`, `washType.id`, `washType.slug` o `additionalCost`
- `400 INVALID_WASH_TYPE` — algún `washType.id` no existe en `carwash_catalog_wash_types`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)
- `400 INVALID_PRICE` — algún `additionalCost` es negativo

**Response `200`:** `ApiResponse<{ catalogRef: CatalogRef; additionalCost: number }[]>`

---

#### `PUT /api/platform/catalog/services/:serviceId`
> **Tablas DynamoDB:** `carwash_catalog_services` (W)

Actualiza un servicio específico (nombre, precio, tiempo estimado, activo/inactivo).

**Request body:**
```typescript
interface UpdateServiceRequest {
  name?: string;        // opcional
  price?: number;       // opcional — número >= 0
  minMinutes?: number;  // opcional — entero positivo, debe ser <= maxMinutes
  maxMinutes?: number;  // opcional — entero positivo, debe ser >= minMinutes
  active?: boolean;     // opcional
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar al menos un campo
- `400 INVALID_PRICE` — `price` es negativo
- `400 INVALID_MINUTES` — `minMinutes` o `maxMinutes` es <= 0, o `minMinutes` > `maxMinutes`

**Response `200`:** `ApiResponse<AdminServiceOption>`

**Errores:**
- `404 SERVICE_NOT_FOUND`

---

### 5.3 Zonas de Cobertura

#### `GET /api/platform/catalog/zones`
> **Tablas DynamoDB:** `carwash_catalog_zones` (R)

Lista los estados, ciudades y colonias de cobertura disponibles.

**Response `200`:**
```typescript
interface ZoneCatalog {
  states: string[];
  cities: string[];
  colonies: string[];
}

// ApiResponse<ZoneCatalog>
```

---

#### `PUT /api/platform/catalog/zones`
> **Tablas DynamoDB:** `carwash_catalog_zones` (W)

Actualiza las zonas de cobertura (agregar o quitar colonias, ciudades, etc.).

**Request body:**
```typescript
interface UpdateZoneCatalogRequest {
  states?: string[];   // opcional — reemplaza la lista de estados completa si se envía
  cities?: string[];   // opcional — reemplaza la lista de ciudades completa si se envía
  colonies?: string[]; // opcional — reemplaza la lista de colonias completa si se envía
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar al menos un campo
- `400 EMPTY_ARRAY` — si se envía `states`, `cities` o `colonies`, no puede ser array vacío

**Response `200`:** `ApiResponse<ZoneCatalog>`

---

## 6. Reportes — `/api/platform/reports`

### `GET /api/platform/reports/revenue`
> **Tablas DynamoDB:** `carwash_bookings`, `carwash_billings` (R)

Reporte de ingresos por período.

**Query params:**
```typescript
interface RevenueReportQuery {
  period: "day" | "week" | "month" | "custom"; // obligatorio
  date?: string;     // obligatorio si period === "day" — "YYYY-MM-DD"
  dateFrom?: string; // obligatorio si period === "custom" — "YYYY-MM-DD"
  dateTo?: string;   // obligatorio si period === "custom" — "YYYY-MM-DD"
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `period`
- `400 INVALID_PERIOD` — `period` no es `day`, `week`, `month` ni `custom`
- `400 MISSING_DATE` — `period === "day"` pero falta `date`
- `400 MISSING_DATE_RANGE` — `period === "custom"` pero falta `dateFrom` o `dateTo`
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:**
```typescript
interface RevenueReport {
  period: string;
  dateFrom: string;
  dateTo: string;
  totalRevenue: number;
  membershipRevenue: number;    // de ventas de paquetes/membresías
  individualRevenue: number;    // de citas pagadas sin membresía
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  averageTicket: number;
  revenueByDay: RevenueByDay[];
}

interface RevenueByDay {
  date: string;
  revenue: number;
  bookingsCount: number;
}

// ApiResponse<RevenueReport>
```

---

### `GET /api/platform/reports/bookings`
> **Tablas DynamoDB:** `carwash_bookings` (R)

Reporte de citas: cantidad por estado, por día, tendencias.

**Query params:**
```typescript
interface BookingsReportQuery {
  dateFrom?: string; // opcional — "YYYY-MM-DD" (default: hace 30 días)
  dateTo?: string;   // opcional — "YYYY-MM-DD" (default: hoy)
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:**
```typescript
interface BookingsReport {
  dateFrom: string;
  dateTo: string;
  totalBookings: number;
  byStatus: Record<BookingStatus, number>;
  byDay: BookingsByDay[];
  cancellationRate: number;    // porcentaje
  completionRate: number;      // porcentaje
}

interface BookingsByDay {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
}

// ApiResponse<BookingsReport>
```

---

### `GET /api/platform/reports/services`
> **Tablas DynamoDB:** `carwash_bookings` (R)

Reporte de servicios más solicitados.

**Query params:**
```typescript
interface ServicesReportQuery {
  dateFrom?: string; // opcional — "YYYY-MM-DD" (default: hace 30 días)
  dateTo?: string;   // opcional — "YYYY-MM-DD" (default: hoy)
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:**
```typescript
interface ServicesReport {
  washTypeBreakdown: WashTypeCount[];
  addOnBreakdown: AddOnCount[];
  vehicleSizeBreakdown: VehicleSizeCount[];
}

interface WashTypeCount {
  washType: CatalogRef; // ref a carwash_catalog_wash_types
  count: number;
  percentage: number;
}

interface AddOnCount {
  addOn: CatalogRef;    // ref a carwash_catalog_services
  count: number;
}

interface VehicleSizeCount {
  vehicleSize: CatalogRef; // ref a carwash_catalog_vehicle_sizes
  count: number;
  percentage: number;
}

// ApiResponse<ServicesReport>
```

---

### `GET /api/platform/reports/memberships`
> **Tablas DynamoDB:** `carwash_memberships`, `carwash_catalog_packages` (R)

Reporte de membresías vendidas y activas.

**Query params:**
```typescript
interface MembershipsReportQuery {
  dateFrom?: string; // opcional — "YYYY-MM-DD" (default: hace 30 días)
  dateTo?: string;   // opcional — "YYYY-MM-DD" (default: hoy)
}
```

**Validaciones:**
- `400 INVALID_DATE_FORMAT` — alguna fecha no tiene formato `YYYY-MM-DD`
- `400 INVALID_DATE_RANGE` — `dateTo` es anterior a `dateFrom`

**Response `200`:**
```typescript
interface MembershipsReport {
  totalSold: number;
  totalRevenue: number;
  currentlyActive: number;
  byPackage: MembershipByPackage[];
  byDuration: MembershipByDuration[];
}

interface MembershipByPackage {
  package: CatalogRef; // ref a carwash_catalog_packages
  count: number;
  revenue: number;
}

interface MembershipByDuration {
  durationDays: number; // días definidos en el paquete (ej. 7, 30, 90)
  count: number;
}

// ApiResponse<MembershipsReport>
```

---

## 7. Clientes — `/api/platform/clients`

### `GET /api/platform/clients`
> **Tablas DynamoDB:** `users` (R — filter role=client)

Lista todos los clientes registrados con estadísticas.

**Query params:**
```typescript
interface AdminGetClientsQuery {
  search?: string;  // búsqueda por nombre, email o teléfono
  page?: number;    // default: 1
  limit?: number;   // default: 20
}
```

**Response `200`:** `PaginatedResponse<AdminClientItem>`

---

### `GET /api/platform/clients/:userId`
> **Tablas DynamoDB:** `users`, `carwash_vehicles`, `carwash_addresses`, `carwash_memberships`, `carwash_bookings` (R)

Perfil completo de un cliente con historial y estadísticas.

**Response `200`:** `ApiResponse<AdminClientDetail>`

**Errores:**
- `404 USER_NOT_FOUND`

---

### `GET /api/platform/clients/:userId/bookings`
> **Tablas DynamoDB:** `carwash_bookings` (R — GSI: `clientId-date-index`)

Historial completo de citas de un cliente específico.

**Query params:**
```typescript
interface ClientBookingsQuery {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}
```

**Response `200`:** `PaginatedResponse<AdminBookingItem>`

---

### `GET /api/platform/clients/:userId/memberships`
> **Tablas DynamoDB:** `carwash_memberships`, `carwash_catalog_packages` (R)

Membresías de un cliente específico.

**Response `200`:** `ApiResponse<Membership[]>`

---

## 9. Transiciones de estado válidas

### Flujo completo con asignación de empresa

```
                   ┌─ empresa acepta ──────────────────────────────────────────────────┐
                   │                                                                    ↓
 cliente agenda → pending ──── sistema asigna empresa ──── empresa acepta ──── accepted ──── start ──── in_progress ──── complete ──── completed
                   │                      │                      │                │                        │
                   │              empresa rechaza          empresa rechaza    admin cancela          admin cancela
                   │           (sistema reasigna)        (sin más empresas)
                   │                      │                      │
                   └──────────────────────┴──────────────────────┴─────────── cancelled
                           (cliente o admin también pueden cancelar)
```

**Descripción del flujo de asignación:**

1. El cliente agenda → cita queda en `status: "pending"`, `companyStatus: "pending_acceptance"`
2. El sistema asigna automáticamente una empresa disponible en ese horario
3. La empresa acepta → `companyStatus: "accepted_by_company"`, el admin puede cambiar `status` a `"accepted"`
4. Si la empresa rechaza → `companyStatus: "rejected_by_company"` → sistema intenta con la siguiente empresa (`companyStatus: "pending_acceptance"` de nuevo)
5. Si no hay más empresas disponibles → `status: "cancelled"` automáticamente

### Tabla de transiciones del estado principal (`status`)

| Estado actual | Quién puede actuar    | Acción     | Estado resultante |
|---------------|-----------------------|------------|-------------------|
| `pending`     | Admin                 | `accept`   | `accepted`        |
| `pending`     | Admin / Cliente       | `cancel`   | `cancelled`       |
| `pending`     | Sistema (auto)        | —          | `cancelled` si no hay empresas |
| `accepted`    | Admin                 | `start`    | `in_progress`     |
| `accepted`    | Admin / Cliente       | `cancel`   | `cancelled`       |
| `in_progress` | Admin                 | `complete` | `completed`       |
| `in_progress` | Admin                 | `cancel`   | `cancelled`       |
| `completed`   | — (ninguna acción)    | —          | —                 |
| `cancelled`   | — (ninguna acción)    | —          | —                 |

### Tabla de `companyStatus` (asignación de empresa)

| `companyStatus`         | Significado                                               |
|-------------------------|-----------------------------------------------------------|
| `pending_acceptance`    | Empresa asignada, aún no responde                        |
| `accepted_by_company`   | Empresa confirmó que realizará el servicio               |
| `rejected_by_company`   | Empresa rechazó; se espera reasignación o cancelación    |

> El cliente solo puede cancelar desde `pending` o `accepted`. El admin puede cancelar en cualquier estado excepto `completed`. Una empresa no puede cancelar una cita `in_progress` o `completed`.

---

## 10. Tabla resumen

| Método | Endpoint                                          | Descripción                                                      |
|--------|---------------------------------------------------|------------------------------------------------------------------|
| POST   | `/api/auth/login`                                 | Login del admin                                                  |
| GET    | `/api/auth/me`                                    | Admin autenticado actual                                         |
| GET    | `/api/platform/bookings`                             | Listar todas las citas (filtros: status, fecha, empresa, cliente)|
| GET    | `/api/platform/bookings/:id`                         | Detalle de cita (incluye empresa asignada)                       |
| PUT  | `/api/platform/bookings/:id/accept`                  | Aceptar cita (confirmar cuando empresa aceptó)                   |
| PUT  | `/api/platform/bookings/:id/reject`                  | Rechazar cita (cancela con razón)                                |
| PUT  | `/api/platform/bookings/:id/reassign`                | Reasignar cita a otra empresa                                    |
| PUT  | `/api/platform/bookings/:id/start`                   | Marcar cita en curso                                             |
| PUT  | `/api/platform/bookings/:id/complete`                | Marcar cita completada                                           |
| PUT  | `/api/platform/bookings/:id/cancel`                  | Cancelar cita                                                    |
| GET    | `/api/platform/agenda`                               | Agenda del día (con resumen de estados)                          |
| GET    | `/api/platform/availability`                         | Ver horarios globales y capacidad por empresa                    |
| PUT    | `/api/platform/availability`                         | Activar/desactivar slots horarios globalmente                    |
| POST   | `/api/platform/availability/block`                   | Bloquear fechas globalmente                                      |
| DELETE | `/api/platform/availability/block`                   | Desbloquear fechas                                               |
| POST   | `/api/platform/ids`                                  | Generar ID para nueva empresa (`collection: Collection.COMPANIES`) |
| GET    | `/api/platform/companies`                            | Listar empresas de lavado                                        |
| POST   | `/api/platform/companies`                            | Alias de `POST /api/platform/ids` — genera ID de empresa         |
| GET    | `/api/platform/companies/:id`                        | Detalle y estadísticas de empresa                                |
| PUT    | `/api/platform/companies/:id`                        | Crear o actualizar empresa (upsert idempotente)                  |
| GET    | `/api/platform/companies/:id/availability`           | Ver horarios de una empresa                                      |
| PUT    | `/api/platform/companies/:id/availability`           | Actualizar horarios de una empresa                               |
| GET    | `/api/platform/catalog/packages`                     | Ver catálogo de paquetes                                         |
| PUT    | `/api/platform/catalog/packages/:id`                 | Editar paquete (precios, duración, beneficios)                   |
| GET    | `/api/platform/catalog/services`                     | Ver catálogo de servicios                                        |
| PUT    | `/api/platform/catalog/services/vehicle-prices`      | Actualizar precios por tamaño de vehículo                        |
| PUT    | `/api/platform/catalog/services/wash-type-prices`    | Actualizar precios por tipo de lavado                            |
| PUT    | `/api/platform/catalog/services/:id`                 | Editar servicio individual                                       |
| GET    | `/api/platform/catalog/zones`                        | Ver zonas de cobertura                                           |
| PUT    | `/api/platform/catalog/zones`                        | Actualizar zonas de cobertura                                    |
| GET    | `/api/platform/reports/revenue`                      | Reporte de ingresos por período                                  |
| GET    | `/api/platform/reports/bookings`                     | Reporte de citas por período                                     |
| GET    | `/api/platform/reports/services`                     | Reporte de servicios más solicitados                             |
| GET    | `/api/platform/reports/memberships`                  | Reporte de membresías vendidas y activas                         |
| GET    | `/api/platform/clients`                              | Listar clientes                                                  |
| GET    | `/api/platform/clients/:userId`                      | Perfil completo de cliente                                       |
| GET    | `/api/platform/clients/:userId/bookings`             | Historial de citas de un cliente                                 |
| GET    | `/api/platform/clients/:userId/memberships`          | Membresías de un cliente                                         |
| GET    | `/api/platform/companies/:id/earnings`               | Ver ganancias y cobros pendientes de una empresa                 |
| GET    | `/api/platform/companies/:id/earnings/services`      | Lista de cobros de una empresa con filtros                       |
| PUT  | `/api/platform/companies/:id/earnings/settle`        | Liquidar (marcar como pagados) servicios seleccionados           |
