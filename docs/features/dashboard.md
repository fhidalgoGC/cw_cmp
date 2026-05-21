# Dashboard

## Qué hace

Pantalla de inicio tras el login. Resume **el día de hoy** del car wash: cuántas reservas hay, cuántas están por aceptar, cuántas en curso y cuánto se lleva facturado. Además muestra la **calificación general** y un feed filtrable de **comentarios recientes de clientes** (cada uno enlaza al detalle de su reserva).

## Ruta

- Frontend: `/`
- Archivo: `artifacts/cw-company/src/pages/Dashboard.tsx`

## Datos

### Dashboard del día

`GET /api/company/dashboard?date=YYYY-MM-DD`

`date` se calcula con `todayIso()` (hora local de Mx para evitar el corrimiento UTC).

Response `200` (`CompanyDashboard`):

```json
{
  "date": "2026-05-21",
  "summary": {
    "total": 0,
    "pendingAcceptance": 0,
    "accepted": 0,
    "inProgress": 0,
    "completed": 0,
    "cancelled": 0,
    "revenueToday": 0
  },
  "nextBooking": null,
  "upcoming": [],
  "rating": 4.7,
  "totalReviews": 87,
  "recentReviews": [
    {
      "id": "rev_…",
      "bookingId": "bk_…",
      "rating": 5,
      "comment": "Excelente servicio",
      "clientName": "Ana López",
      "createdAt": "2026-05-19T17:42:00.000Z"
    }
  ]
}
```

- `rating` es el promedio de las **últimas 100 reseñas** de la empresa (puede ser `null` si aún no hay).
- `recentReviews` viene ordenado por fecha desc.

### Perfil de la empresa

`GET /api/company/profile` → se usa solo para tomar `name` y mostrarlo como título del header.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | `Skeleton` de 32 px sobre todo el bloque inferior. |
| Sin reseñas (`totalReviews === 0`) | Card de rating muestra `—` y texto "Aún sin calificaciones". Sección de comentarios: "Aún no hay reseñas de clientes". |
| Con reseñas pero filtro vacío | "No hay comentarios en esta categoría". |

### Filtros de comentarios

Tabs tipo pill con conteo dinámico:

| Filtro | Lógica |
| --- | --- |
| `all` | Todas. |
| `good` | `rating >= 4`. |
| `regular` | `rating === 3`. |
| `bad` | `rating <= 2`. |

### Tarjetas de stats

Cuatro `StatCard` (`total`, `pendingAcceptance`, `inProgress`, `revenueToday`). Cada una tiene un acento de color (default / amber / violet / emerald).

## Componentes clave

- `AppHeader` con solo `title={profile.name}` (no muestra fecha ni "Hola,").
- `RatingCard`: número grande + 5 estrellas + leyenda *"Promedio de las últimas 100 reservas"*.
- `ReviewsSection` + `ReviewRow`: cada fila es `<Link href="/bookings/:bookingId">` envolviendo una `Card` con `hover-elevate active-elevate-2`. Scroll vertical (`max-h-80 overflow-y-auto`).
