# Datos del negocio

## Qué hace

Formulario simple para editar la información básica de la empresa: **nombre** y **teléfono**. El correo se muestra pero es de solo lectura (es la identidad de la cuenta y no se puede cambiar desde la app).

## Ruta

- Frontend: `/company-data`
- Archivo: `artifacts/cw-company/src/pages/CompanyData.tsx`
- Acceso desde: `/profile` → "Datos".

## Datos

`GET /api/company/profile` → `CompanyProfile` (ver [profile.md](./profile.md)).

Solo se usan `name`, `email` y `phone`.

## Acciones

`PUT /api/company/profile` (`useUpdateCompanyProfile`).

Body `CompanyProfileUpdate` (ambos opcionales):

```json
{
  "name": "Auto Spa CDMX",
  "phone": "+52 55 1234 5678"
}
```

En éxito: toast `Datos actualizados` y `refetch()` del perfil.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Cargando | `Skeleton` h-64. |
| Cargado | Tres campos: `Correo` (disabled), `Nombre`, `Teléfono`. |
| Sin cambios | Botón `Guardar cambios` deshabilitado: `name === p.name && phone === p.phone`. |
| Guardando | Botón deshabilitado con `update.isPending`. |

### Validaciones

- El backend acepta strings; la UI no aplica validaciones extra. No hay límites de longitud impuestos en cliente.
- Correo nunca se envía en el body (no se modifica).

## Componentes clave

- `useGetCompanyProfile`, `useUpdateCompanyProfile` (Orval).
- `Card`, `Input`, `Label`, `Button`, `Skeleton` (shadcn/ui).
- `toast` de `sonner`.
- `AppHeader back="/profile"`.
