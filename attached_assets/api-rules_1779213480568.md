# Reglas Generales de API — Car Wash

> Estas reglas aplican a **todos los endpoints** de los tres APIs (cliente, empresa, plataforma) salvo que se indique lo contrario en el endpoint específico.

---

## 1. Autenticación — Header `token`

### 1.1 Flujo de login / registro

Al hacer login o registro exitoso, el backend:

1. Genera un **JWT** firmado con los datos del usuario.
2. Guarda un registro en `sessions` con `{ token, userId, role, createdAt, expiresAt }`.
3. Devuelve el token al cliente.

El cliente almacena el token y lo envía en el header `token` en todas las requests posteriores.

**Header requerido en toda request autenticada:**
```
token: <jwt>
```

**Endpoints exentos — no requieren el header:**
- `POST /api/auth/login`
- `POST /api/auth/register`

---

### 1.2 Validación por endpoint

En cada request autenticada el backend ejecuta, en orden, las siguientes validaciones:

**Paso 1 — Verificar presencia del header**
- Si falta el header `token` → `401 MISSING_TOKEN`

**Paso 2 — Consultar `sessions`**
- El backend busca el registro en `sessions` usando el token como PK.
- Si no existe → `401 INVALID_TOKEN`
- Si `deletedAt ≠ null` (sesión cerrada por logout) → `401 INVALID_TOKEN`
- Si `expiresAt < ahora` (sesión expirada) → `401 INVALID_TOKEN`

**Paso 3 — Verificar rol**
- El backend compara `session.role` con el rol requerido por el API:

| API accedida        | Rol requerido | Error si no coincide   |
|---------------------|---------------|------------------------|
| `/api/client/*`     | `"client"`    | `403 UNAUTHORIZED_ROLE`|
| `/api/company/*`    | `"company"`   | `403 UNAUTHORIZED_ROLE`|
| `/api/platform/*`   | `"admin"`     | `403 UNAUTHORIZED_ROLE`|

> Ejemplo: un cliente con rol `"client"` que intenta acceder a `/api/platform/bookings` recibe `403 UNAUTHORIZED_ROLE`, aunque su token sea válido.

---

### 1.3 Logout

Al hacer logout, el backend actualiza el registro en `sessions` asignando `deletedAt = ahora`. La sesión queda invalidada sin borrar el registro (trazabilidad). Requests posteriores con ese token reciben `401 INVALID_TOKEN`.

---

### 1.4 Errores de autenticación

> Códigos canónicos en **`enums-general.md` → `ErrorCode`**: `MISSING_TOKEN`, `INVALID_TOKEN`, `UNAUTHORIZED_ROLE`.

---

## 2. Validación de referencias de catálogo

Todo `POST` o `PUT` que reciba un `CatalogRef { id, slug }` ejecuta tres validaciones antes de continuar:

1. **El `id` existe** en la tabla de catálogo correspondiente.
2. **El `slug` coincide** con el slug almacenado en el catálogo.
3. **El registro está activo**: `deletedAt` es `null`.

Si alguna condición falla, el backend responde `400`. Los códigos canónicos están en **`enums-general.md` → `ErrorCode`** (grupo "Referencias de catálogo"): `INVALID_SIZE`, `INVALID_WASH_TYPE`, `INVALID_PACKAGE`, `INVALID_SERVICE`, `INVALID_ADDON`, `INVALID_LOCATION`.

---

## 3. Tipado de respuestas

Toda respuesta de la API — exitosa o de error — usa uno de los wrappers definidos en **`api-general-types.md`**. Ningún endpoint devuelve un objeto crudo.

| Caso                            | Wrapper obligatorio             |
|---------------------------------|---------------------------------|
| GET — un registro               | `ApiResponse<T>`                |
| GET — lista (paginada)          | `PaginatedResponse<T>`          |
| POST — auth / creación directa  | `ApiResponse<T>`                |
| POST — idempotente (generar ID) | `ApiResponse<IdRegistryEntry>`  |
| PUT — actualización             | `ApiResponse<T>`                |
| DELETE — eliminación lógica     | `ApiResponse<AckResponse>`      |
| Error (todos)                   | `ApiError`                      |

> El tipo `T` dentro de `data` es el tipo específico del endpoint o colección (p.ej. `Booking`, `SavedVehicle`). Ver `api-general-types.md` para la definición completa de cada wrapper y los tipos `IdRegistryEntry` y `AckResponse`.

---

## 4. Validación de esquema en POST y PUT

Todo endpoint `POST` o `PUT` valida el cuerpo de la request **antes** de ejecutar cualquier lógica de negocio. El esquema de validación se deriva de la `interface *Request` documentada en cada endpoint.

### 4.1 Qué se valida

| Nivel                | Qué verifica                                                                              | Error (`enums-general.md → ErrorCode`)      |
|----------------------|-------------------------------------------------------------------------------------------|---------------------------------------------|
| Campos requeridos    | Toda clave obligatoria está presente y no es `null` ni `undefined`                        | `MISSING_FIELD`                             |
| Tipos de dato        | Cada campo tiene el tipo correcto (`string`, `number`, `boolean`, objeto, array)          | `INVALID_TYPE`                              |
| Claves válidas       | No se aceptan propiedades fuera de la interfaz del endpoint                               | `UNKNOWN_FIELD`                             |
| Formatos específicos | Email, teléfono, UUID, ISO 8601, etc. — documentados en la sección "Validaciones" de cada endpoint | código propio del endpoint          |

### 4.2 Flujo de validación

```
Request body recibido
       │
       ▼
¿Cumple el esquema? ──── NO ──► ApiError { code, message }  HTTP 400
       │
      SÍ
       │
       ▼
Lógica de negocio del endpoint
```

### 4.3 Fuente del esquema

Por ahora el esquema de cada endpoint se toma directamente de su `interface *Request`. Ejemplo:

```typescript
// Endpoint: PUT /api/client/vehicles/:id
// Esquema = VehicleRequest
interface VehicleRequest {
  brand: string;          // requerido, string
  model: string;          // requerido, string
  color: string;          // requerido, string
  vehicleSize: CatalogRef; // requerido, objeto con id y slug
  plate?: string;         // opcional, string
}
```

> Los errores de validación de formato o lógica de negocio (p.ej. `INVALID_EMAIL_FORMAT`, `INVALID_DURATION`, `INVALID_PACKAGE`) están documentados en la sección **Validaciones** de cada endpoint y son adicionales a los errores del esquema.

---

## 5. Campos de auditoría — `createdAt`, `updatedAt`, `deletedAt`

Toda colección del sistema incluye estos tres campos. No los envía el cliente — el backend los gestiona automáticamente.

| Campo       | Tipo            | Quién lo asigna | Cuándo                                                      |
|-------------|-----------------|-----------------|-------------------------------------------------------------|
| `createdAt` | `string` ISO 8601 | Backend       | Al insertar el registro (POST / paso 2 del flujo idempotente) |
| `updatedAt` | `string` ISO 8601 | Backend       | Al modificar el registro (PUT); igual a `createdAt` al crear |
| `deletedAt` | `string \| null` ISO 8601 | Backend | Al eliminar lógicamente (DELETE); `null` mientras el registro está activo |

### Eliminación lógica (soft delete)

Ninguna colección borra registros físicamente. Un DELETE actualiza `deletedAt` con la fecha y hora actuales. Cualquier consulta posterior que no filtre `deletedAt = null` podría devolver registros eliminados — el backend aplica ese filtro por defecto en todos los GET.

```
DELETE recibido
      │
      ▼
Backend asigna deletedAt = ahora   (registro sigue en DynamoDB)
      │
      ▼
Responde ApiResponse<AckResponse>
```

### Regla en requests

El cliente **nunca** envía `createdAt`, `updatedAt` ni `deletedAt` en un POST o PUT. Si alguno de estos campos aparece en el body, el backend lo ignora (no genera `UNKNOWN_FIELD` — son campos reservados).

---

## 6. Sincronización con `id_registry`

Toda operación que modifique o elimine un registro actualiza **simultáneamente** el registro correspondiente en `id_registry`. El backend ejecuta ambas escrituras en la misma operación — si una falla, la otra se revierte.

| Operación | Cambios en `id_registry`                                      |
|-----------|---------------------------------------------------------------|
| **PUT**   | `action` → `"update"` · `updatedAt` → ahora                  |
| **DELETE**| `action` → `"delete"` · `updatedAt` → ahora                  |

### Flujo completo del ciclo de vida de un registro

```
POST /ids  →  id_registry { action: "create", updatedAt: null }
                    │
                    ▼
PUT /:id   →  id_registry { action: "update", updatedAt: ahora }
                    │
                    ▼
DELETE /:id →  id_registry { action: "delete", updatedAt: ahora }
```

> Esta regla aplica a todas las colecciones sin excepción. Los endpoints no necesitan documentarlo individualmente — se da por implícito.
