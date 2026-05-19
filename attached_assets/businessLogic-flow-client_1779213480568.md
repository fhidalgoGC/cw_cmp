# Flujo de la App Cliente — Car Wash

> Describe pantalla por pantalla qué hace el cliente, qué decisiones toma y qué endpoints consume en cada paso.
>
> **Actor:** usuario final que agenda lavados de carro desde su teléfono.

---

## Índice

1. [Onboarding — Registro e inicio de sesión](#1-onboarding--registro-e-inicio-de-sesión)
2. [Home — Pantalla principal](#2-home--pantalla-principal)
3. [Flujo de reserva (agendar cita)](#3-flujo-de-reserva-agendar-cita)
4. [Mis citas](#4-mis-citas)
5. [Membresías](#5-membresías)
6. [Perfil y datos personales](#6-perfil-y-datos-personales)

---

## 1. Onboarding — Registro e inicio de sesión

```
App abre por primera vez (o sin sesión activa)
│
├── ¿Hay token guardado?
│   ├── Sí → GET /api/auth/me
│   │        ├── Éxito → navega a Home
│   │        └── Error 401 → borra token → muestra pantalla de login
│   │
│   └── No → muestra pantalla de login
│
├── Pantalla: Login
│   ├── Cliente ingresa email + contraseña
│   │   └── POST /api/auth/login
│   │       ├── Éxito → guarda token → navega a Home
│   │       └── Error 401 → "Email o contraseña incorrectos"
│   │
│   └── "¿No tienes cuenta? Regístrate"
│       └── Pantalla: Registro
│           ├── Cliente llena: nombre, teléfono, email, contraseña
│           └── POST /api/auth/register
│               ├── Éxito → guarda token → navega a Home
│               ├── Error 400 EMAIL_ALREADY_EXISTS → "Este email ya está registrado"
│               └── Error 400 INVALID_PHONE → "Formato de teléfono inválido"
│
└── Cerrar sesión (desde perfil)
    └── POST /api/auth/logout → borra token → pantalla de login
```

---

## 2. Home — Pantalla principal

La home carga los datos del cliente y muestra accesos directos a las funciones principales. También muestra un resumen de citas próximas y membresías activas.

```
Pantalla: Home
│
├── Al entrar
│   └── GET /api/client/profile
│       → Carga: datos del usuario, vehículos, direcciones, membresías
│
├── Sección "Próximas citas"
│   └── GET /api/client/bookings?status=pending&limit=3
│       → Muestra las próximas 3 citas pendientes o aceptadas
│       → Toca una cita → flujo 4.2 (detalle de cita)
│
├── Sección "Membresía activa"
│   → Muestra la membresía activa más reciente (si existe)
│   → Toca → flujo 5.2 (detalle de membresía)
│
├── Botón principal "Agendar lavado"
│   └── → flujo 3 (reserva)
│
└── Botón "Ver paquetes / Membresías"
    └── → flujo 5 (membresías)
```

---

## 3. Flujo de Reserva (agendar cita)

El cliente pasa por varios pasos para configurar su cita. El ID de la cita se genera al inicio del flujo y se va completando con `PUT` en la pantalla de confirmación.

```
Inicia al tocar "Agendar lavado"
│
└── PASO 0 — Generar ID de cita
    └── POST /api/client/ids  body: { collection: "bookings" }  → { id: "booking-abc", ... }
        (se guarda localmente para usar en el PUT final)
```

### Paso 1 — Elegir vehículo

```
Pantalla: ¿Con qué vehículo?
│
├── Carga vehículos guardados
│   └── GET /api/client/vehicles
│
├── Opción A: Seleccionar un vehículo guardado
│   └── Guarda selección → continúa a Paso 2
│
└── Opción B: Ingresar vehículo nuevo (sin guardarlo)
    ├── Llena: tamaño, marca, modelo, color, placa (opcional)
    └── Guarda localmente → continúa a Paso 2
    Nota: si quiere guardar el vehículo para futuros usos:
          POST /api/client/vehicles → { id }
          PUT /api/client/vehicles/:id → guarda el vehículo
```

### Paso 2 — Elegir dirección

```
Pantalla: ¿Dónde hacemos el lavado?
│
├── Carga direcciones guardadas
│   └── GET /api/client/addresses
│
├── Opción A: Seleccionar una dirección guardada
│   └── Guarda selección → continúa a Paso 3
│
└── Opción B: Ingresar dirección nueva (sin guardarla)
    ├── Llena: colonia, calle, número, coto, referencia
    └── Guarda localmente → continúa a Paso 3
    Nota: si quiere guardar la dirección:
          POST /api/client/addresses → { id }
          PUT /api/client/addresses/:id → guarda la dirección
```

### Paso 3 — Elegir servicio

```
Pantalla: ¿Qué tipo de lavado?
│
├── Carga servicios y precios según tamaño de vehículo
│   └── GET /api/client/catalog/services
│
├── Cliente elige tipo de lavado (basic / complete / premium / detail / full)
│
├── Se muestran add-ons disponibles:
│   ├── Add-ons incluidos en su membresía activa (gratis / con usos restantes)
│   └── Add-ons de pago (precio calculado en tiempo real)
│
├── ¿Tiene membresía activa?
│   ├── Sí → se muestra banner "Usar membresía — X lavadas restantes"
│   │         si el tipo de lavado no coincide con la membresía → se cobra diferencia
│   └── No → precio calculado por tipo de lavado + add-ons + tamaño del vehículo
│
└── Guarda selección → continúa a Paso 4
```

### Paso 4 — Elegir fecha y hora

```
Pantalla: ¿Cuándo?
│
├── Cliente selecciona fecha en el calendario
│   └── GET /api/client/availability?date=YYYY-MM-DD&vehicleSize=X
│       → Muestra horarios disponibles con cupos restantes
│         (cupos = número de empresas disponibles en ese slot)
│
├── Cliente toca un horario disponible
│   └── Guarda fecha + hora → continúa a Paso 5
│
└── Si no hay horarios → "Sin disponibilidad para este día, elige otra fecha"
```

### Paso 5 — Confirmar y agendar

```
Pantalla: Resumen de la cita
│
├── Muestra resumen completo:
│   vehículo, dirección, servicio, add-ons, fecha, hora,
│   precio total (o "Membresía" si aplica)
│
├── Cliente confirma
│   └── PUT /api/client/bookings/:bookingId
│       body: { vehicleId/vehicleData, addressId/addressLabel,
│               washType, addOns, date, time, membershipId? }
│       ├── Éxito → cita creada en status "pending"
│       │           El sistema asigna empresa automáticamente
│       │           → navega a confirmación
│       ├── Error 400 SLOT_UNAVAILABLE → "Este horario ya no está disponible,
│       │                                  elige otro"
│       ├── Error 400 INVALID_MEMBERSHIP → "Tu membresía ya no está activa"
│       └── Error 400 INVALID_LOCATION → "Esta dirección está fuera de cobertura"
│
└── Pantalla: Confirmación
    → "¡Tu cita fue agendada! Recibirás confirmación cuando la empresa la acepte."
    → Botón: "Ver mis citas" → flujo 4
```

---

## 4. Mis Citas

### 4.1 Listado de citas

```
Pantalla: Mis citas
│
├── Al entrar (default: citas activas)
│   └── GET /api/client/bookings?status=pending&page=1
│
├── Pestañas de filtro:
│   ├── Activas (pending + accepted + in_progress)
│   │   └── GET /api/client/bookings?status=pending  (y accepted, in_progress)
│   └── Historial (completed + cancelled)
│       └── GET /api/client/bookings?status=completed
│
└── Al tocar una cita → flujo 4.2
```

### 4.2 Detalle de cita

```
Pantalla: Detalle de cita
│
├── Al entrar
│   └── GET /api/client/bookings/:bookingId
│       → Muestra: empresa asignada (si ya confirmó), vehículo, dirección,
│         servicio, add-ons, fecha, hora, precio, estado
│
├── Si status = "pending" o "accepted"
│   ├── [Reagendar]
│   │   └── Pantalla: elegir nueva fecha/hora
│   │       └── GET /api/client/availability?date=X&vehicleSize=Y
│   │           → PUT /api/client/bookings/:id/reschedule
│   │               ├── Éxito → cita actualizada
│   │               └── Error 400 SLOT_UNAVAILABLE → "Horario no disponible"
│   │
│   └── [Cancelar]
│       └── Confirmación "¿Seguro que quieres cancelar?"
│           └── PUT /api/client/bookings/:id/cancel
│               → cita pasa a "cancelled"
│
├── Si status = "completed" y sin feedback
│   └── [Calificar servicio] → flujo 4.3
│
└── Si status = "completed" y con feedback
    └── Muestra la calificación enviada (solo lectura)
```

### 4.3 Dejar feedback

```
Pantalla: Calificar servicio
│
├── Cliente llena:
│   ├── Estrellas (1–5)
│   ├── Limpieza: excelente / buena / regular / mala
│   ├── Puntualidad: a tiempo / leve retraso / retraso
│   ├── Extras (selección múltiple): amabilidad, productos, rapidez, etc.
│   └── Comentario libre (opcional)
│
└── POST /api/client/bookings/:id/feedback
    ├── Éxito → muestra "¡Gracias por tu calificación!"
    └── Error 400 FEEDBACK_ALREADY_EXISTS → muestra el feedback previo
```

---

## 5. Membresías

### 5.1 Pantalla de paquetes (comprar membresía)

```
Pantalla: Paquetes
│
├── Al entrar
│   └── GET /api/client/catalog/packages
│       → Muestra: Básico, Completo, Premium
│         con precio, lavadas incluidas, add-ons y duraciones disponibles
│
├── Cliente toca un paquete
│   └── Pantalla: Detalle del paquete
│       → Muestra beneficios, duración y precio por tamaño de vehículo
│       → Cliente elige: duración (1 semana / 1 mes / 3 meses)
│                        tamaño de su vehículo
│
└── Cliente toca "Comprar"
    └── PASO 0: Generar ID de membresía
        └── POST /api/client/ids  body: { collection: "memberships" }  → { id, ... }
            └── Pantalla: Confirmar compra
                → Resumen: paquete, duración, tamaño, precio
                └── Confirmar
                    └── PUT /api/client/memberships/:id
                        body: { packageId, durationDays, vehicleSize }
                        ├── Éxito → "¡Membresía activada!" → flujo 5.2
                        └── Error 400 INVALID_PACKAGE → mensaje de error
```

### 5.2 Detalle de membresía activa

```
Pantalla: Mi membresía
│
├── Al entrar
│   └── GET /api/client/memberships/:membershipId
│       → Muestra: paquete, vencimiento, lavadas restantes,
│         usos restantes de cada add-on incluido
│
└── [Cancelar membresía]
    └── Confirmación
        └── DELETE /api/client/memberships/:id
            ├── Éxito → membresía cancelada
            └── Error 400 MEMBERSHIP_NOT_ACTIVE → ya estaba cancelada
```

---

## 6. Perfil y datos personales

### 6.1 Perfil principal

```
Pantalla: Perfil
│
├── Al entrar
│   └── GET /api/client/profile
│       → Muestra: nombre, email, teléfono,
│         cantidad de vehículos, direcciones y membresías
│
├── [Editar datos]
│   └── PUT /api/client/profile
│       body: { name?, phone?, email? }
│
├── [Cambiar contraseña]
│   └── PUT /api/client/profile/password
│       body: { currentPassword, newPassword }
│
├── [Mis vehículos] → flujo 6.2
├── [Mis direcciones] → flujo 6.3
└── [Cerrar sesión] → POST /api/auth/logout
```

### 6.2 Vehículos guardados

```
Pantalla: Mis vehículos
│
├── Al entrar
│   └── GET /api/client/vehicles
│
├── Al tocar un vehículo → modo edición
│   └── PUT /api/client/vehicles/:id (usa el id existente, idempotente)
│
├── [Agregar vehículo]
│   ├── POST /api/client/vehicles → { id }
│   └── Cliente llena el formulario → PUT /api/client/vehicles/:id
│
└── [Eliminar vehículo]
    └── DELETE /api/client/vehicles/:id
```

### 6.3 Direcciones guardadas

```
Pantalla: Mis direcciones
│
├── Al entrar
│   └── GET /api/client/addresses
│
├── Al tocar una dirección → modo edición
│   └── PUT /api/client/addresses/:id (idempotente)
│
├── [Agregar dirección]
│   ├── POST /api/client/addresses → { id }
│   └── Cliente llena el formulario → PUT /api/client/addresses/:id
│       Validaciones: solo Tlajomulco de Zúñiga, colonias con cobertura
│       Error 400 INVALID_LOCATION → "Esta zona no tiene cobertura"
│
└── [Eliminar dirección]
    └── DELETE /api/client/addresses/:id
```

---

## Resumen: pantallas y sus endpoints principales

| Pantalla                    | Endpoints que consume                                                            |
|-----------------------------|----------------------------------------------------------------------------------|
| Login                       | `POST /api/auth/login`, `GET /api/auth/me`                                      |
| Registro                    | `POST /api/auth/register`                                                        |
| Home                        | `GET /api/client/profile`, `GET /api/client/bookings?status=pending&limit=3`                  |
| Reserva — Vehículo          | `GET /api/client/vehicles`, (opcional) `POST + PUT /api/client/vehicles`                      |
| Reserva — Dirección         | `GET /api/client/addresses`, (opcional) `POST + PUT /api/client/addresses`                    |
| Reserva — Servicio          | `GET /api/client/catalog/services`                                                      |
| Reserva — Fecha/Hora        | `GET /api/client/availability`                                                          |
| Reserva — Confirmar         | `POST /api/client/bookings` (gen. ID), `PUT /api/client/bookings/:id`                         |
| Mis citas — Listado         | `GET /api/client/bookings`                                                              |
| Mis citas — Detalle         | `GET /api/client/bookings/:id`, `PUT .../reschedule`, `PUT .../cancel`             |
| Calificar servicio          | `POST /api/client/bookings/:id/feedback`                                                |
| Paquetes                    | `GET /api/client/catalog/packages`                                                      |
| Comprar membresía           | `POST /api/client/memberships` (gen. ID), `PUT /api/client/memberships/:id`                  |
| Detalle de membresía        | `GET /api/client/memberships/:id`, `DELETE /api/client/memberships/:id`                       |
| Perfil                      | `GET /api/client/profile`, `PUT /api/client/profile`, `PUT /api/client/profile/password`             |
| Mis vehículos               | `GET /api/client/vehicles`, `POST + PUT /api/client/vehicles`, `DELETE /api/client/vehicles/:id`     |
| Mis direcciones             | `GET /api/client/addresses`, `POST + PUT /api/client/addresses`, `DELETE /api/client/addresses/:id` |
