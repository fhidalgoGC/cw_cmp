# Paquetes

## Qué hace

Lista de **paquetes del catálogo global** que la empresa puede activar o desactivar para sus clientes. Cada paquete viene predefinido (nombre, tipo de lavado incluido y color de identificación) y la empresa solo decide si lo ofrece o no.

## Ruta

- Frontend: `/packages`
- Archivo: `artifacts/cw-company/src/pages/Packages.tsx`
- Acceso desde: `/profile` → "Paquetes".

## Datos

`GET /api/company/packages` → `CompanyPackageOption[]`:

```json
[
  {
    "package":  { "id": "pkg_…", "slug": "premium", "name": "Premium" },
    "name": "Premium",
    "color": "#1f7ae0",
    "washType": { "id": "wt_…", "slug": "completo", "name": "Completo" },
    "active": true
  }
]
```

Hook: `useListCompanyPackages()`.

## Acciones

`PUT /api/company/packages` (`useUpdateCompanyPackages`).

Body `CompanyPackagesUpdate`:

```json
{
  "packages": [
    { "packageId": "pkg_…", "active": true },
    { "packageId": "pkg_…", "active": false }
  ]
}
```

El frontend envía **todos** los paquetes (no solo los que cambiaron). Al éxito muestra `Paquetes actualizados` y refetch.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | `Skeleton` h-40. |
| Lista | Cada paquete: barra de color a la izquierda, nombre, *"Incluye {washType.name}"*, `Switch` a la derecha. |
| Guardando | Botón "Guardar" del header deshabilitado (`update.isPending`). |

El usuario puede alternar varios paquetes y luego confirmar con "Guardar" (no autosave).

## Componentes clave

- `useListCompanyPackages`, `useUpdateCompanyPackages` (Orval).
- `Switch`, `Card`, `Button`, `Skeleton` (shadcn/ui).
- `AppHeader back="/profile"` con botón `Guardar` en `right`.
