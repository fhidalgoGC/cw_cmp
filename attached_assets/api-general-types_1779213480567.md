# Tipos Generales de API — Car Wash

> Tipos que aplican a los **tres APIs** (cliente, empresa, plataforma). Cada endpoint especifica cuál wrapper usa y qué tipo concreto va dentro de `data`.
> Ver `api-rules.md` → Regla 3 para la convención de uso obligatorio.

---

## 1. Wrappers de respuesta

### `ApiResponse<T>` — un solo registro

Usado por: GET que devuelve un registro, POST de auth, POST de creación, PUT.

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
}
```

`T` es el tipo específico del endpoint (p.ej. `User`, `Booking`, `SavedVehicle`).

---

### `PaginatedResponse<T>` — lista con paginación

Usado por: todo GET que devuelve una colección — sin excepción. No existe respuesta de lista sin paginación.

```typescript
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;      // total de registros que cumplen el filtro
    page: number;       // página actual (base 1)
    limit: number;      // registros por página
    totalPages: number;
  };
}
```

---

### `ApiError` — error (todos los endpoints)

Devuelto en cualquier respuesta 4xx / 5xx.

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;    // ej. "BOOKING_NOT_FOUND", "MISSING_TOKEN"
    message: string; // descripción legible — solo para debug, no mostrar en UI
  };
}
```

---

## 2. Tipos de datos por verbo

### `Collection` — enum de colecciones

> Definición canónica en **`enums-general.md`**. Alias opacos para todas las tablas del sistema; ningún valor coincide con el nombre real de la tabla DynamoDB.

---

### `IdRegistryEntry` — POST idempotente (Paso 1: generar ID)

Devuelto como `ApiResponse<IdRegistryEntry>` al llamar `POST /api/*/ids`.

```typescript
interface IdRegistryEntry {
  id: string;               // UUID generado
  collection: Collection;   // colección destino — valor del enum, nunca el nombre de tabla
  action: "create";         // siempre "create" en el paso 1
  createdAt: string;        // ISO 8601 — cuándo se generó el ID
  updatedAt: string | null; // null al generar; se actualiza con el PUT o DELETE posterior
}
```

> Corresponde a lo que antes se llamaba `GenerateIdResponse` en los documentos de endpoint.

---

### `AckResponse` — DELETE

DELETE devuelve `ApiResponse<AckResponse>`.  
PUT devuelve `ApiResponse<T>` donde `T` es el tipo del recurso actualizado (p.ej. `SavedVehicle`).

```typescript
interface AckResponse {
  id: string;             // UUID del registro eliminado
  slug?: string;          // slug del registro, si el recurso lo tiene
  collection: Collection; // colección a la que pertenecía el registro
  message: string;        // ej. "Vehicle deleted"
}
```

---

## 3. Tabla de referencia rápida

| Verbo / caso                    | Wrapper                         | Tipo dentro de `data`                              |
|---------------------------------|---------------------------------|----------------------------------------------------|
| GET — un registro               | `ApiResponse<T>`                | tipo del recurso (p.ej. `Booking`)                 |
| GET — lista (paginada)          | `PaginatedResponse<T>`          | array + objeto `pagination`                        |
| POST — auth (login / registro)  | `ApiResponse<T>`                | `{ user: User; token: string }`                    |
| POST — idempotente (generar ID) | `ApiResponse<IdRegistryEntry>`  | entrada del registro de IDs                        |
| POST — creación directa         | `ApiResponse<T>`                | objeto recién creado                               |
| PUT — actualización             | `ApiResponse<T>`                | objeto actualizado del tipo del recurso            |
| DELETE — eliminación lógica     | `ApiResponse<AckResponse>`      | `{ id, slug?, collection, message }`               |
| Error (todos)                   | `ApiError`                      | `{ code: string; message: string }`                |
