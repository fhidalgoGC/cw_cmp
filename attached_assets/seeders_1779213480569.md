# Seeders — Car Wash

> Datos mínimos para que el sistema arranque: la plataforma pueda operar, las empresas puedan iniciar sesión y configurar su perfil, y los clientes puedan usar la app.
>
> **No incluye:** vehículos, direcciones, citas, membresías, disponibilidad de empresa, paquetes/servicios activos por empresa — todo eso lo registra cada actor por su cuenta.
>
> **Convención de IDs:** todo registro recibe un UUID generado en el momento de la inserción. El campo `slug` se asigna explícitamente al sembrar. Las referencias cruzadas entre catálogos usan el UUID del registro destino.

---

## Orden de inserción recomendado

1. `users` — admin
2. `carwash_catalog_vehicle_sizes`
3. `carwash_catalog_wash_types`
4. `carwash_catalog_services`
5. `carwash_catalog_packages`
6. `carwash_catalog_zones`
7. `carwash_global_availability`
8. `users` + `carwash_companies` — empresa(s) inicial(es)

---

## 1. `users` — Admin

```json
{
  "userId": "<uuid>",
  "email": "admin@carwash.mx",
  "passwordHash": "<bcrypt de contraseña inicial>",
  "role": "admin",
  "name": "Administrador",
  "phone": "3310000000",
  "active": true,
  "createdAt": "<ISO 8601>"
}
```

---

## 2. `carwash_catalog_vehicle_sizes`

```json
[
  {
    "sizeId": "<uuid>",
    "slug": "small",
    "name": "Pequeño",
    "basePrice": 150,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "sizeId": "<uuid>",
    "slug": "suv",
    "name": "Camioneta",
    "basePrice": 200,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "sizeId": "<uuid>",
    "slug": "large",
    "name": "Grande",
    "basePrice": 250,
    "active": true,
    "createdAt": "<ISO 8601>"
  }
]
```

---

## 3. `carwash_catalog_wash_types`

Los `includedServiceIds` referencian los UUIDs generados en el paso 4.

```json
[
  {
    "washTypeId": "<uuid>",
    "slug": "basic",
    "name": "Básico",
    "additionalCost": 0,
    "includedServiceIds": ["<uuid-svc-exterior>", "<uuid-svc-aspirado>"],
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "washTypeId": "<uuid>",
    "slug": "complete",
    "name": "Completo",
    "additionalCost": 80,
    "includedServiceIds": ["<uuid-svc-exterior>", "<uuid-svc-aspirado>", "<uuid-svc-interior>", "<uuid-svc-vidrios>"],
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "washTypeId": "<uuid>",
    "slug": "premium",
    "name": "Premium",
    "additionalCost": 150,
    "includedServiceIds": ["<uuid-svc-exterior>", "<uuid-svc-aspirado>", "<uuid-svc-interior>", "<uuid-svc-vidrios>", "<uuid-svc-rines>"],
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "washTypeId": "<uuid>",
    "slug": "detail",
    "name": "Detallado",
    "additionalCost": 250,
    "includedServiceIds": ["<uuid-svc-exterior>", "<uuid-svc-aspirado>", "<uuid-svc-interior>", "<uuid-svc-vidrios>", "<uuid-svc-rines>", "<uuid-svc-motor>", "<uuid-svc-cera>"],
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "washTypeId": "<uuid>",
    "slug": "full",
    "name": "Full",
    "additionalCost": 380,
    "includedServiceIds": ["<uuid-svc-exterior>", "<uuid-svc-aspirado>", "<uuid-svc-interior>", "<uuid-svc-vidrios>", "<uuid-svc-rines>", "<uuid-svc-motor>", "<uuid-svc-cera>", "<uuid-svc-tapiceria>"],
    "active": true,
    "createdAt": "<ISO 8601>"
  }
]
```

---

## 4. `carwash_catalog_services`

```json
[
  {
    "serviceId": "<uuid-svc-exterior>",
    "slug": "exterior",
    "name": "Lavado Exterior",
    "extraPrice": 0,
    "includedIn": ["basic","complete","premium","detail","full"],
    "estimatedMinMin": 15,
    "estimatedMinMax": 20,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-aspirado>",
    "slug": "aspirado",
    "name": "Aspirado",
    "extraPrice": 0,
    "includedIn": ["basic","complete","premium","detail","full"],
    "estimatedMinMin": 10,
    "estimatedMinMax": 15,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-interior>",
    "slug": "interior",
    "name": "Interior Completo",
    "extraPrice": 100,
    "includedIn": ["complete","premium","detail","full"],
    "estimatedMinMin": 15,
    "estimatedMinMax": 25,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-vidrios>",
    "slug": "vidrios",
    "name": "Limpieza de Vidrios",
    "extraPrice": 0,
    "includedIn": ["complete","premium","detail","full"],
    "estimatedMinMin": 5,
    "estimatedMinMax": 10,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-rines>",
    "slug": "rines",
    "name": "Detallado de Rines",
    "extraPrice": 50,
    "includedIn": ["premium","detail","full"],
    "estimatedMinMin": 10,
    "estimatedMinMax": 15,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-motor>",
    "slug": "motor",
    "name": "Lavado de Motor",
    "extraPrice": 70,
    "includedIn": ["detail","full"],
    "estimatedMinMin": 15,
    "estimatedMinMax": 20,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-cera>",
    "slug": "cera",
    "name": "Encerado Premium",
    "extraPrice": 80,
    "includedIn": ["detail","full"],
    "estimatedMinMin": 15,
    "estimatedMinMax": 25,
    "active": true,
    "createdAt": "<ISO 8601>"
  },
  {
    "serviceId": "<uuid-svc-tapiceria>",
    "slug": "tapiceria",
    "name": "Limpieza de Tapicería",
    "extraPrice": 120,
    "includedIn": ["full"],
    "estimatedMinMin": 20,
    "estimatedMinMax": 30,
    "active": true,
    "createdAt": "<ISO 8601>"
  }
]
```

> `includedIn` usa los slugs del tipo de lavado como referencia legible. El backend resuelve el UUID del tipo de lavado al momento de consultar.

---

## 5. `carwash_catalog_packages`

Los `addOnsIncluded` referencian los UUIDs generados en el paso 4.

### Básico — `#3B82F6`

```json
{
  "packageId": "<uuid>",
  "slug": "basico",
  "name": "Básico",
  "color": "#3B82F6",
  "washType": "<uuid-wt-basic>",
  "popular": false,
  "addOnsIncluded": [],
  "benefits": [
    "Lavado exterior",
    "Aspirado interior",
    "Prioridad en citas"
  ],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 269,  "suv": 359,  "large": 449  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 479,  "suv": 639,  "large": 799  } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 1249, "suv": 1679, "large": 2099 } }
  ],
  "active": true,
  "createdAt": "<ISO 8601>"
}
```

### Completo — `#8B5CF6` — *Popular*

```json
{
  "packageId": "<uuid>",
  "slug": "completo",
  "name": "Completo",
  "color": "#8B5CF6",
  "washType": "<uuid-wt-complete>",
  "popular": true,
  "addOnsIncluded": [
    { "serviceId": "<uuid-svc-interior>", "slug": "interior", "maxUses": 2 }
  ],
  "benefits": [
    "Lavado exterior",
    "Interior completo",
    "Limpieza de vidrios",
    "Aspirado interior"
  ],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 409,  "suv": 499,  "large": 589  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 729,  "suv": 899,  "large": 1049 } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 1929, "suv": 2349, "large": 2769 } }
  ],
  "active": true,
  "createdAt": "<ISO 8601>"
}
```

### Premium — `#F59E0B`

```json
{
  "packageId": "<uuid>",
  "slug": "premium",
  "name": "Premium",
  "color": "#F59E0B",
  "washType": "<uuid-wt-premium>",
  "popular": false,
  "addOnsIncluded": [
    { "serviceId": "<uuid-svc-interior>", "slug": "interior", "maxUses": 4 },
    { "serviceId": "<uuid-svc-rines>",    "slug": "rines",    "maxUses": 4 },
    { "serviceId": "<uuid-svc-cera>",     "slug": "cera",     "maxUses": 2 }
  ],
  "benefits": [
    "Lavado exterior",
    "Interior completo",
    "Detallado de rines",
    "Encerado premium",
    "Limpieza de vidrios"
  ],
  "durations": [
    { "days": 7,  "label": "1 semana", "washesIncluded": 2,  "prices": { "small": 539,  "suv": 629,  "large": 719  } },
    { "days": 30, "label": "1 mes",    "washesIncluded": 4,  "prices": { "small": 959,  "suv": 1119, "large": 1279 } },
    { "days": 90, "label": "3 meses",  "washesIncluded": 12, "prices": { "small": 2499, "suv": 2929, "large": 3359 } }
  ],
  "active": true,
  "createdAt": "<ISO 8601>"
}
```

---

## 6. `carwash_catalog_zones`

```json
{
  "zoneId": "<uuid>",
  "slug": "tlajomulco-jalisco",
  "state": "Jalisco",
  "city": "Tlajomulco de Zúñiga",
  "colonias": [
    "Villa California",
    "Casa Fuerte",
    "Adamar"
  ],
  "active": true,
  "createdAt": "<ISO 8601>"
}
```

> La plataforma puede agregar más colonias con `PUT /api/platform/catalog/zones` sin tocar código.

---

## 7. `carwash_global_availability`

Un solo ítem (`configId = "global"`). Define los slots horarios que existen en el sistema.

```json
{
  "configId": "global",
  "slots": [
    { "time": "08:00 AM", "enabled": true },
    { "time": "09:00 AM", "enabled": true },
    { "time": "10:00 AM", "enabled": true },
    { "time": "11:00 AM", "enabled": true },
    { "time": "12:00 PM", "enabled": true },
    { "time": "01:00 PM", "enabled": true },
    { "time": "02:00 PM", "enabled": true },
    { "time": "03:00 PM", "enabled": true },
    { "time": "04:00 PM", "enabled": true },
    { "time": "05:00 PM", "enabled": true }
  ],
  "blockedDates": [],
  "updatedAt": "<ISO 8601>"
}
```

---

## 8. `users` + `carwash_companies` — Empresa inicial

La plataforma registra empresas con `POST /api/platform/companies`. A continuación el estado inicial de los dos registros que se crean:

### `users`

```json
{
  "userId": "<uuid>",
  "email": "empresa1@carwash.mx",
  "passwordHash": "<bcrypt de contraseña inicial>",
  "role": "company",
  "name": "Empresa 1",
  "phone": "3310000001",
  "active": true,
  "companyId": "<uuid-company>",
  "createdAt": "<ISO 8601>"
}
```

### `carwash_companies`

```json
{
  "companyId": "<uuid-company>",
  "name": "Empresa 1",
  "email": "empresa1@carwash.mx",
  "phone": "3310000001",
  "active": true,
  "rating": 0,
  "totalBookings": 0,
  "completedBookings": 0,
  "createdAt": "<ISO 8601>"
}
```

> Después de que la plataforma la registre, la empresa inicia sesión y configura:
> - Sus horarios disponibles → `PUT /api/company/availability`
> - Los paquetes que trabaja → `PUT /api/company/packages`
> - Los servicios que ofrece → `PUT /api/company/services`

---

## Resumen de tablas sembradas

| Tabla                           | Registros semilla              |
|---------------------------------|-------------------------------|
| `users`                 | 1 admin + 1 empresa            |
| `carwash_companies`             | 1 empresa                      |
| `carwash_catalog_vehicle_sizes` | 3 (small, suv, large)          |
| `carwash_catalog_wash_types`    | 5 (basic → full)               |
| `carwash_catalog_services`      | 8 (exterior → tapiceria)       |
| `carwash_catalog_packages`      | 3 (basico, completo, premium)  |
| `carwash_catalog_zones`         | 1 zona, 3 colonias             |
| `carwash_global_availability`   | 1 config global, 10 slots      |
