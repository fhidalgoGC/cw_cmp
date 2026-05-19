# Flujo de la Plataforma (Super Admin) — Car Wash

> Describe pantalla por pantalla qué hace el operador de la plataforma, qué decisiones toma y qué endpoints consume en cada paso.
>
> **Actor:** operador de la plataforma. Registra y activa empresas, supervisa toda la operación, define los catálogos (paquetes y servicios) y consulta reportes globales. No realiza lavados ni interactúa con los clientes directamente.
>
> **Prefijo de endpoints:** `/api/admin`

---

## Índice

1. [Login](#1-login)
2. [Dashboard global](#2-dashboard-global)
3. [Gestión de empresas](#3-gestión-de-empresas)
4. [Supervisión de citas](#4-supervisión-de-citas)
5. [Gestión de clientes](#5-gestión-de-clientes)
6. [Catálogos](#6-catálogos)
7. [Reportes](#7-reportes)

---

## 1. Login

```
Pantalla: Login
│
├── Operador ingresa email + contraseña
│   └── POST /api/auth/login
│       ├── Éxito: role === "admin" → navega al Dashboard global
│       └── Error 401 → "Credenciales incorrectas"
│
└── Si ya hay token guardado
    └── GET /api/auth/me
        ├── Éxito → Dashboard global
        └── Error 401 → borra token → pantalla de Login
```

---

## 2. Dashboard Global

Vista de alto nivel de todo el negocio: cuántas empresas están activas, cuántos clientes registrados, citas del día y un resumen de ingresos recientes.

```
Pantalla: Dashboard
│
├── Al entrar, carga en paralelo:
│   ├── GET /api/platform/agenda?date=HOY
│   │   → Resumen de citas de hoy:
│   │     total / pendientes / en curso / completadas / canceladas
│   │
│   ├── GET /api/platform/companies?active=true
│   │   → Número de empresas activas
│   │
│   ├── GET /api/platform/clients?limit=1
│   │   → Total de clientes registrados (via pagination.total)
│   │
│   └── GET /api/platform/reports/revenue?period=month
│       → Ingresos del mes actual (resumen rápido)
│
├── Sección "Citas de hoy"
│   → Lista breve de citas del día con estado
│   → "Ver todas" → flujo 4
│
├── Sección "Empresas activas"
│   → Número total + botón "Gestionar empresas" → flujo 3
│
└── Sección "Alertas"
    → Citas con companyStatus = "rejected_by_company" sin reasignar
    → Empresas inactivas con citas asignadas
    (requiere GET /api/platform/bookings?companyStatus=rejected_by_company)
```

---

## 3. Gestión de Empresas

La plataforma tiene control total sobre las empresas: las registra, las activa o desactiva, y puede ver y editar sus horarios.

### 3.1 Listado de empresas

```
Pantalla: Empresas
│
├── Al entrar
│   └── GET /api/platform/companies
│       → Lista: nombre, estado, citas completadas, rating
│
├── Filtros: activas / inactivas / búsqueda por nombre
│   └── GET /api/platform/companies?active=true&search=...
│
├── Botón "Registrar empresa" → flujo 3.2
│
└── Toca una empresa → flujo 3.3
```

### 3.2 Registrar empresa nueva

```
Pantalla: Nueva empresa
│
├── PASO 0 — Generar ID de empresa
│   └── POST /api/platform/companies  (alias de POST /api/platform/ids { collection: Collection.COMPANIES })
│       → { id: "company-xyz", collection: Collection.COMPANIES, action: "create", ... }
│           (se guarda localmente para el PUT final)
│
├── Operador llena: nombre, email, teléfono, contraseña inicial
│
└── Confirmar
    └── PUT /api/platform/companies/:id
        body: { name, email, phone, password }
        ├── Éxito → empresa creada en estado activo
        │           Se le entregan las credenciales a la empresa para que inicie sesión
        │           → navega al detalle de la empresa (flujo 3.3)
        └── Error 400 EMAIL_ALREADY_EXISTS → "Este email ya está en uso"

La empresa puede iniciar sesión de inmediato con role: "company"
```

### 3.3 Detalle de empresa

```
Pantalla: Detalle de empresa
│
├── Al entrar
│   └── GET /api/platform/companies/:companyId
│       → Muestra: datos de contacto, estado (activa/inactiva),
│         rating promedio, citas completadas vs rechazadas,
│         horarios configurados, citas recientes
│
├── [Editar datos]
│   └── PUT /api/platform/companies/:companyId
│       body: { name?, email?, phone?, active? }
│
├── [Activar empresa]  (si está inactiva)
│   └── PUT /api/platform/companies/:companyId  { active: true }
│       → La empresa vuelve a recibir asignaciones de citas
│
├── [Desactivar empresa]  (si está activa)
│   └── PUT /api/platform/companies/:companyId  { active: false }
│       → La empresa deja de recibir nuevas citas
│         Las citas ya asignadas siguen activas
│
├── [Ver / editar horarios de la empresa]
│   ├── GET /api/platform/companies/:companyId/availability
│   │   → Muestra qué slots tiene activos y fechas bloqueadas
│   └── PUT /api/platform/companies/:companyId/availability
│       → La plataforma puede ajustar horarios de cualquier empresa
│
└── [Ver citas de esta empresa]
    └── GET /api/platform/bookings?companyId=:companyId → flujo 4 con filtro
```

---

## 4. Supervisión de Citas

La plataforma puede ver todas las citas del sistema: por empresa, por cliente, por fecha y por estado. También puede intervenir manualmente: reasignar, cancelar o cambiar el estado de cualquier cita.

### 4.1 Listado de citas

```
Pantalla: Citas
│
├── Al entrar (default: citas de hoy, todos los estados)
│   └── GET /api/platform/bookings?date=HOY&page=1
│
├── Filtros disponibles:
│   ├── Por estado (pending / accepted / in_progress / completed / cancelled)
│   ├── Por fecha o rango de fechas
│   ├── Por empresa (companyId)
│   ├── Por estado de asignación (companyStatus)
│   ├── Por cliente (userId)
│   └── Búsqueda libre (nombre de cliente o placa)
│   └── GET /api/platform/bookings?status=X&dateFrom=Y&companyId=Z&search=...
│
└── Toca una cita → flujo 4.2
```

### 4.2 Detalle de cita (intervención manual)

```
Pantalla: Detalle de cita
│
├── Al entrar
│   └── GET /api/platform/bookings/:bookingId
│       → Muestra datos completos del cliente, vehículo, dirección,
│         empresa asignada, estado de asignación (companyStatus),
│         historial de asignaciones (attemptCount)
│
├── Acciones de intervención según estado:
│   │
│   ├── [Reasignar empresa]  (cuando companyStatus = "rejected_by_company")
│   │   └── PUT /api/platform/bookings/:id/reassign
│   │       → Sin body: el sistema elige la siguiente empresa disponible
│   │       → Con body { companyId }: asigna a una empresa específica
│   │
│   ├── [Aceptar cita]  (cuando empresa ya confirmó, falta confirmación plataforma)
│   │   └── PUT /api/platform/bookings/:id/accept
│   │
│   ├── [Marcar en curso]
│   │   └── PUT /api/platform/bookings/:id/start
│   │
│   ├── [Marcar completada]
│   │   └── PUT /api/platform/bookings/:id/complete
│   │
│   └── [Cancelar]
│       └── PUT /api/platform/bookings/:id/cancel  (pide razón opcional)
│
└── Enlace al perfil del cliente → flujo 5.2
```

### 4.3 Agenda del día

```
Pantalla: Agenda del día
│
├── Al entrar
│   └── GET /api/platform/agenda?date=YYYY-MM-DD
│       → Citas ordenadas por hora con empresa asignada y estado de asignación
│
├── Acciones rápidas por cita (mismo set que en detalle)
│
├── [Bloquear este día]
│   └── POST /api/platform/availability/block  { dates: ["YYYY-MM-DD"] }
│
└── Navegar a otro día con flechas o selector de fecha
```

---

## 5. Gestión de Clientes

La plataforma puede ver el listado completo de clientes registrados y su historial, pero no puede editarlos (eso lo hace el cliente desde su app).

### 5.1 Listado de clientes

```
Pantalla: Clientes
│
├── Al entrar
│   └── GET /api/platform/clients
│       → Lista: nombre, teléfono, email, total citas,
│         membresías activas, dinero gastado
│
├── Búsqueda por nombre, email o teléfono
│   └── GET /api/platform/clients?search=...
│
└── Toca un cliente → flujo 5.2
```

### 5.2 Perfil de cliente

```
Pantalla: Perfil de cliente
│
├── Al entrar
│   └── GET /api/platform/clients/:userId
│       → Muestra: datos personales, estadísticas, vehículos, direcciones,
│         membresías y citas recientes
│
├── [Ver historial completo de citas]
│   └── GET /api/platform/clients/:userId/bookings?page=N
│
└── [Ver membresías]
    └── GET /api/platform/clients/:userId/memberships
```

---

## 6. Catálogos

La plataforma es la única que puede crear y editar los catálogos del sistema. Las empresas solo pueden elegir cuáles trabajar, y los clientes solo pueden verlos.

### 6.1 Paquetes / Membresías

```
Pantalla: Catálogo — Paquetes
│
├── Al entrar
│   └── GET /api/platform/catalog/packages
│       → Lista paquetes activos e inactivos: Básico, Completo, Premium
│
└── [Editar paquete]
    └── PUT /api/platform/catalog/packages/:packageId
        Puede cambiar: nombre, descripción, color, si es popular,
        activo/inactivo, beneficios, add-ons incluidos,
        precios por duración (1 semana / 1 mes / 3 meses) y tamaño de vehículo
```

### 6.2 Servicios y Precios

```
Pantalla: Catálogo — Servicios
│
├── Al entrar
│   └── GET /api/platform/catalog/services
│       → Muestra: precios base por tamaño, precios por tipo de lavado,
│                  add-ons con precio y estado
│
├── [Editar precios por tamaño de vehículo]
│   └── PUT /api/platform/catalog/services/vehicle-prices
│       body: { prices: { small: 150, suv: 200, large: 250 } }
│
├── [Editar precios por tipo de lavado]
│   └── PUT /api/platform/catalog/services/wash-type-prices
│       body: { prices: { basic: 0, complete: 80, premium: 150, ... } }
│
└── [Editar add-on individual]
    └── PUT /api/platform/catalog/services/:serviceId
        Puede cambiar: nombre, precio, tiempo estimado, activo/inactivo
```

### 6.3 Zonas de Cobertura

```
Pantalla: Catálogo — Zonas
│
├── Al entrar
│   └── GET /api/platform/catalog/zones
│       → Muestra colonias, ciudades y estados con cobertura
│
└── [Agregar o quitar zona]
    └── PUT /api/platform/catalog/zones
        body: { states?, cities?, colonies? }
        Nota: quitar una colonia no cancela citas existentes en esa zona
```

### 6.4 Horarios Globales

```
Pantalla: Catálogo — Horarios globales
│
├── Al entrar
│   └── GET /api/platform/availability
│       → Muestra qué horarios existen y cuántas empresas hay en cada uno
│
├── [Activar / desactivar slot global]
│   └── PUT /api/platform/availability
│       → Desactivar un slot lo oculta a todos los clientes,
│         aunque haya empresas disponibles en él
│
├── [Bloquear fechas completas]  (días festivos, mantenimiento)
│   └── POST /api/platform/availability/block
│       body: { dates: ["YYYY-MM-DD", ...], reason?: string }
│
└── [Desbloquear fechas]
    └── DELETE /api/platform/availability/block
        body: { dates: ["YYYY-MM-DD", ...] }
```

---

## 7. Reportes

Vista financiera y operativa de todo el negocio.

### 7.1 Ingresos

```
Pantalla: Reportes — Ingresos
│
├── Default: mes actual
│   └── GET /api/platform/reports/revenue?period=month
│       → Total de ingresos, ingresos por membresías vs citas individuales,
│         ticket promedio, gráfica diaria
│
└── Filtros de período:
    ├── Hoy         → GET ...?period=day&date=YYYY-MM-DD
    ├── Esta semana → GET ...?period=week
    ├── Este mes    → GET ...?period=month
    └── Rango       → GET ...?period=custom&dateFrom=X&dateTo=Y
```

### 7.2 Citas

```
Pantalla: Reportes — Citas
│
└── GET /api/platform/reports/bookings?dateFrom=X&dateTo=Y
    → Total de citas, desglose por estado,
      tasa de cancelación y completado, gráfica por día
```

### 7.3 Servicios más solicitados

```
Pantalla: Reportes — Servicios
│
└── GET /api/platform/reports/services?dateFrom=X&dateTo=Y
    → Tipos de lavado más pedidos (con %), add-ons más usados,
      distribución por tamaño de vehículo
```

### 7.4 Membresías

```
Pantalla: Reportes — Membresías
│
└── GET /api/platform/reports/memberships?dateFrom=X&dateTo=Y
    → Membresías vendidas, ingresos generados, activas actualmente,
      desglose por paquete y por duración
```

---

## Resumen: pantallas y sus endpoints principales

| Pantalla                       | Endpoints que consume                                                                    |
|--------------------------------|------------------------------------------------------------------------------------------|
| Login                          | `POST /api/auth/login`, `GET /api/auth/me`                                              |
| Dashboard global               | `GET /api/platform/agenda`, `GET /api/platform/companies`, `GET /api/platform/reports/revenue`, `GET /api/platform/bookings?companyStatus=rejected_by_company` |
| Empresas — Listado             | `GET /api/platform/companies`                                                               |
| Empresas — Registrar           | `POST /api/platform/companies` (paso 1), `PUT /api/platform/companies/:id` (paso 2)        |
| Empresas — Detalle             | `GET /api/platform/companies/:id`, `PUT /api/platform/companies/:id`, `GET/PUT .../availability` |
| Citas — Listado                | `GET /api/platform/bookings` (con filtros)                                                  |
| Citas — Detalle / intervención | `GET /api/platform/bookings/:id`, acciones (accept/reassign/start/complete/cancel)          |
| Agenda del día                 | `GET /api/platform/agenda`, `POST /api/platform/availability/block`                           |
| Clientes — Listado             | `GET /api/platform/clients`                                                                 |
| Clientes — Perfil              | `GET /api/platform/clients/:id`, `GET .../bookings`, `GET .../memberships`                 |
| Catálogo — Paquetes            | `GET /api/platform/catalog/packages`, `PUT /api/platform/catalog/packages/:id`                |
| Catálogo — Servicios           | `GET /api/platform/catalog/services`, `PUT` de precios y servicios                         |
| Catálogo — Zonas               | `GET /api/platform/catalog/zones`, `PUT /api/platform/catalog/zones`                          |
| Catálogo — Horarios globales   | `GET/PUT /api/platform/availability`, `POST/DELETE /api/platform/availability/block`          |
| Reportes — Ingresos            | `GET /api/platform/reports/revenue`                                                         |
| Reportes — Citas               | `GET /api/platform/reports/bookings`                                                        |
| Reportes — Servicios           | `GET /api/platform/reports/services`                                                        |
| Reportes — Membresías          | `GET /api/platform/reports/memberships`                                                     |
