# Servicios

## Qué hace

Pantalla para activar/desactivar **tipos de lavado** y **servicios adicionales** que la empresa ofrece. Los precios y nombres vienen del catálogo global; la empresa solo decide qué expone a sus clientes.

## Ruta

- Frontend: `/services`
- Archivo: `artifacts/cw-company/src/pages/Services.tsx`
- Acceso desde: `/profile` → "Servicios".

## Datos

`GET /api/company/services` → `CompanyServiceOption[]`:

```json
[
  {
    "service": { "id": "svc_…", "slug": "completo", "name": "Completo" },
    "name": "Completo",
    "price": 250,
    "active": true,
    "kind": "wash_type"
  },
  {
    "service": { "id": "svc_…", "slug": "encerado", "name": "Encerado" },
    "name": "Encerado",
    "price": 80,
    "active": false,
    "kind": "add_on"
  }
]
```

`kind`:

| Valor | Sección en UI |
| --- | --- |
| `wash_type` | "Tipos de lavado" |
| `add_on` | "Servicios adicionales" |

Hook: `useListCompanyServices()`.

## Acciones

`PUT /api/company/services` (`useUpdateCompanyServices`).

Body `CompanyServicesUpdate`:

```json
{
  "services": [
    { "serviceId": "svc_…", "active": true },
    { "serviceId": "svc_…", "active": false }
  ]
}
```

Se envía la lista completa. Toast `Servicios actualizados` y refetch en éxito.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | `Skeleton` h-40. |
| Sin datos | Secciones vacías (no se renderiza placeholder explícito). |
| Normal | Dos secciones (Tipos / Adicionales) con `ServiceRow` (nombre + `formatCurrency(price)` + `Switch`). |

El usuario puede alternar varios servicios y luego confirmar con "Guardar" (no autosave).

## Componentes clave

- `useListCompanyServices`, `useUpdateCompanyServices` (Orval).
- `Switch`, `Card`, `Button`, `Skeleton` (shadcn/ui).
- `formatCurrency` (`src/lib/format.ts`).
- `AppHeader back="/profile"` con botón `Guardar` en `right`.
