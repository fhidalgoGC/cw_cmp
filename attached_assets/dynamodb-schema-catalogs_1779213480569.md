# Esquema DynamoDB — Catálogos

> Las tablas de catálogo definen los valores de referencia del sistema (paquetes, servicios, tipos de lavado, tamaños de vehículo y zonas). **Solo la plataforma puede crear o editar estas tablas.** Ningún cliente ni empresa escribe en ellas directamente.
>
> **Patrón `id + slug`:** Cada ítem tiene `id` (UUID, PK) y `slug` (legible, GSI). Cualquier otra tabla que referencie un catálogo guarda siempre `{ id, slug }` para que el dato sea legible sin hacer joins.
>
> **Timestamps:** Todas las tablas incluyen `createdAt` (al crear), `updatedAt` (en cada PUT; `null` si nunca modificado) y `deletedAt` (al eliminar lógicamente; `null` mientras activo).

---

## Índice

| Tabla                           | Descripción                                    |
|---------------------------------|------------------------------------------------|
| `carwash_catalog_packages`      | Paquetes de membresía disponibles para la venta |
| `carwash_catalog_services`      | Servicios individuales y add-ons               |
| `carwash_catalog_wash_types`    | Tipos de lavado                                |
| `carwash_catalog_vehicle_sizes` | Tamaños de vehículo con precio base            |
| `carwash_catalog_zones`         | Zonas de cobertura del servicio                |

---

## `carwash_catalog_vehicle_sizes`

Tamaños de vehículo con su precio base. Solo 3 ítems fijos.

| Clave  | Atributo | Tipo   | Descripción     |
|--------|----------|--------|-----------------|
| **PK** | `id`     | String | UUID del tamaño |

**Atributos:**

| Atributo    | Tipo   | Descripción                                          |
|-------------|--------|------------------------------------------------------|
| `slug`      | String | Identificador legible: `"small"`, `"suv"`, `"large"` |
| `name`      | String | Nombre visible (ej. `"Sedán / Hatchback"`)           |
| `basePrice` | Number | Precio base en MXN                                   |
| `createdAt` | String | ISO 8601 — fecha de creación                         |
| `updatedAt` | String | ISO 8601 — última modificación; `null` si nunca actualizado |
| `deletedAt` | String | ISO 8601 — eliminación lógica; `null` mientras activo |

**GSI:**

| Nombre       | PK     | Uso                                  |
|--------------|--------|--------------------------------------|
| `slug-index` | `slug` | Buscar por slug sin conocer el UUID  |

**Datos iniciales:**

```json
[
  { "id": "cat-vs-001", "slug": "small", "name": "Pequeño",   "basePrice": 150 },
  { "id": "cat-vs-002", "slug": "suv",   "name": "Camioneta", "basePrice": 200 },
  { "id": "cat-vs-003", "slug": "large", "name": "Grande",    "basePrice": 250 }
]
```

> Los `id` son UUIDs reales al sembrar. Se muestran cortos aquí solo como referencia.

---

## `carwash_catalog_wash_types`

Tipos de lavado disponibles. Determinan qué servicios se incluyen y cuánto cuesta el lavado sobre la base del vehículo.

| Clave  | Atributo | Tipo   | Descripción            |
|--------|----------|--------|------------------------|
| **PK** | `id`     | String | UUID del tipo de lavado |

**Atributos:**

| Atributo           | Tipo   | Descripción                                         |
|--------------------|--------|-----------------------------------------------------|
| `slug`             | String | Identificador legible (ej. `"premium"`, `"basic"`)  |
| `name`             | String | Nombre visible                                      |
| `additionalCost`   | Number | Costo adicional sobre el precio base del vehículo   |
| `includedServices` | List    | `[{ id, slug }]` — servicios que este tipo incluye             |
| `active`           | Boolean | Si está disponible para nuevas citas                           |
| `createdAt`        | String  | ISO 8601 — fecha de creación                                   |
| `updatedAt`        | String  | ISO 8601 — última modificación; `null` si nunca actualizado    |
| `deletedAt`        | String  | ISO 8601 — eliminación lógica; `null` mientras activo          |

**GSI:**

| Nombre       | PK     | Uso                                  |
|--------------|--------|--------------------------------------|
| `slug-index` | `slug` | Buscar por slug sin conocer el UUID  |

**Datos iniciales:**

```json
[
  {
    "id": "cat-wt-001", "slug": "basic", "name": "Básico",
    "additionalCost": 0, "active": true,
    "includedServices": [
      { "id": "cat-svc-001", "slug": "exterior" },
      { "id": "cat-svc-002", "slug": "aspirado" }
    ]
  },
  {
    "id": "cat-wt-002", "slug": "complete", "name": "Completo",
    "additionalCost": 80, "active": true,
    "includedServices": [
      { "id": "cat-svc-001", "slug": "exterior" },
      { "id": "cat-svc-002", "slug": "aspirado" },
      { "id": "cat-svc-003", "slug": "interior" },
      { "id": "cat-svc-004", "slug": "vidrios" }
    ]
  },
  {
    "id": "cat-wt-003", "slug": "premium", "name": "Premium",
    "additionalCost": 150, "active": true,
    "includedServices": [
      { "id": "cat-svc-001", "slug": "exterior" },
      { "id": "cat-svc-002", "slug": "aspirado" },
      { "id": "cat-svc-003", "slug": "interior" },
      { "id": "cat-svc-004", "slug": "vidrios" },
      { "id": "cat-svc-005", "slug": "rines" }
    ]
  },
  {
    "id": "cat-wt-004", "slug": "detail", "name": "Detallado",
    "additionalCost": 250, "active": true,
    "includedServices": [
      { "id": "cat-svc-001", "slug": "exterior" },
      { "id": "cat-svc-002", "slug": "aspirado" },
      { "id": "cat-svc-003", "slug": "interior" },
      { "id": "cat-svc-004", "slug": "vidrios" },
      { "id": "cat-svc-005", "slug": "rines" },
      { "id": "cat-svc-006", "slug": "motor" },
      { "id": "cat-svc-007", "slug": "cera" }
    ]
  },
  {
    "id": "cat-wt-005", "slug": "full", "name": "Full",
    "additionalCost": 380, "active": true,
    "includedServices": [
      { "id": "cat-svc-001", "slug": "exterior" },
      { "id": "cat-svc-002", "slug": "aspirado" },
      { "id": "cat-svc-003", "slug": "interior" },
      { "id": "cat-svc-004", "slug": "vidrios" },
      { "id": "cat-svc-005", "slug": "rines" },
      { "id": "cat-svc-006", "slug": "motor" },
      { "id": "cat-svc-007", "slug": "cera" },
      { "id": "cat-svc-008", "slug": "tapiceria" }
    ]
  }
]
```

---

## `carwash_catalog_services`

Servicios individuales disponibles como add-ons o incluidos dentro de un tipo de lavado.

| Clave  | Atributo | Tipo   | Descripción       |
|--------|----------|--------|-------------------|
| **PK** | `id`     | String | UUID del servicio |

**Atributos:**

| Atributo          | Tipo   | Descripción                                              |
|-------------------|--------|----------------------------------------------------------|
| `slug`            | String | Identificador legible (ej. `"rines"`, `"aspirado"`)      |
| `name`            | String | Nombre visible                                           |
| `extraPrice`      | Number | Precio si se agrega como add-on fuera del tipo de lavado |
| `includedIn`      | List   | `[{ id, slug }]` — wash types que ya lo incluyen        |
| `estimatedMinMin` | Number  | Duración mínima estimada en minutos                           |
| `estimatedMinMax` | Number  | Duración máxima estimada en minutos                           |
| `active`          | Boolean | Si está disponible para seleccionar                           |
| `createdAt`       | String  | ISO 8601 — fecha de creación                                  |
| `updatedAt`       | String  | ISO 8601 — última modificación; `null` si nunca actualizado   |
| `deletedAt`       | String  | ISO 8601 — eliminación lógica; `null` mientras activo         |

**GSI:**

| Nombre       | PK     | Uso                                  |
|--------------|--------|--------------------------------------|
| `slug-index` | `slug` | Buscar por slug sin conocer el UUID  |

**Datos iniciales:**

```json
[
  {
    "id": "cat-svc-001", "slug": "exterior", "name": "Lavado Exterior",
    "extraPrice": 0, "estimatedMinMin": 15, "estimatedMinMax": 20, "active": true,
    "includedIn": [
      { "id": "cat-wt-001", "slug": "basic" }, { "id": "cat-wt-002", "slug": "complete" },
      { "id": "cat-wt-003", "slug": "premium" }, { "id": "cat-wt-004", "slug": "detail" },
      { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-002", "slug": "aspirado", "name": "Aspirado",
    "extraPrice": 0, "estimatedMinMin": 10, "estimatedMinMax": 15, "active": true,
    "includedIn": [
      { "id": "cat-wt-001", "slug": "basic" }, { "id": "cat-wt-002", "slug": "complete" },
      { "id": "cat-wt-003", "slug": "premium" }, { "id": "cat-wt-004", "slug": "detail" },
      { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-003", "slug": "interior", "name": "Interior Completo",
    "extraPrice": 100, "estimatedMinMin": 15, "estimatedMinMax": 25, "active": true,
    "includedIn": [
      { "id": "cat-wt-002", "slug": "complete" }, { "id": "cat-wt-003", "slug": "premium" },
      { "id": "cat-wt-004", "slug": "detail" }, { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-004", "slug": "vidrios", "name": "Limpieza de Vidrios",
    "extraPrice": 0, "estimatedMinMin": 5, "estimatedMinMax": 10, "active": true,
    "includedIn": [
      { "id": "cat-wt-002", "slug": "complete" }, { "id": "cat-wt-003", "slug": "premium" },
      { "id": "cat-wt-004", "slug": "detail" }, { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-005", "slug": "rines", "name": "Detallado de Rines",
    "extraPrice": 50, "estimatedMinMin": 10, "estimatedMinMax": 15, "active": true,
    "includedIn": [
      { "id": "cat-wt-003", "slug": "premium" }, { "id": "cat-wt-004", "slug": "detail" },
      { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-006", "slug": "motor", "name": "Lavado de Motor",
    "extraPrice": 70, "estimatedMinMin": 15, "estimatedMinMax": 20, "active": true,
    "includedIn": [
      { "id": "cat-wt-004", "slug": "detail" }, { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-007", "slug": "cera", "name": "Encerado Premium",
    "extraPrice": 80, "estimatedMinMin": 15, "estimatedMinMax": 25, "active": true,
    "includedIn": [
      { "id": "cat-wt-004", "slug": "detail" }, { "id": "cat-wt-005", "slug": "full" }
    ]
  },
  {
    "id": "cat-svc-008", "slug": "tapiceria", "name": "Limpieza de Tapicería",
    "extraPrice": 120, "estimatedMinMin": 20, "estimatedMinMax": 30, "active": true,
    "includedIn": [
      { "id": "cat-wt-005", "slug": "full" }
    ]
  }
]
```

---

## `carwash_catalog_packages`

Paquetes de membresía disponibles para la venta. Solo la plataforma los crea o edita.

| Clave  | Atributo | Tipo   | Descripción      |
|--------|----------|--------|------------------|
| **PK** | `id`     | String | UUID del paquete |

**Atributos:**

| Atributo         | Tipo    | Descripción                                                         |
|------------------|---------|---------------------------------------------------------------------|
| `slug`           | String  | Identificador legible (ej. `"basico"`, `"completo"`, `"premium"`)   |
| `name`           | String  | Nombre visible (ej. `"Básico"`)                                     |
| `color`          | String  | Color hex para la UI (ej. `"#3B82F6"`)                             |
| `washType`       | Map     | `{ id, slug }` — tipo de lavado que incluye                         |
| `addOnsIncluded` | List    | `[{ id, slug, maxUses }]` — add-ons con límite de usos             |
| `benefits`       | List    | Textos de beneficios para mostrar en la UI                          |
| `durations`      | List    | Opciones de duración definidas por la plataforma — cada elemento: `{ days: N, label: String, washesIncluded: N, prices: { <sizeSlug>: N } }` |
| `popular`        | Boolean | Si se muestra como el paquete recomendado en la UI                 |
| `active`         | Boolean | Si está disponible para comprar                                    |
| `createdAt`      | String  | ISO 8601 — fecha de creación                                       |
| `updatedAt`      | String  | ISO 8601 — última modificación; `null` si nunca actualizado        |
| `deletedAt`      | String  | ISO 8601 — eliminación lógica; `null` mientras activo              |

**GSI:**

| Nombre       | PK     | Uso                                  |
|--------------|--------|--------------------------------------|
| `slug-index` | `slug` | Buscar por slug sin conocer el UUID  |

**Datos iniciales:**

### Básico — `#3B82F6`

```json
{
  "id": "cat-pkg-001",
  "slug": "basico",
  "name": "Básico",
  "color": "#3B82F6",
  "washType": { "id": "cat-wt-001", "slug": "basic" },
  "popular": false,
  "addOnsIncluded": [],
  "benefits": ["Lavado exterior", "Aspirado interior", "Prioridad en citas"],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 269,  "suv": 359,  "large": 449  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 479,  "suv": 639,  "large": 799  } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 1249, "suv": 1679, "large": 2099 } }
  ],
  "active": true
}
```

### Completo — `#8B5CF6` — *Popular*

```json
{
  "id": "cat-pkg-002",
  "slug": "completo",
  "name": "Completo",
  "color": "#8B5CF6",
  "washType": { "id": "cat-wt-002", "slug": "complete" },
  "popular": true,
  "addOnsIncluded": [
    { "id": "cat-svc-003", "slug": "interior", "maxUses": 2 }
  ],
  "benefits": [
    "Lavado exterior", "Interior completo",
    "Limpieza de vidrios", "Aspirado interior"
  ],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 409,  "suv": 499,  "large": 589  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 729,  "suv": 899,  "large": 1049 } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 1929, "suv": 2349, "large": 2769 } }
  ],
  "active": true
}
```

### Premium — `#F59E0B`

```json
{
  "id": "cat-pkg-003",
  "slug": "premium",
  "name": "Premium",
  "color": "#F59E0B",
  "washType": { "id": "cat-wt-003", "slug": "premium" },
  "popular": false,
  "addOnsIncluded": [
    { "id": "cat-svc-003", "slug": "interior",  "maxUses": 4 },
    { "id": "cat-svc-005", "slug": "rines",     "maxUses": 4 },
    { "id": "cat-svc-007", "slug": "cera",      "maxUses": 2 }
  ],
  "benefits": [
    "Lavado exterior", "Interior completo",
    "Detallado de rines", "Encerado premium", "Limpieza de vidrios"
  ],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 539,  "suv": 629,  "large": 719  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 959,  "suv": 1119, "large": 1279 } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 2499, "suv": 2929, "large": 3359 } }
  ],
  "active": true
}
```

---

## `carwash_catalog_zones`

Zonas de cobertura habilitadas por la plataforma.

| Clave  | Atributo | Tipo   | Descripción     |
|--------|----------|--------|-----------------|
| **PK** | `id`     | String | UUID de la zona |

**Atributos:**

| Atributo   | Tipo    | Descripción                                               |
|------------|---------|-----------------------------------------------------------|
| `slug`     | String  | Identificador legible (ej. `"tlajomulco-jalisco"`)        |
| `state`    | String  | Estado (ej. `"Jalisco"`)                                  |
| `city`     | String  | Ciudad (ej. `"Tlajomulco de Zúñiga"`)                    |
| `colonias` | List    | Lista de strings con las colonias habilitadas                      |
| `active`   | Boolean | Si la zona está operativa                                          |
| `createdAt`| String  | ISO 8601 — fecha de creación                                       |
| `updatedAt`| String  | ISO 8601 — última modificación; `null` si nunca actualizado        |
| `deletedAt`| String  | ISO 8601 — eliminación lógica; `null` mientras activo              |

**GSI:**

| Nombre       | PK     | Uso                                  |
|--------------|--------|--------------------------------------|
| `slug-index` | `slug` | Buscar por slug sin conocer el UUID  |

**Datos iniciales:**

```json
{
  "id": "cat-zone-001",
  "slug": "tlajomulco-jalisco",
  "state": "Jalisco",
  "city": "Tlajomulco de Zúñiga",
  "colonias": ["Villa California", "Casa Fuerte", "Adamar"],
  "active": true
}
```

> La plataforma puede agregar más colonias con `PUT /api/platform/catalog/zones` sin tocar código.
