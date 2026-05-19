# Plan de API — App Cliente (Car Wash)

> Documento de planeación. Ningún endpoint existe aún. Describe todos los endpoints que consume la **app móvil del cliente** para reemplazar AsyncStorage y conectarse al backend.
>
> Prefijo base: `/api/client`  
> Auth compartida: `/api/auth`  
> Formato: JSON  
> Autenticación: header `token: <jwt>` requerido en todos los endpoints excepto `/api/auth/login` y `/api/auth/register` — ver `api-rules.md`

---

## Patrón de creación idempotente

Cualquier formulario de la app (vehículo, dirección, cita, membresía) usa **dos pasos**:

**Paso 1 — Generar ID (`POST /api/client/ids`)**  
La app llama al endpoint de generación de IDs del cliente indicando qué tipo de recurso va a crear. El backend genera un UUID, lo registra en `id_registry` con `action: "create"` y crea simultáneamente un registro stub con ese mismo ID en la tabla destino.

```
POST /api/client/ids
body: { collection: Collection.VEHICLES }
→ { id: "abc123", collection: Collection.VEHICLES, action: "create", createdAt: "2026-04-18T10:00:00Z", updatedAt: null }
```

**Paso 2 — Guardar datos (`PUT`)**  
Al confirmar el formulario, la app hace `PUT` con el `id` del paso 1. El backend guarda todos los datos en la tabla del recurso y actualiza `id_registry` con `action: "update"` y `updateTime`.

**Paso 3 (opcional) — Eliminar (`DELETE`)**  
Si el recurso es eliminado, el backend actualiza `id_registry` con `action: "delete"` y `updateTime`. El registro queda como fuente de verdad de lo que le ocurrió a ese ID.

```
PUT /api/client/vehicles/abc123
body: { brand, model, color, size, plate }
→ { id: "abc123", brand, model, ... }
```

**Ventajas:**
- Si la red falla en el `PUT`, el cliente puede reintentar con el mismo `id` sin crear duplicados.
- Aplica igual para: vehículos, direcciones, membresías y citas.

---

## Tipos compartidos

> Estos tipos viven en `shared/types.ts` y son usados tanto por el cliente como por el admin.

```typescript
// ─── Enums — definición canónica en enums-general.md ─────────────────────────

// VehicleSize y WashType ya no son enums — son CatalogRef con id (UUID) + slug legible.
// Los slugs conocidos de vehicleSize son: "small", "suv", "large"
// Los slugs conocidos de washType son: "basic", "complete", "premium", "detail", "full"

type BookingStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
type UserRole      = "client" | "company" | "admin";

// Referencia a cualquier ítem de catálogo — siempre se envía y recibe con id + slug
interface CatalogRef {
  id: string;   // UUID del ítem en el catálogo
  slug: string; // identificador legible, ej. "premium", "small", "rines"
}

// ─── Modelos principales ─────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  createdAt: string; // ISO
}

interface SavedVehicle {
  id: string;
  userId: string;
  brand: string;
  model: string;
  color: string;
  vehicleSize: CatalogRef; // ref a carwash_catalog_vehicle_sizes
  plate?: string;
}

interface SavedAddress {
  id: string;
  userId: string;
  alias: string;
  state: string;
  city: string;
  colony: string;
  coto?: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  reference?: string;
}

interface Membership {
  id: string;
  userId: string;
  package: CatalogRef;    // ref a carwash_catalog_packages
  durationDays: number;    // días de duración — valor tomado de la opción elegida en el paquete
  vehicleSize: CatalogRef; // ref a carwash_catalog_vehicle_sizes
  activatedAt: string;    // ISO
  expirationDate: string; // ISO
  washesRemaining: number;
  addOnUsage: { catalogRef: CatalogRef; usosRestantes: number }[];
  status: "active" | "expired" | "cancelled";
}

interface Booking {
  id: string;
  userId: string;
  vehicleId?: string;
  addressId?: string;
  vehicleSize: CatalogRef;  // ref a carwash_catalog_vehicle_sizes
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  addressLabel?: string;
  washType: CatalogRef;     // ref a carwash_catalog_wash_types
  addOns: CatalogRef[];     // refs a carwash_catalog_services
  date: string;           // "YYYY-MM-DD"
  time: string;           // "10:00 AM"
  totalPrice: number;
  status: BookingStatus;
  assignedCompany?: Company; // empresa asignada para este servicio
  usedMembershipId?: string;
  comments?: string;
  feedback?: BookingFeedback;
  cancelledBy?: "client" | "admin" | "company";
  cancelReason?: string;
  createdAt: string;      // ISO
  updatedAt: string;      // ISO
}

interface BookingFeedback {
  rating: number;         // 1–5
  cleanliness: string;    // "excelente" | "buena" | "regular" | "mala"
  punctuality: string;    // "a_tiempo" | "leve_retraso" | "retraso"
  extras: string[];       // ["amabilidad", "productos", ...]
  comment?: string;
  createdAt: string;      // ISO
}

// Vista pública de una empresa (lo que ve el cliente)
interface Company {
  id: string;
  name: string;
  rating?: number;        // promedio de calificaciones recibidas
}

// ─── Collection enum — definición canónica en enums-general.md ───────────────
// Importar de shared/types.ts → enum Collection { VEHICLES = "vhc", ... }

// ─── Wrappers de respuesta — ver api-general-types.md para definición completa ─

interface ApiResponse<T> {
  success: true;
  data: T;
}

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;    // ej. "BOOKING_NOT_FOUND"
    message: string;
  };
}

// POST idempotente — paso 1 (generar ID)
interface IdRegistryEntry {
  id: string;
  collection: Collection;   // valor del enum — nunca el nombre de tabla
  action: "create";         // siempre "create" al generar
  createdAt: string;        // ISO 8601
  updatedAt: string | null; // null al generar
}

// DELETE — confirmación de eliminación lógica
interface AckResponse {
  id: string;
  slug?: string;
  collection: Collection;
  message: string;
}
```

---

## 0. Generación de IDs — `/api/client/ids`

### `POST /api/client/ids`
> **Tablas DynamoDB:** `id_registry` (W — crea registro con `action: "create"`), tabla destino (W — crea stub con el ID generado)

Genera un UUID único, lo registra en `id_registry` y crea simultáneamente un registro stub en la tabla que corresponda al `collection` indicado. Solo acepta colecciones propias del cliente. Requiere auth cliente.

**Request body:**
```typescript
interface GenerateIdRequest {
  collection: Collection; // obligatorio — solo VEHICLES, ADDRESSES, MEMBERSHIPS o BOOKINGS
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `collection`
- `400 INVALID_COLLECTION` — `collection` no es un valor válido de `Collection` permitido para este API

**Response `201`:** `ApiResponse<IdRegistryEntry>`

---

## 1. Autenticación — `/api/auth`

### `POST /api/auth/register`
> **Tablas DynamoDB:** `users` (W), `sessions` (W — crea sesión con token, userId, role, expiresAt)

Registra un nuevo usuario cliente y crea su primera sesión.

**Request body:**
```typescript
interface RegisterRequest {
  name: string;     // obligatorio — mín. 2 caracteres
  phone: string;    // obligatorio — 10 dígitos numéricos
  email: string;    // obligatorio — formato email válido
  password: string; // obligatorio — mín. 6 caracteres
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `name`, `phone`, `email` o `password`
- `400 INVALID_EMAIL_FORMAT` — el email no tiene formato válido
- `400 INVALID_PHONE` — el teléfono no tiene 10 dígitos numéricos
- `400 WEAK_PASSWORD` — la contraseña tiene menos de 6 caracteres

**Response `201`:**
```typescript
interface RegisterResponse {
  user: User;
  token: string; // JWT — debe enviarse en el header `token` en todas las requests posteriores
}
// ApiResponse<RegisterResponse>
```

**Errores:**
- `400 EMAIL_ALREADY_EXISTS`
- `400 INVALID_PHONE`

---

### `POST /api/auth/login`
> **Tablas DynamoDB:** `users` (R), `sessions` (W — crea sesión con token, userId, role, expiresAt)

Inicia sesión y crea una nueva sesión en `sessions`.

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
  user: User;
  token: string; // JWT — debe enviarse en el header `token` en todas las requests posteriores
}
// ApiResponse<LoginResponse>
```

**Errores:**
- `401 INVALID_CREDENTIALS`

---

### `POST /api/auth/logout`
> **Tablas DynamoDB:** `sessions` (W — asigna `deletedAt` → now)

Invalida la sesión actual. El backend lee el token del header `token`, busca el registro en `sessions` y asigna `deletedAt = ahora`. Requiere auth.

**Request body:** vacío  
**Response `200`:** `ApiResponse<{ message: string }>`

---

### `GET /api/auth/me`
> **Tablas DynamoDB:** `users` (R)

Devuelve el usuario autenticado. Requiere auth.

**Response `200`:** `ApiResponse<User>`

---

## 2. Perfil — `/api/client/profile`

### `GET /api/client/profile`
> **Tablas DynamoDB:** `users`, `carwash_vehicles`, `carwash_addresses`, `carwash_memberships` (R)

Devuelve el perfil completo del usuario. Requiere auth.

**Response `200`:**
```typescript
interface ProfileResponse {
  user: User;
  vehicles: SavedVehicle[];
  addresses: SavedAddress[];
  memberships: Membership[];
}
// ApiResponse<ProfileResponse>
```

---

### `PUT /api/client/profile`
> **Tablas DynamoDB:** `users` (W)

Actualiza datos del perfil. Requiere auth.

**Request body:**
```typescript
interface UpdateProfileRequest {
  name?: string;  // opcional — mín. 2 caracteres si se envía
  phone?: string; // opcional — 10 dígitos si se envía
  email?: string; // opcional — formato válido si se envía
}
```

**Validaciones:**
- `400 AT_LEAST_ONE_FIELD_REQUIRED` — se debe enviar al menos un campo
- `400 INVALID_EMAIL_FORMAT` — email con formato inválido
- `400 INVALID_PHONE` — teléfono no tiene 10 dígitos numéricos

**Response `200`:** `ApiResponse<User>`

**Errores:**
- `400 EMAIL_ALREADY_EXISTS`

---

### `PUT /api/client/profile/password`
> **Tablas DynamoDB:** `users` (W)

Cambia la contraseña. Requiere auth.

**Request body:**
```typescript
interface ChangePasswordRequest {
  currentPassword: string; // obligatorio
  newPassword: string;     // obligatorio — mín. 6 caracteres
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `currentPassword` o `newPassword`
- `400 WEAK_PASSWORD` — `newPassword` tiene menos de 6 caracteres
- `400 SAME_PASSWORD` — `newPassword` es idéntica a `currentPassword`

**Response `200`:** `ApiResponse<{ message: string }>`

**Errores:**
- `401 INVALID_CURRENT_PASSWORD`

---

## 3. Vehículos — `/api/client/vehicles`

### `GET /api/client/vehicles`
> **Tablas DynamoDB:** `carwash_vehicles` (R)

Lista los vehículos del usuario. Requiere auth.

**Query params:**
```typescript
interface PaginationQuery {
  page?: number;  // default 1
  limit?: number; // default 20
}
```

**Response `200`:** `PaginatedResponse<SavedVehicle>`

---

### `PUT /api/client/vehicles/:vehicleId`
> **Tablas DynamoDB:** `carwash_vehicles` (W), `id_registry` (W — `action` → `"update"`, `updateTime` → now)

Crea o actualiza un vehículo con el ID generado. Idempotente. Requiere auth.

**Request body:**
```typescript
interface UpsertVehicleRequest {
  brand: string;           // obligatorio
  model: string;           // obligatorio
  color: string;           // obligatorio
  vehicleSize: CatalogRef; // obligatorio — ref a carwash_catalog_vehicle_sizes
  plate?: string;          // opcional
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `brand`, `model`, `color`, `vehicleSize`, `vehicleSize.id` o `vehicleSize.slug`
- `400 INVALID_SIZE` — `vehicleSize.id` no existe en `carwash_catalog_vehicle_sizes`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<SavedVehicle>`

**Errores:**
- `403 FORBIDDEN`

---

### `DELETE /api/client/vehicles/:vehicleId`
> **Tablas DynamoDB:** `carwash_vehicles` (D), `id_registry` (W — `action` → `"delete"`, `updateTime` → now)

Elimina un vehículo. Requiere auth.

**Response `200`:** `ApiResponse<{ message: string }>`

**Errores:**
- `404 VEHICLE_NOT_FOUND`
- `403 FORBIDDEN`

---

## 4. Direcciones — `/api/client/addresses`

### `GET /api/client/addresses`
> **Tablas DynamoDB:** `carwash_addresses` (R)

Lista las direcciones del usuario. Requiere auth.

**Query params:**
```typescript
interface PaginationQuery {
  page?: number;  // default 1
  limit?: number; // default 20
}
```

**Response `200`:** `PaginatedResponse<SavedAddress>`

---

### `PUT /api/client/addresses/:addressId`
> **Tablas DynamoDB:** `carwash_catalog_zones` (R — validación), `carwash_addresses` (W), `id_registry` (W — `action` → `"update"`, `updateTime` → now)

Crea o actualiza una dirección con el ID generado. Idempotente. El backend valida que `state`, `city` y `colony` sean zonas de cobertura. Requiere auth.

**Request body:**
```typescript
interface UpsertAddressRequest {
  alias: string;          // obligatorio
  state: string;          // obligatorio — debe ser zona de cobertura activa
  city: string;           // obligatorio — debe ser zona de cobertura activa
  colony: string;         // obligatorio — debe existir en catálogo de zonas
  coto?: string;          // opcional
  street: string;         // obligatorio
  exteriorNumber: string; // obligatorio
  interiorNumber?: string;// opcional
  reference?: string;     // opcional
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `alias`, `state`, `city`, `colony`, `street` o `exteriorNumber`
- `400 INVALID_LOCATION` — `state`, `city` o `colony` no pertenece a ninguna zona activa en `carwash_catalog_zones` (no existe, no coincide o el registro está eliminado)

**Response `200`:** `ApiResponse<SavedAddress>`

**Errores:**
- `403 FORBIDDEN`
- `400 INVALID_LOCATION`

---

### `DELETE /api/client/addresses/:addressId`
> **Tablas DynamoDB:** `carwash_addresses` (D), `id_registry` (W — `action` → `"delete"`, `updateTime` → now)

Elimina una dirección. Requiere auth.

**Response `200`:** `ApiResponse<{ message: string }>`

**Errores:**
- `404 ADDRESS_NOT_FOUND`
- `403 FORBIDDEN`

---

## 5. Membresías — `/api/client/memberships`

### `GET /api/client/memberships`
> **Tablas DynamoDB:** `carwash_memberships`, `carwash_catalog_packages` (R)

Lista las membresías del usuario. Requiere auth.

**Query params:**
```typescript
interface GetMembershipsQuery {
  status?: "active" | "expired" | "cancelled";
}
```

**Query params adicionales:**
```typescript
interface PaginationQuery {
  page?: number;  // default 1
  limit?: number; // default 20
}
```

**Response `200`:** `PaginatedResponse<Membership>`

---

### `PUT /api/client/memberships/:membershipId`
> **Tablas DynamoDB:** `carwash_catalog_packages` (R — calcula campos), `carwash_memberships` (W), `id_registry` (W — `action` → `"update"`, `updateTime` → now)

Activa la membresía con el ID generado. Idempotente. El backend calcula `expirationDate`, `washesRemaining` y `addOnUsage` según el paquete y duración. Requiere auth.

**Request body:**
```typescript
interface UpsertMembershipRequest {
  package: CatalogRef;     // obligatorio — ref a carwash_catalog_packages
  durationDays: number;    // obligatorio — debe coincidir con uno de los `days` definidos en el paquete
  vehicleSize: CatalogRef; // obligatorio — ref a carwash_catalog_vehicle_sizes
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `package`, `package.id`, `package.slug`, `durationDays`, `vehicleSize`, `vehicleSize.id` o `vehicleSize.slug`
- `400 INVALID_PACKAGE` — `package.id` no existe en `carwash_catalog_packages`, el slug no coincide, el paquete está inactivo (`active: false`) o está eliminado (`deletedAt ≠ null`)
- `400 INVALID_DURATION` — `durationDays` no corresponde a ninguno de los días de duración definidos en el paquete
- `400 INVALID_SIZE` — `vehicleSize.id` no existe en `carwash_catalog_vehicle_sizes`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<Membership>`

**Errores:**
- `400 INVALID_PACKAGE`

---

### `GET /api/client/memberships/:membershipId`
> **Tablas DynamoDB:** `carwash_memberships` (R)

Detalle de una membresía. Requiere auth.

**Response `200`:** `ApiResponse<Membership>`

**Errores:**
- `404 MEMBERSHIP_NOT_FOUND`
- `403 FORBIDDEN`

---

### `DELETE /api/client/memberships/:membershipId`
> **Tablas DynamoDB:** `carwash_memberships` (W — status → `cancelled`), `id_registry` (W — `action` → `"delete"`, `updateTime` → now)

Cancela una membresía activa. Requiere auth.

**Response `200`:** `ApiResponse<Membership>`

**Errores:**
- `404 MEMBERSHIP_NOT_FOUND`
- `403 FORBIDDEN`
- `400 MEMBERSHIP_NOT_ACTIVE`

---

## 6. Citas — `/api/client/bookings`

> **Cómo funciona la asignación de empresa desde el cliente:**  
> El cliente **nunca elige** una empresa. Simplemente escoge un horario disponible y el backend asigna automáticamente una de las empresas de lavado disponibles en ese slot. Si la empresa asignada rechaza la cita, el sistema busca otra empresa disponible y la reasigna sin que el cliente tenga que hacer nada. El cliente solo ve el nombre de la empresa en el detalle de su cita una vez que fue confirmada. Todos los endpoints de citas del cliente son contra el sistema en general, no contra una empresa específica.

### `GET /api/client/bookings`
> **Tablas DynamoDB:** `carwash_bookings` (R — GSI: `clientId-date-index`)

Lista las citas del usuario. Requiere auth.

**Query params:**
```typescript
interface GetBookingsQuery {
  status?: BookingStatus;
  page?: number;   // default: 1
  limit?: number;  // default: 20
}
```

**Response `200`:** `PaginatedResponse<Booking>`

---

### `GET /api/client/bookings/:bookingId`
> **Tablas DynamoDB:** `carwash_bookings` (R)

Detalle de una cita. Requiere auth.

**Response `200`:** `ApiResponse<Booking>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`

---

### `PUT /api/client/bookings/:bookingId`
> **Tablas DynamoDB:** `carwash_global_availability`, `carwash_company_availability`, `carwash_company_packages`, `carwash_company_services` (R — selección de empresa), `carwash_bookings` (W), `carwash_memberships` (W — si aplica, descuenta lavada), `id_registry` (W — `action` → `"update"`, `updateTime` → now)

Crea o actualiza la cita con el ID generado. Idempotente. El cliente **no indica empresa** — el backend selecciona automáticamente una empresa disponible en el horario elegido. Valida disponibilidad del horario y descuenta lavada de membresía si aplica. La cita queda con `status: "pending"` mientras la empresa confirma. Requiere auth.

**Request body:**
```typescript
interface UpsertBookingRequest {
  // Vehículo — opción A (vehículo guardado) o B (datos manuales), una es obligatoria
  vehicleId?: string;      // opcional — ID de vehículo guardado (opción A)
  vehicleSize?: CatalogRef;  // obligatorio si no hay vehicleId — ref a carwash_catalog_vehicle_sizes
  vehicleBrand?: string;   // obligatorio si no hay vehicleId
  vehicleModel?: string;   // obligatorio si no hay vehicleId
  vehicleColor?: string;   // obligatorio si no hay vehicleId
  vehiclePlate?: string;   // opcional siempre

  // Dirección — opción A (dirección guardada) o B (texto libre), una es obligatoria
  addressId?: string;      // opcional — ID de dirección guardada (opción A)
  addressLabel?: string;   // obligatorio si no hay addressId — texto libre (opción B)

  // Servicio
  washType: CatalogRef;    // obligatorio — ref a carwash_catalog_wash_types
  addOns: CatalogRef[];    // obligatorio — refs a carwash_catalog_services (puede ser [])

  // Horario
  date: string;            // obligatorio — "YYYY-MM-DD", no puede ser fecha pasada
  time: string;            // obligatorio — slot válido del catálogo, ej. "10:00 AM"

  // Pago
  membershipId?: string;   // opcional — si usa membresía el precio es $0

  // Extra
  comments?: string;       // opcional
}
```

**Validaciones:**
- `400 MISSING_VEHICLE_INFO` — no se envió `vehicleId` ni los campos manuales (`vehicleSize`, `vehicleBrand`, `vehicleModel`, `vehicleColor`)
- `400 MISSING_ADDRESS` — no se envió `addressId` ni `addressLabel`
- `400 MISSING_FIELD` — falta `washType`, `washType.id`, `washType.slug`, `addOns`, `date` o `time`
- `400 INVALID_WASH_TYPE` — `washType.id` no existe en `carwash_catalog_wash_types`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)
- `400 INVALID_SIZE` — `vehicleSize.id` no existe en `carwash_catalog_vehicle_sizes`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)
- `400 INVALID_DATE_FORMAT` — `date` no tiene formato `YYYY-MM-DD`
- `400 PAST_DATE` — `date` es una fecha anterior a hoy
- `400 INVALID_TIME_FORMAT` — `time` no coincide con ningún slot del catálogo
- `400 INVALID_ADDON` — algún `id` en `addOns` no existe en `carwash_catalog_services`, el slug no coincide o el registro está eliminado (`deletedAt ≠ null`)

**Response `200`:** `ApiResponse<Booking>`

**Errores:**
- `400 SLOT_UNAVAILABLE`
- `400 INVALID_MEMBERSHIP`
- `400 MEMBERSHIP_VEHICLE_MISMATCH`
- `400 INVALID_LOCATION`
- `400 INVALID_ADDON`

---

### `PUT /api/client/bookings/:bookingId/reschedule`
> **Tablas DynamoDB:** `carwash_global_availability`, `carwash_company_availability` (R — valida disponibilidad), `carwash_bookings` (W)

Reagenda una cita. Solo permitido en estado `pending` o `accepted`. Requiere auth.

**Request body:**
```typescript
interface RescheduleBookingRequest {
  date: string; // obligatorio — "YYYY-MM-DD", no puede ser fecha pasada
  time: string; // obligatorio — slot válido del catálogo, ej. "10:00 AM"
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `date` o `time`
- `400 INVALID_DATE_FORMAT` — `date` no tiene formato `YYYY-MM-DD`
- `400 PAST_DATE` — `date` es una fecha anterior a hoy
- `400 INVALID_TIME_FORMAT` — `time` no coincide con ningún slot del catálogo

**Response `200`:** `ApiResponse<Booking>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 CANNOT_RESCHEDULE`
- `400 SLOT_UNAVAILABLE`

---

### `PUT /api/client/bookings/:bookingId/cancel`
> **Tablas DynamoDB:** `carwash_bookings` (W)

Cancela una cita. No permitido en estado `in_progress` o `completed`. Requiere auth.

**Request body:**
```typescript
interface CancelBookingRequest {
  reason?: string; // opcional
}
```

**Response `200`:** `ApiResponse<Booking>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 CANNOT_CANCEL`

---

### `POST /api/client/bookings/:bookingId/feedback`
> **Tablas DynamoDB:** `carwash_bookings` (W — guarda feedback), `carwash_companies` (W — recalcula rating)

Envía el feedback de una cita completada. Solo si `status === "completed"` y no tiene feedback previo. Requiere auth.

**Request body:**
```typescript
interface CreateFeedbackRequest {
  rating: number;       // obligatorio — entero de 1 a 5
  cleanliness: string;  // obligatorio — "excelente" | "buena" | "regular" | "mala"
  punctuality: string;  // obligatorio — "a_tiempo" | "leve_retraso" | "retraso"
  extras: string[];     // obligatorio — array de etiquetas (puede ser vacío [])
  comment?: string;     // opcional
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `rating`, `cleanliness`, `punctuality` o `extras`
- `400 INVALID_RATING` — `rating` no es un entero entre 1 y 5
- `400 INVALID_CLEANLINESS` — valor no es `excelente`, `buena`, `regular` ni `mala`
- `400 INVALID_PUNCTUALITY` — valor no es `a_tiempo`, `leve_retraso` ni `retraso`

**Response `201`:** `ApiResponse<Booking>`

**Errores:**
- `404 BOOKING_NOT_FOUND`
- `403 FORBIDDEN`
- `400 BOOKING_NOT_COMPLETED`
- `400 FEEDBACK_ALREADY_EXISTS`

---

## 7. Disponibilidad — `/api/client/availability`

### `GET /api/client/availability`
> **Tablas DynamoDB:** `carwash_global_availability`, `carwash_company_availability`, `carwash_bookings` (R)

Consulta los horarios disponibles para una fecha. Ruta pública — no requiere auth.

La disponibilidad de cada horario está determinada por cuántas empresas de lavado están disponibles en ese horario. Si a las 11 AM hay 5 empresas registradas y disponibles, `spotsLeft` es 5. Al agendar una cita en ese horario, el backend asigna una empresa y el `spotsLeft` baja a 4.

**Query params:**
```typescript
interface GetAvailabilityQuery {
  date: string;              // obligatorio — "YYYY-MM-DD"
  vehicleSizeId: string;     // obligatorio — UUID de carwash_catalog_vehicle_sizes
  vehicleSizeSlug: string;   // obligatorio — slug legible, ej. "small", "suv", "large"
}
```

**Validaciones:**
- `400 MISSING_FIELD` — falta `date`, `vehicleSizeId` o `vehicleSizeSlug`
- `400 INVALID_DATE_FORMAT` — `date` no tiene formato `YYYY-MM-DD`
- `400 PAST_DATE` — `date` es una fecha anterior a hoy
- `400 INVALID_SIZE` — `vehicleSizeId` no existe en el catálogo o el slug no coincide

**Response `200`:**
```typescript
interface AvailabilityResponse {
  date: string;
  slots: TimeSlot[];
}

interface TimeSlot {
  time: string;       // "09:00 AM"
  available: boolean; // false si spotsLeft === 0 o la fecha está bloqueada
  spotsLeft: number;  // número de empresas disponibles en este horario
}

// ApiResponse<AvailabilityResponse>
```

---

## 8. Catálogo — `/api/client/catalog`

Rutas públicas — no requieren auth. La app las consume para mostrar paquetes y precios en vez de tenerlos hardcodeados.

### `GET /api/client/catalog/packages`
> **Tablas DynamoDB:** `carwash_catalog_packages` (R)

Lista todos los paquetes disponibles con precios y duraciones.

**Response `200`:**
```typescript
interface PackageCatalog {
  id: string;
  slug: string;          // ej. "basico", "completo", "premium"
  name: string;
  washType: CatalogRef;  // ref a carwash_catalog_wash_types
  description: string;
  color: string;
  popular?: boolean;
  perks: string[];
  addOnsIncluded: PackageAddOnCatalog[];
  durations: PackageDurationCatalog[];
}

interface PackageAddOnCatalog {
  addOn: CatalogRef;     // ref a carwash_catalog_services
  includedUses: number;
}

interface PackageDurationCatalog {
  days: number;         // días de duración — identificador único de esta opción (definido por la plataforma)
  label: string;        // etiqueta descriptiva, ej. "1 semana", "1 mes" (definida por la plataforma)
  washesIncluded: number;
  prices: { vehicleSize: CatalogRef; price: number }[]; // precio por tamaño de vehículo
}

// ApiResponse<PackageCatalog[]>
```

---

### `GET /api/client/catalog/companies`
> **Tablas DynamoDB:** `carwash_companies` (R)

Lista las empresas de lavado activas registradas en el sistema. Ruta pública.

**Query params:**
```typescript
interface PaginationQuery {
  page?: number;  // default 1
  limit?: number; // default 20
}
```

**Response `200`:** `PaginatedResponse<Company>`

---

### `GET /api/client/catalog/services`
> **Tablas DynamoDB:** `carwash_catalog_services`, `carwash_catalog_wash_types`, `carwash_catalog_vehicle_sizes` (R)

Lista tipos de lavado, add-ons y precios base por tamaño de vehículo.

**Response `200`:**
```typescript
interface ServiceCatalogResponse {
  vehicleSizes: { catalogRef: CatalogRef; basePrice: number }[];
  washTypes: { catalogRef: CatalogRef; additionalCost: number }[];
  services: ServiceOption[];
}

interface ServiceOption {
  id: string;
  slug: string;
  name: string;
  price: number;
  includedIn: CatalogRef[]; // wash types que ya incluyen este servicio
  minMinutes: number;
  maxMinutes: number;
}

// ApiResponse<ServiceCatalogResponse>
```

---

## 9. Tabla resumen

| Método   | Endpoint                              | Auth    | Descripción                                  |
|----------|---------------------------------------|---------|----------------------------------------------|
| POST     | `/api/client/ids`                            | Cliente | Generar ID (vehicles / addresses / memberships / bookings)       |
| POST     | `/api/auth/register`                  | Pública | Registrar nuevo cliente                      |
| POST     | `/api/auth/login`                     | Pública | Iniciar sesión                               |
| POST     | `/api/auth/logout`                    | Cliente | Cerrar sesión                                |
| GET      | `/api/auth/me`                        | Cliente | Usuario autenticado actual                   |
| GET      | `/api/client/profile`                        | Cliente | Perfil completo                              |
| PUT      | `/api/client/profile`                        | Cliente | Actualizar perfil                            |
| PUT      | `/api/client/profile/password`               | Cliente | Cambiar contraseña                           |
| GET      | `/api/client/vehicles`                       | Cliente | Listar vehículos                             |
| PUT      | `/api/client/vehicles/:id`                   | Cliente | Crear o actualizar vehículo                  |
| DELETE   | `/api/client/vehicles/:id`                   | Cliente | Eliminar vehículo                            |
| GET      | `/api/client/addresses`                      | Cliente | Listar direcciones                           |
| PUT      | `/api/client/addresses/:id`                  | Cliente | Crear o actualizar dirección                 |
| DELETE   | `/api/client/addresses/:id`                  | Cliente | Eliminar dirección                           |
| GET      | `/api/client/memberships`                    | Cliente | Listar membresías                            |
| PUT      | `/api/client/memberships/:id`                | Cliente | Activar membresía                            |
| GET      | `/api/client/memberships/:id`                | Cliente | Detalle de membresía                         |
| DELETE   | `/api/client/memberships/:id`                | Cliente | Cancelar membresía                           |
| GET      | `/api/client/bookings`                       | Cliente | Listar mis citas                             |
| GET      | `/api/client/bookings/:id`                   | Cliente | Detalle de cita                              |
| PUT      | `/api/client/bookings/:id`                   | Cliente | Crear o actualizar cita                      |
| PUT    | `/api/client/bookings/:id/reschedule`        | Cliente | Reagendar cita                               |
| PUT    | `/api/client/bookings/:id/cancel`            | Cliente | Cancelar cita                                |
| POST     | `/api/client/bookings/:id/feedback`          | Cliente | Enviar feedback                              |
| GET      | `/api/client/availability`                   | Pública | Consultar horarios disponibles (spotsLeft = empresas disponibles) |
| GET      | `/api/client/catalog/companies`              | Pública | Listar empresas de lavado activas            |
| GET      | `/api/client/catalog/packages`               | Pública | Catálogo de paquetes                         |
| GET      | `/api/client/catalog/services`               | Pública | Catálogo de servicios y precios              |
