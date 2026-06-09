# Spec — Manejo de planes FREE / PRO

**Fecha:** 2026-06-09
**Estado:** Aprobado (pendiente plan de implementación)

## Contexto

Teamspace maneja dos planes de facturación a nivel de organización: `FREE` y `PRO` (enum `BillingPlan` en `src/db/schema.ts`). Hoy la única diferencia es un límite de **3 proyectos activos** para FREE (`FREE_PROJECT_LIMIT` en `src/lib/projects.ts`).

### Problemas actuales

1. **Bug de enforcement**: el límite solo se chequea en `ensureProjectSlotAvailable`, que se invoca **únicamente al desarchivar** un proyecto. `createProjectForUser` **no** valida el límite, así que una organización FREE puede superar los 3 proyectos activos creándolos directamente.
2. **Sin diferenciación PRO clara**: PRO simplemente se saltea el chequeo; no hay una definición explícita de "ilimitado".
3. **Sin camino de upgrade**: no existe forma de pasar una organización de FREE a PRO desde la app.
4. **Límite hardcodeado**: el número 3 y la regla de "qué cuenta como activo" están dispersos, sin única fuente de verdad.

## Objetivos

1. Corregir el enforcement: aplicar el límite también al **crear** proyectos (además de desarchivar).
2. Definir explícitamente: **FREE = 3 proyectos activos**, **PRO = ilimitado**.
3. Camino de upgrade FREE→PRO **funcional sin pago real** (placeholder), restringido a usuarios **ADMIN**.
4. Surface en la UI: modal/alerta de upgrade, disparado de forma **proactiva** (banner al llegar a 3/3) y **reactiva** (al chocar con el 403).

### No-objetivos (YAGNI)

- Integración con pasarela de pago real (Stripe u otra). Sería un sub-proyecto aparte.
- Planes adicionales más allá de FREE/PRO.
- Límites configurables desde base de datos o panel de admin (los números viven en código).
- Límites de tareas o de usuarios por plan.
- Downgrade PRO→FREE.

## Decisiones de diseño

- **Enfoque elegido (A):** módulo de definición de planes como única fuente de verdad. Descartados: B (mantener constante dispersa → drift back/front, viola DRY) y C (tabla de planes en DB → sobre-ingeniería, YAGNI).
- **"Proyecto activo"** = `status !== ARCHIVED` **y** `deletedAt is null`. Misma semántica que el conteo actual en `ensureProjectSlotAvailable`.
- Los errores de regla de negocio reutilizan `InvalidProjectInputError` con su `statusCode` (403 para límite y para upgrade sin permiso, 400 para input inválido).

## Arquitectura

### 1. Capa de planes — `src/lib/plans.ts` (nuevo)

Única fuente de verdad de los límites:

```ts
export const PLAN_LIMITS = {
  FREE: { maxActiveProjects: 3 },
  PRO:  { maxActiveProjects: null }, // null = ilimitado
} as const;

export function getProjectLimit(plan: BillingPlan): number | null;
export function isAtProjectLimit(plan: BillingPlan, activeCount: number): boolean;
```

- `getProjectLimit` devuelve el tope o `null` (ilimitado).
- `isAtProjectLimit` devuelve `true` si el plan tiene tope y `activeCount >= tope`.

### 2. Capa de servicios — `src/lib/projects.ts` (modificado)

- **`ensureProjectSlotAvailable`**: se reescribe para leer de `plans.ts`. Cuenta proyectos activos de la organización y compara con `getProjectLimit`. Si el límite es `null` (PRO), retorna sin chequear. Lanza `InvalidProjectInputError(403)` al superar el tope.
- **`createProjectForUser`**: ahora invoca `ensureProjectSlotAvailable` **antes de insertar** (fix del bug). El desarchivado en `updateProjectStatusForUser` sigue invocándolo (sin regresión).
- **`getPlanUsageForUser(userId)`** (nuevo): devuelve `{ plan, activeProjects, limit, atLimit }` para alimentar al frontend sin que duplique la regla.

### Capa de servicios — `src/lib/organization.ts` (nuevo)

- **`upgradeOrganizationPlan(userId, targetPlan)`**:
  - Resuelve el usuario actual; valida que `role === "ADMIN"`, si no lanza `InvalidProjectInputError(403)`.
  - Solo soporta `targetPlan === "PRO"` (input inválido → 400).
  - Actualiza `organizations.plan` a PRO. Idempotente si ya es PRO.
  - Devuelve `{ id, name, plan }` de la organización.

> Nota: `upgradeOrganizationPlan` se ubica en un módulo nuevo `organization.ts` para no engrosar `projects.ts`. Reutiliza `InvalidProjectInputError` exportado desde `projects.ts`.

### 3. Capa API

**`src/app/api/organization/route.ts`** (nuevo):
- `PATCH`: body `{ plan: "PRO" }`. Resuelve `userId` igual que las otras rutas (header `x-user-id` → query `?userId=` → `DEFAULT_USER_ID`). Llama `upgradeOrganizationPlan`. Responde `{ organization: { id, name, plan } }`. Errores via `InvalidProjectInputError` (403 si no es ADMIN, 400 si plan inválido, 500 fallback).

**`src/app/api/projects/route.ts`** (modificado):
- `GET`: agrega al payload el bloque `usage: { plan, activeProjects, limit, atLimit }` (de `getPlanUsageForUser`).
- `POST` y `PATCH`: ya propagan el 403 de límite vía `InvalidProjectInputError`. Sin cambios en el manejo de errores.

### 4. Frontend — `src/app/`

- **`page.tsx`** (Server Component): obtiene `usage` (vía servicio) y calcula `canUpgrade = currentUser.role === "ADMIN"`. Pasa ambos a los componentes del sidebar.
- **Banner proactivo** en el sidebar de proyectos: cuando `plan === FREE` y `atLimit`, muestra "3 de 3 proyectos usados" + CTA "Upgrade a PRO". El formulario de crear proyecto queda deshabilitado con el CTA visible.
- **`upgrade-modal.tsx`** (nuevo, Client Component):
  - Se abre por: (a) click en el CTA del banner, o (b) reactivo — cuando un form recibe un 403 de límite al enviar.
  - **ADMIN**: botón "Upgrade a PRO" → `PATCH /api/organization` con `{ plan: "PRO" }` → al éxito `router.refresh()`.
  - **MEMBER**: texto "Pedile a un admin de tu organización que haga el upgrade", sin botón de acción.
  - Placeholder: no hay pasarela de pago; el upgrade cambia el plan directo.
- **Forms** (`create-project-form.tsx`, `project-status-actions.tsx`): al recibir respuesta 403 con el mensaje de límite, abren el modal en lugar de mostrar error genérico (distinguen por status HTTP).

## Flujo de datos

1. **Carga de página**: `page.tsx` → `getPlanUsageForUser` + `listProjectsForUser` → renderiza banner si `atLimit`.
2. **Crear proyecto en el límite**: form → `POST /api/projects` → `createProjectForUser` → `ensureProjectSlotAvailable` lanza 403 → form abre el modal.
3. **Upgrade (ADMIN)**: modal → `PATCH /api/organization` → `upgradeOrganizationPlan` → plan = PRO → `router.refresh()` → banner desaparece, creación habilitada.
4. **Upgrade (MEMBER)**: modal muestra mensaje de "pedile a un admin", sin acción.

## Manejo de errores

| Caso | Status | Origen |
|------|--------|--------|
| Crear/desarchivar superando el tope FREE | 403 | `ensureProjectSlotAvailable` |
| Upgrade por usuario no ADMIN | 403 | `upgradeOrganizationPlan` |
| Body de upgrade con plan inválido | 400 | `upgradeOrganizationPlan` |
| Fallback inesperado | 500 | route handler |

Todos los errores de negocio usan `InvalidProjectInputError` con su `statusCode`.

## Testing (Vitest, en `tests/`)

- `createProjectForUser` rechaza el 4º proyecto activo en FREE (cubre el bug arreglado).
- PRO crea proyectos sin límite.
- Desarchivar respeta el límite en FREE (no regresión).
- `upgradeOrganizationPlan`: ADMIN sube a PRO; MEMBER recibe 403; idempotente si ya es PRO; plan inválido → 400.
- `getPlanUsageForUser` reporta `atLimit` correctamente en 2/3 (false) y 3/3 (true), y siempre false en PRO.

## Archivos afectados

**Nuevos:**
- `src/lib/plans.ts`
- `src/lib/organization.ts`
- `src/app/api/organization/route.ts`
- `src/app/upgrade-modal.tsx`
- Tests nuevos en `tests/`

**Modificados:**
- `src/lib/projects.ts` (enforcement en creación, `getPlanUsageForUser`, reescritura de `ensureProjectSlotAvailable`)
- `src/app/api/projects/route.ts` (bloque `usage` en GET)
- `src/app/page.tsx` (banner + paso de `usage`/`canUpgrade`)
- `src/app/create-project-form.tsx`, `src/app/project-status-actions.tsx` (apertura del modal ante 403)
- `src/app/globals.css` (estilos de banner y modal)
