# Perfil

## Qué hace

Pantalla central de configuración de la empresa. Muestra el **estatus operativo de la cuenta** (en revisión / activa / denegada), un resumen con avatar, rating y conteo de reservas, y los accesos rápidos a las sub-pantallas: Datos del negocio, Paquetes, Servicios y Horarios. Incluye el botón de cerrar sesión.

## Ruta

- Frontend: `/profile`
- Archivo: `artifacts/cw-company/src/pages/Profile.tsx`

## Datos

`GET /api/company/profile` → `CompanyProfile`:

```json
{
  "id": "comp_…",
  "name": "Auto Spa CDMX",
  "email": "empresa1@carwash.mx",
  "phone": "+52 55 1234 5678",
  "active": true,
  "status": "active",
  "rating": 4.7,
  "totalBookings": 312,
  "completedBookings": 287,
  "createdAt": "2025-08-15T12:00:00.000Z"
}
```

Hook: `useGetCompanyProfile()`. También consume `useAuth()` para mostrar el correo en el header y disparar `logout()`.

## Acciones

### Logout

`POST /api/auth/logout` (lanzado desde `useAuth().logout()`). Limpia el token de `localStorage` y devuelve al `/login`.

### Navegación

Cards-link a:

| Card | Ruta | Descripción mostrada |
| --- | --- | --- |
| Datos | `/company-data` | Nombre, correo y teléfono del negocio. |
| Paquetes | `/packages` | Configura los planes que ofreces. |
| Servicios | `/services` | Lavados y adicionales activos. |
| Horarios | `/schedule` | Disponibilidad por día y fechas bloqueadas. |

## Estados y variantes

### `status` de la cuenta

| `status` | Banner | Pill | Nota inferior |
| --- | --- | --- | --- |
| `active` | Sin banner. | "Activada" (emerald). | — |
| `review` | Banner amber: *"En revisión. La plataforma está revisando tu cuenta."*. | "En revisión" (amber). | Texto pequeño: *"Mientras tu cuenta está en revisión puedes configurar tus datos, paquetes y servicios."*. |
| `denied` | Banner rose: *"Cuenta denegada. Contacta a soporte."*. | "Denegada" (rose). | — |

Aunque `review` y `denied` aún ven los accesos a sub-pantallas, **no recibirán reservas** hasta que el backend marque la cuenta como `active`.

### Loading

`Skeleton` h-40 mientras `isLoading`.

### Stats (footer de la tarjeta principal)

`Rating` (estrella amber), `Reservas` (total), `Completadas`. Si `rating` es null muestra `—`.

## Componentes clave

- `useGetCompanyProfile` (Orval).
- `useAuth()` (`src/lib/auth.tsx`) → `logout`, `user`.
- `StatusBanner`, `StatusPill`, `Stat` definidos en el mismo archivo.
- `Card`, `Button`, `Skeleton` (shadcn/ui), iconos de `lucide-react`.
