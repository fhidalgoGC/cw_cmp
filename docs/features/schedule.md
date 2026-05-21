# Horarios

## Qué hace

Permite a la empresa definir **qué slots de tiempo ofrece** durante la semana y **qué fechas bloquea**. La pantalla se divide en dos pestañas:

1. **Horarios** — slots por día de la semana, con scopes rápidos (`Todos`, `Lun–Vie`, `Sáb–Dom`, `Custom`).
2. **Fechas bloqueadas** — calendario donde se seleccionan días en los que no se atenderá.

## Ruta

- Frontend: `/schedule`
- Archivo: `artifacts/cw-company/src/pages/Schedule.tsx`

## Datos

### Disponibilidad actual

`GET /api/company/availability` → `CompanyAvailability`:

```json
{
  "slots": [
    { "weekday": 1, "time": "08:00", "enabled": true },
    { "weekday": 1, "time": "08:30", "enabled": false }
  ],
  "blockedDates": ["2026-05-25", "2026-06-01"]
}
```

- `weekday`: `0` = domingo … `6` = sábado.
- `time`: `"HH:MM"` (intervalos de 30 min en el seed).
- `enabled`: si la empresa expone ese slot a clientes.
- `blockedDates`: ISO `YYYY-MM-DD` en hora local.

Hook: `useGetCompanyAvailability()`.

Al hidratar, el componente agrupa los slots **por día de la semana** para detectar el `scope` activo (todos los días iguales → `all`; L-V vs S-D iguales → `weekdays`/`weekends`; resto → `custom`).

## Acciones

### Guardar

`PUT /api/company/availability` (`useUpdateCompanyAvailability`).

Body `CompanyAvailabilityUpdate`:

```json
{
  "slots": [
    { "weekday": 0, "time": "08:00", "enabled": false },
    { "weekday": 0, "time": "08:30", "enabled": false }
  ],
  "blockedDates": ["2026-05-25"]
}
```

El frontend serializa **todos** los slots posibles (para cada `weekday` y cada `time` del catálogo) marcando `enabled` según el set elegido. Esto permite que el backend reemplace de forma autoritativa el horario.

### Toast

`Horario actualizado` al éxito; revalida la query.

## Estados y variantes

### Tabs

| Tab | Contenido |
| --- | --- |
| `hours` | Selector de scope + grilla de slots por día. |
| `blocked` | `Calendar mode="multiple"` para alternar fechas. |

### Scopes (tab `hours`)

| Scope | Días afectados |
| --- | --- |
| `all` | 0–6 (toda la semana, mismos horarios). |
| `weekdays` | 1–5. |
| `weekends` | 0 y 6. |
| `custom` | Permite editar cada día por separado. |

Cuando se cambia el scope se propaga el set de horarios elegidos a los `weekday` correspondientes.

### Loading

`Skeleton` mientras `isLoading`.

### Guardar

Botón `Guardar` en `AppHeader right`; se deshabilita con `update.isPending`.

## Componentes clave

- `useGetCompanyAvailability`, `useUpdateCompanyAvailability` (Orval).
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (shadcn).
- `Calendar` (`mode="multiple"`, locale `es`) para `blockedDates`.
- `Switch` para alternar slots dentro del scope.
- `AppShell`, `AppHeader` (`src/components/Layout.tsx`).
