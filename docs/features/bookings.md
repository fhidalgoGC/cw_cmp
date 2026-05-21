# Reservas (lista)

## Qué hace

Listado de las reservas asignadas a la empresa, con buscador y filtros por rango de fechas y por estatus. Cada fila enlaza al detalle. Por defecto abre con **estatus = Pendientes** y **rango = Hoy**.

## Ruta

- Frontend: `/bookings`
- Archivo: `artifacts/cw-company/src/pages/Bookings.tsx`

## Datos

### Listado

`GET /api/company/bookings`

Query params (todos opcionales salvo el limit interno):

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| `search` | string | Match libre por cliente, dirección o placas. |
| `status` | `pending` \| `accepted` \| `in_progress` \| `completed` \| `cancelled` | Estatus operativo. |
| `dateFrom` | `YYYY-MM-DD` | Hora local. |
| `dateTo` | `YYYY-MM-DD` | Hora local. |
| `limit` | int | `50` por defecto en esta pantalla. |
| `page` | int | Paginación (no usada por la UI actual). |

Response `200` (`CompanyBookingList`):

```json
{
  "data": [
    {
      "id": "bk_…",
      "clientName": "string",
      "clientPhone": "string",
      "addressFull": "string",
      "vehicleSize":  { "id": "…", "slug": "sedan", "name": "Sedán" },
      "vehicleBrand": "Toyota",
      "vehicleModel": "Corolla",
      "vehicleColor": "Gris",
      "vehiclePlate": "ABC-1234",
      "washType":     { "id": "…", "slug": "completo", "name": "Completo" },
      "addOns":       [ { "id": "…", "slug": "encerado", "name": "Encerado" } ],
      "date": "2026-05-21",
      "time": "10:30",
      "totalPrice": 350,
      "status": "pending",
      "companyStatus": "pending_acceptance",
      "comments": "Tocar puerta lateral",
      "createdAt": "2026-05-20T14:00:00.000Z"
    }
  ],
  "pagination": { "total": 12, "page": 1, "limit": 50, "totalPages": 1 }
}
```

Hook generado: `useListCompanyBookings(params)`. El total de `pagination` se muestra como subtítulo del header (`"N resultados"`).

## Filtros

### Rango de fechas

Botones fijos: **Hoy (1)**, **7 días**, **14 días**, **30 días**. Cada uno calcula `dateFrom = todayIso() - (days-1)` y `dateTo = todayIso()`.

Adicionalmente un botón **"Rango"** abre un **bottom Sheet** con un calendario `Calendar mode="range"` (locale `es`, `numberOfMonths={1}`, full-width con `[--cell-size:2.75rem]` y `classNames={{ root: "w-full" }}`). Comportamiento:

- Auto-cierra cuando se eligen ambas fechas.
- Botones explícitos `Cancelar` y `Aplicar`.
- `Aplicar` exige `from` y `to`; setea `dateMode = { kind: "custom", from, to }`.

### Estatus

Tabs horizontales con scroll: `Todas` (`""`), `Pendientes`, `Aceptadas`, `En curso`, `Completadas`, `Canceladas`. Default: **Pendientes**.

### Búsqueda

Input controlado con icono `Search`, placeholder `"Buscar por cliente, dirección o placas"`. Va al backend como `?search=`.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | 5 `Skeleton` h-24. |
| Vacío | Card centrada: *"No hay reservas que mostrar"*. |
| Con datos | Lista de cards. |

Cada fila muestra:

- Fecha corta + hora.
- `CompanyStatusBadge` (`pending_acceptance` / `accepted_by_company` / `rejected_by_company`).
- Nombre del cliente (truncado).
- Vehículo + tipo de lavado.
- Dirección.
- Precio total + `StatusBadge` (operativo).

## Componentes clave

- `useListCompanyBookings` (Orval).
- `Calendar` (`mode="range"`, `locale={es}`).
- `Sheet`, `SheetContent side="bottom"`.
- `StatusBadge`, `CompanyStatusBadge` (`src/components/StatusBadge.tsx`).
- `formatCurrency`, `formatDateShort`, `todayIso`, `addDaysIso` (`src/lib/format.ts`).
