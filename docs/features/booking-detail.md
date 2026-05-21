# Detalle de reserva

## Qué hace

Vista completa de una reserva. Muestra fecha/hora, total, badges de estatus, **observaciones del cliente**, contacto, vehículo, servicios, y — si está completada — la **reseña** dejada por el cliente. En la parte inferior aparecen las acciones disponibles según el estatus actual: aceptar / rechazar, iniciar servicio o marcar como completado.

## Ruta

- Frontend: `/bookings/:id`
- Archivo: `artifacts/cw-company/src/pages/BookingDetail.tsx`

## Datos

`GET /api/company/bookings/:bookingId` → `CompanyBooking` (mismo schema que en la lista, ver [bookings.md](./bookings.md)).

Hook: `useGetCompanyBooking(id)`.

## Acciones (mutations)

Todas usan el `bookingId` de la ruta. Al éxito muestran `toast` y revalidan:

```ts
qc.invalidateQueries(getListCompanyBookingsQueryKey());
qc.invalidateQueries(getGetCompanyDashboardQueryKey());
qc.invalidateQueries(getGetCompanyBookingQueryKey(id));
```

| Acción | Endpoint | Hook | Body | Visible si |
| --- | --- | --- | --- | --- |
| Aceptar | `POST /api/company/bookings/:id/accept` | `useAcceptCompanyBooking` | — | `companyStatus === "pending_acceptance"` |
| Rechazar | `POST /api/company/bookings/:id/reject` | `useRejectCompanyBooking` | `{ "reason": "string ≥5 chars" }` | `companyStatus === "pending_acceptance"` |
| Iniciar servicio | `POST /api/company/bookings/:id/start` | `useStartCompanyBooking` | — | `status === "accepted"` |
| Marcar completado | `POST /api/company/bookings/:id/complete` | `useCompleteCompanyBooking` | — | `status === "in_progress"` |

`reject` además navega de regreso a `/bookings`. `complete` dispara en el backend la creación automática de la fila en `billings` con el total calculado (paquete o servicios + add-ons), que luego alimenta la pantalla de Ingresos.

### Form de rechazo

Se abre inline al tocar "Rechazar". Textarea + dos botones (`Cancelar` / `Confirmar`). El botón confirma con `reason.trim().length >= 5`.

## Estados y variantes

### Cards condicionales

| Card | Se muestra cuando |
| --- | --- |
| **Resumen** (fecha, hora, total, badges, `PaymentBadge`) | Siempre. |
| **Observaciones del cliente** (sky-themed, icono `MessageSquare`) | `b.comments` no es null/vacío. |
| **Reseña del cliente** (amber-themed, icono `Star`) | `status === "completed"`. Dentro: si hay `review` se pinta rating + estrellas + comentario + fecha; si no, *"El cliente aún no ha calificado este servicio"*. |
| **Cliente** (teléfono `tel:` clickable, dirección) | Siempre. |
| **Vehículo** | Siempre (campos opcionales caen a `—`). |
| **Servicio** (washType + addOns) | Siempre. |
| **Motivo de rechazo** | `showReject && companyStatus === "pending_acceptance"`. |

### Barra inferior según estatus

| `companyStatus` / `status` | Botones |
| --- | --- |
| `pending_acceptance` | `Rechazar` (outline) + `Aceptar` (primary). |
| `status === "accepted"` | `Iniciar servicio`. |
| `status === "in_progress"` | `Marcar como completado`. |
| `status === "completed"` o `"cancelled"` | `Volver` → `/bookings`. |

### Loading

`Skeleton` h-64 mientras `isLoading`.

### Header

`AppHeader title="Detalle de reserva" back="/bookings"`. El back usa `window.history.back()` con fallback al path declarado.

## Componentes clave

- `useGetCompanyBooking`, mutaciones generadas por Orval.
- `StatusBadge`, `CompanyStatusBadge`, `PaymentBadge` (`src/components/StatusBadge.tsx`).
- `MobileFrame`, `AppHeader` (`src/components/Layout.tsx`).
- `formatCurrency`, `formatDateLong` (`src/lib/format.ts`).
- `toast` de `sonner` para feedback de mutations.
