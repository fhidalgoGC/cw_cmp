# Ingresos

## Qué hace

Resumen financiero del negocio en un rango de fechas. Muestra:

- Total facturado y número de servicios.
- Desglose **Pagado / Pendiente** y **Pago directo / Membresía**.
- Gráfica: ingresos **por día** del periodo (o **por hora**, si el filtro es "Hoy").
- Lista buscable de los servicios cobrados.

## Ruta

- Frontend: `/earnings`
- Archivo: `artifacts/cw-company/src/pages/Earnings.tsx`

## Datos

### Resumen

`GET /api/company/earnings?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` → `CompanyEarnings`:

```json
{
  "dateFrom": "2026-04-22",
  "dateTo":   "2026-05-21",
  "totalServices": 124,
  "totalAmount": 41200,
  "pending": 3400,
  "paid":   37800,
  "byType": { "directo": 28100, "membresia": 13100 },
  "dailySeries": [
    { "date": "2026-04-22", "amount": 1500, "services": 4 }
  ]
}
```

### Detalle de servicios cobrados

`GET /api/company/earnings/services?dateFrom&dateTo&limit` → `CompanyBillingList`:

```json
{
  "data": [
    {
      "id": "bil_…",
      "bookingId": "bk_…",
      "date": "2026-05-21",
      "time": "10:30",
      "clientName": "string",
      "vehicleSize": { "id": "…", "slug": "sedan", "name": "Sedán" },
      "washType":    { "id": "…", "slug": "completo", "name": "Completo" },
      "addOns":      [ { "id": "…", "slug": "encerado", "name": "Encerado" } ],
      "amount": 350,
      "paymentType":   "directo",
      "paymentStatus": "pendiente",
      "paidAt": null
    }
  ],
  "pagination": { "total": 124, "page": 1, "limit": 20, "totalPages": 7 }
}
```

Hooks: `useGetCompanyEarnings(range)` y `useListCompanyEarningServices({ ...range, limit })`.

`limit`: 200 cuando el filtro es **Hoy** (para tener todas las horas en la gráfica), 20 en otros rangos.

## Filtros

- Rango: **Hoy / 7 días / 14 días / 30 días** (default 30). El rango se calcula igual que en `Bookings`.
- Búsqueda dentro de la lista (cliente-side): cliente, tipo de lavado, tamaño de vehículo o fecha.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | `Skeleton` h-64. |
| Lista vacía | *"Sin servicios en el periodo"*. |
| Búsqueda sin match | *"Sin resultados para tu búsqueda"*. |

### Gráfica

- Si `days === 1` (filtro "Hoy") → `BarChart` con bins por hora (mínimo 08–18 + cualquier hora con datos fuera de ese rango). El monto por hora se calcula en cliente sumando `amount` de los `serviceRows` cuya `time.slice(0,2)` cae en el bin.
- Si `days > 1` → `BarChart` con `summary.dailySeries`.

### Tarjetas de KPIs

Total grande (`totalAmount`) + grid 2×2:

1. **Pagado** (emerald) — `summary.paid`.
2. **Pendiente** (amber) — `summary.pending`.
3. **Pago directo** — `summary.byType.directo`.
4. **Membresía** — `summary.byType.membresia`.

### Lista de servicios

Scroll interno (`max-h-[26rem]`). Cada `Card`:

- Fecha + hora.
- Cliente.
- `washType.name · vehicleSize.name`.
- `formatCurrency(amount)` + `PaymentBadge(paymentType, paymentStatus)`.

## Componentes clave

- `useGetCompanyEarnings`, `useListCompanyEarningServices` (Orval).
- `recharts`: `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `Tooltip`, `CartesianGrid`.
- `PaymentBadge` (`src/components/StatusBadge.tsx`).
- `formatCurrency`, `formatDateShort`, `todayIso`, `addDaysIso` (`src/lib/format.ts`).
