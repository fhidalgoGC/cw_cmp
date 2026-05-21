# Login

## Qué hace

Pantalla de inicio de sesión para usuarios con rol `company`. Permite autenticarse con correo y contraseña; si la sesión ya está activa, el router redirige automáticamente al Dashboard.

Para demos, los campos llegan precargados con `empresa1@carwash.mx` / `Empresa123`.

## Ruta

- Frontend: `/login`
- Archivo: `artifacts/cw-company/src/pages/Login.tsx`

## Acciones

### Iniciar sesión

`POST /api/auth/login`

Request:

```json
{
  "email": "empresa1@carwash.mx",
  "password": "Empresa123"
}
```

Response `200`:

```json
{
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "role": "company",
    "companyId": "string"
  },
  "token": "string"
}
```

El cliente guarda `token` en `localStorage` (clave `cw_company_token`) y el generador Orval lo inyecta en `Authorization: Bearer …` para todas las llamadas siguientes (`setAuthTokenGetter` en `lib/auth.tsx`).

### Errores

- `401 Unauthorized` → credenciales inválidas. Se muestra el `message` del backend en `<p data-testid="login-error">`.
- Cualquier error de red cae al texto genérico `"Error al iniciar sesión"`.

## Estados y variantes

| Estado | UI |
| --- | --- |
| Inicial | Formulario habilitado con valores demo. |
| Enviando | Botón deshabilitado, texto `"Ingresando..."`. |
| Error | Mensaje rojo bajo los inputs, formulario habilitado. |
| Éxito | `navigate("/")` al Dashboard. |

Validaciones HTML5: ambos campos `required`, `email` con `type="email"` e `inputMode="email"`.

## Componentes clave

- `useAuth()` (`src/lib/auth.tsx`): expone `login(email, password)` y persiste sesión.
- `MobileFrame` (`src/components/Layout.tsx`): contenedor mobile.
- `Card`, `Input`, `Label`, `Button` (shadcn/ui).
