# Reglas de Negocio — Car Wash Tlajomulco

> Documento de referencia. No duplica lo que está en los planes de API ni en los flujos de pantalla.  
> Cubre: contexto, zonas de servicio, datos semilla del catálogo (tal como la plataforma los configura), reglas de cálculo y reglas de membresía.
>
> **Principio clave:** Ningún precio, paquete, servicio, horario ni zona está hardcodeado en el cliente. Todo se obtiene de la API.

---

## 1. Contexto

Servicio de lavado de autos **a domicilio** en Tlajomulco de Zúñiga, Jalisco.  
Tres actores:

| Actor | Rol |
|-------|-----|
| **Cliente** | Agenda citas desde la app móvil |
| **Empresa** | Presta el servicio; acepta/rechaza citas asignadas |
| **Plataforma** | Registra empresas, gestiona el catálogo y supervisa la operación |

El sistema asigna cada cita a una empresa automáticamente. El cliente nunca elige empresa.

---

## 2. Zonas de Servicio

La plataforma define las zonas habilitadas. El cliente solo puede registrar direcciones en colonias activas.

**Datos semilla iniciales:**

| Campo   | Valores                                      |
|---------|----------------------------------------------|
| Estado  | Jalisco                                      |
| Ciudad  | Tlajomulco de Zúñiga                         |
| Colonias | Villa California, Casa Fuerte, Adamar       |

La app consulta las zonas en `GET /api/client/catalog/zones` al registrar una dirección.

---

## 3. Catálogo de Servicios

Todo el catálogo lo gestiona la plataforma. El cliente lo consulta en `GET /api/client/catalog`. La empresa indica qué paquetes y servicios trabaja en `PUT /api/company/packages` y `PUT /api/company/services`.

### 3.1 Tamaños de vehículo y precio base

| Tamaño     | Código  | Precio base (MXN) |
|------------|---------|-------------------|
| Pequeño    | `small` | $150              |
| Camioneta  | `suv`   | $200              |
| Grande     | `large` | $250              |

### 3.2 Tipos de lavado

| Tipo      | Código     | Costo adicional |
|-----------|------------|-----------------|
| Básico    | `basic`    | +$0             |
| Completo  | `complete` | +$80            |
| Premium   | `premium`  | +$150           |
| Detallado | `detail`   | +$250           |
| Full      | `full`     | +$380           |

### 3.3 Servicios individuales (add-ons)

| Servicio              | ID          | Precio extra | Incluido en                              | Tiempo est.   |
|-----------------------|-------------|--------------|------------------------------------------|---------------|
| Lavado Exterior       | `exterior`  | $0           | basic, complete, premium, detail, full   | 15–20 min     |
| Aspirado              | `aspirado`  | $0           | basic, complete, premium, detail, full   | 10–15 min     |
| Interior Completo     | `interior`  | $100         | complete, premium, detail, full          | 15–25 min     |
| Limpieza de Vidrios   | `vidrios`   | $0           | complete, premium, detail, full          | 5–10 min      |
| Detallado de Rines    | `rines`     | $50          | premium, detail, full                    | 10–15 min     |
| Lavado de Motor       | `motor`     | $70          | detail, full                             | 15–20 min     |
| Encerado Premium      | `cera`      | $80          | detail, full                             | 15–25 min     |
| Limpieza de Tapicería | `tapiceria` | $120         | full                                     | 20–30 min     |

### 3.4 Fórmula de precio total

```
Total = Precio base (tamaño) + Costo del tipo de lavado + Suma de add-ons no incluidos
```

> Ejemplo: Camioneta (`$200`) + Completo (`+$80`) + Rines add-on (`+$50`) = **$330**

### 3.5 Tiempo estimado

Suma de los rangos min–max de cada servicio incluido y cada add-on. Se muestra al cliente como rango, ej: "25–40 min".

---

## 4. Paquetes / Membresías

La plataforma define los paquetes. El cliente los consulta en `GET /api/client/catalog/packages`. Al comprar, se activa una membresía vinculada a un tamaño de vehículo específico.

### 4.1 Paquetes semilla

#### Básico (`basico`) — color `#3B82F6`
- Lavado tipo: `basic`
- Add-ons incluidos: ninguno
- Beneficios UI: Lavado exterior, Aspirado interior, Prioridad en citas

| Duración | Lavadas | Precio `small` | Precio `suv` | Precio `large` |
|----------|---------|----------------|--------------|----------------|
| 1 Semana | 2       | $269           | $359         | $449           |
| 1 Mes    | 4       | $479           | $639         | $799           |
| 3 Meses  | 12      | $1,249         | $1,679       | $2,099         |

#### Completo (`completo`) — color `#8B5CF6` — *Popular*
- Lavado tipo: `complete`
- Add-ons incluidos: `interior` (2 usos)
- Beneficios UI: Lavado exterior, Interior completo, Limpieza de vidrios, Aspirado interior

| Duración | Lavadas | Precio `small` | Precio `suv` | Precio `large` |
|----------|---------|----------------|--------------|----------------|
| 1 Semana | 2       | $409           | $499         | $589           |
| 1 Mes    | 4       | $729           | $899         | $1,049         |
| 3 Meses  | 12      | $1,929         | $2,349       | $2,769         |

#### Premium (`premium`) — color `#F59E0B`
- Lavado tipo: `premium`
- Add-ons incluidos: `interior` (4 usos), `rines` (4 usos), `cera` (2 usos)
- Beneficios UI: Lavado exterior, Interior completo, Detallado de rines, Encerado premium, Limpieza de vidrios

| Duración | Lavadas | Precio `small` | Precio `suv` | Precio `large` |
|----------|---------|----------------|--------------|----------------|
| 1 Semana | 2       | $539           | $629         | $719           |
| 1 Mes    | 4       | $959           | $1,119       | $1,279         |
| 3 Meses  | 12      | $2,499         | $2,929       | $3,359         |

### 4.2 Reglas de membresía

- Una membresía es válida si: `expirationDate > ahora` **Y** `washesRemaining > 0`.
- Es específica para un tamaño de vehículo — no es intercambiable.
- Al usar una lavada: `washesRemaining` baja en 1.
- Al usar un add-on incluido: `addOnUsage[addOnId]` baja en 1.
- Un cliente puede tener varias membresías activas simultáneas.
- Si una membresía se usa para una cita, el precio de la cita es `$0`.

---

## 5. Disponibilidad y Asignación de Empresas

- La plataforma define los horarios globales disponibles.
- Cada empresa activa los horarios en los que opera (`PUT /api/company/availability`).
- El `spotsLeft` que ve el cliente al agendar = número de empresas que tienen ese horario habilitado.
- Al crear una cita, el sistema elige automáticamente una empresa disponible en ese slot, que trabaje el paquete o servicio solicitado.
- Si la empresa rechaza: el sistema busca otra empresa disponible. Si no hay ninguna, cancela la cita.

---

## 6. Estado de una Cita

| `status`      | `companyStatus`           | Significado                                 |
|---------------|---------------------------|---------------------------------------------|
| `pending`     | `pending_acceptance`      | Recién creada, esperando que empresa acepte |
| `accepted`    | `accepted_by_company`     | Empresa aceptó, cita confirmada             |
| `in_progress` | `accepted_by_company`     | Servicio en curso                           |
| `completed`   | `accepted_by_company`     | Servicio finalizado                         |
| `cancelled`   | —                         | Cancelada por el cliente, empresa o sistema |

> La empresa solo puede cancelar rechazando **antes** de aceptar. Una vez aceptada, solo la plataforma puede cancelar.

---

## 7. Feedback

Disponible para citas en estado `completed`, una sola vez.

| Campo               | Opciones                                                                   |
|---------------------|----------------------------------------------------------------------------|
| Calificación general| 1–5 estrellas                                                              |
| Limpieza            | Excelente / Buena / Regular / Mala                                         |
| Puntualidad         | A tiempo / Leve retraso / Con retraso                                      |
| Aspectos positivos  | Amabilidad, Buenos productos, Rapidez, Trabajo detallado, Lo recomendaría |
| Comentario libre    | Texto abierto                                                              |

---

## 8. Glosario

| Término          | Significado                                                               |
|------------------|---------------------------------------------------------------------------|
| Booking / Cita   | Reserva de servicio de lavado                                             |
| Membresía        | Paquete activo con lavadas prepagadas                                     |
| WashType         | Tipo de lavado: basic / complete / premium / detail / full                |
| VehicleSize      | Tamaño: small / suv / large                                               |
| AddOn            | Servicio extra no incluido en el tipo de lavado elegido                   |
| washesRemaining  | Lavadas restantes en una membresía                                        |
| addOnUsage       | Usos restantes de add-ons incluidos en una membresía                      |
| companyStatus    | Estado de la asignación de empresa a la cita                              |
| spotsLeft        | Número de empresas disponibles en un horario dado                         |
