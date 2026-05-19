# Esquema DynamoDB — Car Wash

> Documento de planeación. Define las tablas, atributos, claves primarias e índices secundarios globales (GSI) de la base de datos DynamoDB. El diseño es **multi-tabla** para mayor claridad en la documentación.
>
> **Convención de nombres:** snake_case para tablas, camelCase para atributos.  
> **Prefijo de tablas:** `carwash_` (ej. `users`).
>
> **Catálogos:** Las tablas `carwash_catalog_*` están documentadas en `dynamodb-schema-catalogs.md`.

---

## Índice de Tablas

| #  | Tabla                          | Descripción                                           |
|----|--------------------------------|-------------------------------------------------------|
| 1  | `users`                | Clientes, usuarios de empresa y admins                |
| 2  | `carwash_companies`            | Empresas de lavado registradas                        |
| 3  | `carwash_vehicles`             | Vehículos guardados por los clientes                  |
| 4  | `carwash_addresses`            | Direcciones guardadas por los clientes                |
| 5  | `carwash_memberships`          | Membresías activas o expiradas de los clientes        |
| 6  | `carwash_bookings`             | Citas (el objeto central del sistema)                 |
| 7  | `carwash_billings`             | Cobros por servicio completado (empresa ↔ plataforma) |
| 8  | `carwash_company_availability` | Horarios y fechas bloqueadas por empresa              |
| 9  | `carwash_company_packages`     | Qué paquetes trabaja cada empresa                     |
| 10 | `carwash_company_services`     | Qué servicios ofrece cada empresa                     |
| 11 | `carwash_global_availability`  | Horarios globales disponibles (define la plataforma)  |
| 12 | `id_registry`          | Registro centralizado de IDs generados (patrón idempotente) |
| 13 | `sessions`             | Sesiones activas por token — fuente de verdad de autenticación |

> Las tablas de catálogo (`carwash_catalog_packages`, `carwash_catalog_services`, `carwash_catalog_wash_types`, `carwash_catalog_vehicle_sizes`, `carwash_catalog_zones`) están en **`dynamodb-schema-catalogs.md`**.

---

## Timestamps comunes

Todas las tablas incluyen estos tres campos:

| Atributo    | Tipo   | Descripción                                                            |
|-------------|--------|------------------------------------------------------------------------|
| `createdAt` | String | ISO 8601 — fecha y hora de creación del registro                       |
| `updatedAt` | String | ISO 8601 — fecha y hora de la última modificación; `null` si nunca actualizado |
| `deletedAt` | String | ISO 8601 — fecha y hora de eliminación lógica; `null` mientras activo  |

> **Eliminación lógica:** ninguna tabla borra físicamente el ítem. El registro se conserva y se asigna `deletedAt`. El código filtra `deletedAt = null` para considerar un registro como activo.

---

## 1. `users`

Almacena todos los usuarios del sistema: clientes, operadores de empresa y admins de plataforma.

| Clave       | Atributo    | Tipo   | Descripción                        |
|-------------|-------------|--------|------------------------------------|
| **PK**      | `userId`    | String | UUID generado al registrarse       |

**Atributos:**

| Atributo       | Tipo    | Descripción                                    |
|----------------|---------|------------------------------------------------|
| `email`        | String  | Email único del usuario                        |
| `passwordHash` | String  | Contraseña hasheada (bcrypt)                   |
| `role`         | String  | `"client"` / `"company"` / `"admin"`          |
| `name`         | String  | Nombre completo                                |
| `phone`        | String  | Teléfono                                       |
| `active`       | Boolean | Si puede iniciar sesión                                              |
| `companyId`    | String  | Solo para `role=company` — empresa asociada                          |
| `createdAt`    | String  | ISO 8601 — fecha de creación                                         |
| `updatedAt`    | String  | ISO 8601 — última modificación; `null` si nunca actualizado          |
| `deletedAt`    | String  | ISO 8601 — eliminación lógica; `null` mientras activo                |

**GSI:**

| Nombre              | PK      | SK | Uso                                    |
|---------------------|---------|----|----------------------------------------|
| `email-index`       | `email` | —  | Login: buscar usuario por email        |

---

## 2. `carwash_companies`

Perfil de cada empresa de lavado registrada por la plataforma.

| Clave  | Atributo    | Tipo   | Descripción          |
|--------|-------------|--------|----------------------|
| **PK** | `companyId` | String | UUID de la empresa   |

**Atributos:**

| Atributo            | Tipo    | Descripción                                         |
|---------------------|---------|-----------------------------------------------------|
| `name`              | String  | Nombre comercial                                    |
| `email`             | String  | Email de acceso (coincide con `users`)      |
| `phone`             | String  | Teléfono                                            |
| `active`            | Boolean | Si la empresa puede recibir citas                   |
| `rating`            | Number  | Promedio de calificaciones (recalculado al completar)|
| `totalBookings`     | Number  | Total de citas asignadas                            |
| `completedBookings` | Number  | Total de citas completadas                                              |
| `createdAt`         | String  | ISO 8601 — fecha de creación                                            |
| `updatedAt`         | String  | ISO 8601 — última modificación; `null` si nunca actualizado             |
| `deletedAt`         | String  | ISO 8601 — eliminación lógica; `null` mientras activo                   |

**GSI:**

| Nombre               | PK       | SK          | Uso                                         |
|----------------------|----------|-------------|---------------------------------------------|
| `active-index`       | `active` | `createdAt` | Listar empresas activas para asignación     |

---

## 3. `carwash_vehicles`

Vehículos guardados por los clientes.

| Clave  | Atributo    | Tipo   | Descripción                             |
|--------|-------------|--------|-----------------------------------------|
| **PK** | `userId`    | String | ID del cliente propietario              |
| **SK** | `vehicleId` | String | UUID del vehículo                       |

**Atributos:**

| Atributo    | Tipo   | Descripción                          |
|-------------|--------|--------------------------------------|
| `brand`     | String | Marca (ej. "Volkswagen")             |
| `model`     | String | Modelo (ej. "Jetta")                 |
| `color`     | String | Color del vehículo                   |
| `sizeId`    | String | UUID — ref a `carwash_catalog_vehicle_sizes` (obligatorio) |
| `sizeSlug`  | String | Slug del tamaño (obligatorio)                              |
| `plate`     | String | Placa (opcional)                                            |
| `createdAt` | String | ISO 8601 — fecha de creación                                |
| `updatedAt` | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt` | String | ISO 8601 — eliminación lógica; `null` mientras activo       |

> Sin GSI. El acceso siempre es por `userId` (dueño del vehículo).

---

## 4. `carwash_addresses`

Direcciones de servicio guardadas por los clientes.

| Clave  | Atributo    | Tipo   | Descripción               |
|--------|-------------|--------|---------------------------|
| **PK** | `userId`    | String | ID del cliente            |
| **SK** | `addressId` | String | UUID de la dirección      |

**Atributos:**

| Atributo         | Tipo   | Descripción                                    |
|------------------|--------|------------------------------------------------|
| `alias`          | String | Nombre corto (ej. "Casa", "Trabajo")           |
| `state`          | String | Estado (solo "Jalisco")                        |
| `city`           | String | Ciudad (solo "Tlajomulco de Zúñiga")           |
| `colonia`        | String | Colonia validada contra `carwash_catalog_zones`|
| `coto`           | String | Coto o fraccionamiento (opcional)              |
| `street`         | String | Calle                                          |
| `extNum`         | String | Número exterior                                |
| `intNum`         | String | Número interior (opcional)                     |
| `reference`      | String | Referencia (opcional)                                       |
| `createdAt`      | String | ISO 8601 — fecha de creación                                |
| `updatedAt`      | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt`      | String | ISO 8601 — eliminación lógica; `null` mientras activo       |

> Sin GSI. El acceso siempre es por `userId`.

---

## 5. `carwash_memberships`

Membresías (paquetes) compradas por los clientes. Una membresía es específica para un tamaño de vehículo.

| Clave  | Atributo       | Tipo   | Descripción           |
|--------|----------------|--------|-----------------------|
| **PK** | `userId`       | String | ID del cliente        |
| **SK** | `membershipId` | String | UUID de la membresía  |

**Atributos:**

| Atributo          | Tipo   | Descripción                                            |
|-------------------|--------|--------------------------------------------------------|
| `packageId`       | String | Referencia a `carwash_catalog_packages`                |
| `durationDays`    | Number | Días de duración de la membresía — valor definido por la plataforma al crear el paquete (ej. 7, 30, 90) |
| `vehicleSizeId`   | String | UUID — ref a `carwash_catalog_vehicle_sizes` (obligatorio) |
| `vehicleSizeSlug` | String | Slug del tamaño — snapshot al activar (obligatorio)        |
| `activatedAt`     | String | ISO 8601                                               |
| `expirationDate`  | String | ISO 8601 (activatedAt + días de duración)              |
| `washesTotal`     | Number | Total de lavadas incluidas al activar (snapshot del paquete)   |
| `washesRemaining` | Number | Lavadas restantes                                              |
| `addOnUsage`      | Map    | `{ [serviceId]: usosRestantes }` — add-ons incluidos   |
| `status`          | String | `MembershipStatus`                                          |
| `createdAt`       | String | ISO 8601 — fecha de creación                                |
| `updatedAt`       | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt`       | String | ISO 8601 — eliminación lógica; `null` mientras activo       |

**GSI:**

| Nombre                    | PK          | SK             | Uso                                             |
|---------------------------|-------------|----------------|-------------------------------------------------|
| `packageId-status-index`  | `packageId` | `status`       | Plataforma: clientes con un paquete activo      |

---

## 6. `carwash_bookings`

El objeto central del sistema. Cada cita tiene referencia al cliente, la empresa asignada y todos los detalles del servicio.

| Clave  | Atributo    | Tipo   | Descripción        |
|--------|-------------|--------|--------------------|
| **PK** | `bookingId` | String | UUID de la cita    |

**Atributos:**

| Atributo          | Tipo    | Descripción                                                      |
|-------------------|---------|------------------------------------------------------------------|
| `clientId`        | String  | Referencia a `users`                                     |
| `companyId`       | String  | Empresa asignada — referencia a `carwash_companies`              |
| `date`            | String  | `"YYYY-MM-DD"`                                                   |
| `time`            | String  | `"10:00 AM"`                                                     |
| `vehicleSizeId`   | String  | UUID — ref a `carwash_catalog_vehicle_sizes` (obligatorio)       |
| `vehicleSizeSlug` | String  | Slug del tamaño — snapshot al reservar (obligatorio)             |
| `vehicleBrand`    | String  | Marca (opcional)                                                 |
| `vehicleModel`    | String  | Modelo (opcional)                                                |
| `vehicleColor`    | String  | Color (opcional)                                                 |
| `vehiclePlate`    | String  | Placa (opcional)                                                 |
| `addressFull`     | String  | Dirección completa formateada (snapshot al momento de reservar)  |
| `washTypeId`      | String  | UUID — ref a `carwash_catalog_wash_types` (obligatorio)          |
| `washTypeSlug`    | String  | Slug del tipo de lavado — snapshot al reservar (obligatorio)     |
| `addOns`          | List    | IDs de servicios seleccionados (incluidos + extras)              |
| `totalPrice`      | Number  | Precio total en MXN (`0` si se usó membresía)                   |
| `status`          | String  | `BookingStatus`                                                     |
| `companyStatus`   | String  | `CompanyBookingStatus`                                              |
| `usedMembership`  | Boolean | Si la cita fue cubierta por una membresía                        |
| `membershipId`    | String  | Referencia a `carwash_memberships` (si aplica)                  |
| `comments`        | String  | Indicaciones del cliente (opcional)                              |
| `rejectionReason` | String  | Razón de rechazo de empresa (si aplica)                          |
| `cancelledBy`     | String  | `CancelledBy`                                                   |
| `cancelReason`    | String  | Razón de cancelación (opcional)                                  |
| `feedback`        | Map     | `{ rating, cleanliness, punctuality, extras, comment, createdAt }` |
| `reservationExpiry` | String  | ISO 8601 — límite para confirmar pago                            |
| `createdAt`         | String  | ISO 8601 — fecha de creación                                     |
| `updatedAt`         | String  | ISO 8601 — última modificación; `null` si nunca actualizado      |
| `deletedAt`         | String  | ISO 8601 — eliminación lógica; `null` mientras activo            |

**GSI:**

| Nombre                      | PK           | SK     | Uso                                               |
|-----------------------------|--------------|--------|---------------------------------------------------|
| `clientId-date-index`       | `clientId`   | `date` | Cliente: historial de citas propias               |
| `companyId-date-index`      | `companyId`  | `date` | Empresa: citas asignadas por fecha                |
| `date-time-index`           | `date`       | `time` | Plataforma: agenda del día ordenada por hora      |
| `status-date-index`         | `status`     | `date` | Plataforma: filtrar citas por estado y fecha      |

---

## 7. `carwash_billings`

Un registro de cobro se genera automáticamente cada vez que una cita pasa a `status=completed`. Representa lo que la empresa debe cobrar a la plataforma.

| Clave  | Atributo    | Tipo   | Descripción                          |
|--------|-------------|--------|--------------------------------------|
| **PK** | `companyId` | String | Empresa que realizó el servicio      |
| **SK** | `billingId` | String | UUID del cobro                       |

**Atributos:**

| Atributo        | Tipo   | Descripción                                                  |
|-----------------|--------|--------------------------------------------------------------|
| `bookingId`     | String | Referencia a `carwash_bookings`                              |
| `date`          | String | `"YYYY-MM-DD"` — fecha del servicio                         |
| `time`          | String | `"10:00 AM"` — hora del servicio                            |
| `userId`        | String | UUID del cliente — ref a `users`                             |
| `userName`      | String | Nombre del cliente — snapshot al momento del cobro           |
| `vehicleSizeId`   | String | UUID — ref a `carwash_catalog_vehicle_sizes` (obligatorio)            |
| `vehicleSizeSlug` | String | Slug del tamaño — snapshot al momento del cobro (obligatorio)         |
| `washTypeId`      | String | UUID — ref a `carwash_catalog_wash_types` (obligatorio)               |
| `washTypeSlug`    | String | Slug del tipo de lavado — snapshot al momento del cobro (obligatorio) |
| `addOns`        | List   | IDs de servicios realizados                                  |
| `totalAmount`   | Number | Monto que la empresa cobra a la plataforma (MXN)            |
| `paymentType`   | String | `PaymentType`                                                             |
| `paymentStatus` | String | `PaymentStatus`                                                           |
| `paidAt`        | String | ISO 8601 — fecha de liquidación (si `paymentStatus=pagado`)  |
| `createdAt`     | String | ISO 8601 — fecha de creación                                 |
| `updatedAt`     | String | ISO 8601 — última modificación; `null` si nunca actualizado  |
| `deletedAt`     | String | ISO 8601 — eliminación lógica; `null` mientras activo        |

**GSI:**

| Nombre                        | PK            | SK                         | Uso                                              |
|-------------------------------|---------------|----------------------------|--------------------------------------------------|
| `bookingId-index`             | `bookingId`   | —                          | Encontrar el cobro de una cita específica        |
| `companyId-paymentStatus-index` | `companyId` | `paymentStatus#date`       | Filtrar cobros pendientes o pagados por empresa  |

---

## 8. `carwash_company_availability`

Un ítem por empresa. Almacena sus horarios activos y fechas bloqueadas.

| Clave  | Atributo    | Tipo   | Descripción       |
|--------|-------------|--------|-------------------|
| **PK** | `companyId` | String | UUID de la empresa|

**Atributos:**

| Atributo       | Tipo  | Descripción                                                  |
|----------------|-------|--------------------------------------------------------------|
| `slots`        | List   | `[{ time: "09:00 AM", enabled: true }, ...]`                |
| `blockedDates` | List   | `["YYYY-MM-DD", ...]` — días completamente bloqueados       |
| `createdAt`    | String | ISO 8601 — fecha de creación                                |
| `updatedAt`    | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt`    | String | ISO 8601 — eliminación lógica; `null` mientras activo       |

> Sin GSI. El acceso siempre es por `companyId`.

---

## 9. `carwash_company_packages`

Qué paquetes del catálogo está dispuesta a atender cada empresa.

| Clave  | Atributo    | Tipo   | Descripción       |
|--------|-------------|--------|-------------------|
| **PK** | `companyId` | String | UUID de la empresa|
| **SK** | `packageId` | String | ID del paquete    |

**Atributos:**

| Atributo    | Tipo    | Descripción                          |
|-------------|---------|--------------------------------------|
| `active`    | Boolean | Si la empresa trabaja este paquete                          |
| `createdAt` | String  | ISO 8601 — fecha de creación                                |
| `updatedAt` | String  | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt` | String  | ISO 8601 — eliminación lógica; `null` mientras activo       |

**GSI:**

| Nombre                  | PK          | SK          | Uso                                                       |
|-------------------------|-------------|-------------|-----------------------------------------------------------|
| `packageId-active-index`| `packageId` | `active`    | Asignación: encontrar empresas activas para un paquete    |

---

## 10. `carwash_company_services`

Qué servicios (tipos de lavado y add-ons) ofrece cada empresa.

| Clave  | Atributo    | Tipo   | Descripción        |
|--------|-------------|--------|--------------------|
| **PK** | `companyId` | String | UUID de la empresa |
| **SK** | `serviceId` | String | ID del servicio    |

**Atributos:**

| Atributo    | Tipo    | Descripción                           |
|-------------|---------|---------------------------------------|
| `active`    | Boolean | Si la empresa ofrece este servicio                          |
| `createdAt` | String  | ISO 8601 — fecha de creación                                |
| `updatedAt` | String  | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt` | String  | ISO 8601 — eliminación lógica; `null` mientras activo       |

**GSI:**

| Nombre                   | PK          | SK       | Uso                                                     |
|--------------------------|-------------|----------|---------------------------------------------------------|
| `serviceId-active-index` | `serviceId` | `active` | Asignación: encontrar empresas activas para un servicio |

---

## 11. `carwash_global_availability`

Un solo ítem con configuración global. Define los horarios que la plataforma habilita para todo el sistema.

| Clave  | Atributo   | Tipo   | Descripción              |
|--------|------------|--------|--------------------------|
| **PK** | `configId` | String | Siempre `"global"`       |

**Atributos:**

| Atributo       | Tipo  | Descripción                                                  |
|----------------|-------|--------------------------------------------------------------|
| `slots`        | List   | `[{ time: "09:00 AM", enabled: true }, ...]`                |
| `blockedDates` | List   | `["YYYY-MM-DD", ...]` — días bloqueados globalmente         |
| `createdAt`    | String | ISO 8601 — fecha de creación                                |
| `updatedAt`    | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt`    | String | ISO 8601 — eliminación lógica; `null` mientras activo       |

> Sin GSI. Siempre se accede con PK=`"global"`.

---

## 12. `id_registry`

Registro centralizado de IDs generados mediante el patrón idempotente. Cada vez que la app solicita un nuevo ID (vehículo, dirección, membresía o cita), se crea un registro aquí y un stub en la tabla destino al mismo tiempo.

| Clave  | Atributo | Tipo   | Descripción                  |
|--------|----------|--------|------------------------------|
| **PK** | `id`     | String | UUID generado                |

**Atributos:**

| Atributo         | Tipo    | Descripción                                                                      |
|------------------|---------|----------------------------------------------------------------------------------|
| `collectionName` | String  | Nombre real de la tabla destino: `"vehicles"` / `"addresses"` / `"memberships"` / `"bookings"` / `"companies"` — **campo interno, nunca expuesto en el API**; el API usa los alias del enum `Collection` (ver `api-general-types.md`) |
| `userId`         | String  | ID del usuario que generó el ID (para limpieza de stubs huérfanos)                            |
| `action`         | String  | `"create"` — solo el ID fue generado; `"update"` — el `PUT` fue ejecutado; `"delete"` — el `DELETE` fue ejecutado |
| `createdAt`      | String  | ISO 8601 — fecha y hora en que se generó el ID                                                |
| `updatedAt`      | String  | ISO 8601 — cuándo se ejecutó el último `PUT` o `DELETE`; `null` hasta ese momento            |
| `deletedAt`      | String  | ISO 8601 — eliminación lógica; `null` mientras activo                                         |

**GSI:**

| Nombre                        | PK       | SK               | Uso                                                           |
|-------------------------------|----------|------------------|---------------------------------------------------------------|
| `userId-collectionName-index` | `userId` | `collectionName` | Limpiar stubs huérfanos (`action: "create"` sin `PUT` posterior) |

---

## 13. `sessions`

Sesión activa por token. Se crea en cada login o registro y se invalida en logout. El backend consulta esta tabla en **cada request autenticada** para verificar que el token existe, está vigente y tiene el rol correcto.

| Clave  | Atributo | Tipo   | Descripción                        |
|--------|----------|--------|------------------------------------|
| **PK** | `token`  | String | JWT completo — identificador único |

**Atributos:**

| Atributo    | Tipo   | Descripción                                                               |
|-------------|--------|---------------------------------------------------------------------------|
| `token`     | String | JWT completo — PK de la tabla                                             |
| `userId`    | String | UUID del usuario propietario de la sesión                                 |
| `role`      | String | `UserRole` — rol validado en cada request                                 |
| `expiresAt` | String | ISO 8601 — cuándo expira el token; si `< ahora` → `401 INVALID_TOKEN`    |
| `createdAt` | String | ISO 8601 — fecha de creación (login/registro)                             |
| `updatedAt` | String | ISO 8601 — última modificación; `null` si nunca actualizado               |
| `deletedAt` | String | ISO 8601 — fecha de logout; `null` mientras la sesión está activa         |

**GSI:**

| Nombre         | PK       | Uso                                                                    |
|----------------|----------|------------------------------------------------------------------------|
| `userId-index` | `userId` | Invalidar todas las sesiones de un usuario (ej. cambio de contraseña) |

> No tiene SK — el token es único globalmente. La consulta de autenticación es un `GetItem` directo por PK, lo que garantiza latencia mínima en cada request.
