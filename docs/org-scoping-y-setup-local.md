# Cambios: scoping por organización + setup local

Resumen de los arreglos hechos en esta sesión.

## 1. Listado de proyectos acotado a la organización (fix multi-tenant)

**Problema.** `listProjectsForUser` (`src/lib/projects.ts`) resolvía el usuario
actual con `requireCurrentUser` pero **no usaba su `organizationId`**: la query
solo filtraba por `isNull(projects.deletedAt)`, así que devolvía proyectos de
**todas** las organizaciones. En la UI, el sidebar de un workspace listaba
también proyectos de otras orgs (fuga cross-tenant).

**Por qué no lo detectaba el test.** El caso existente en
`tests/projects.listing.test.ts` pre-filtraba la respuesta por su propio prefijo
(`test-list-`) antes de asertar, por lo que nunca comprobaba la ausencia de
proyectos ajenos. Hueco de cobertura.

**Fix.** La query ahora filtra por organización además del borrado lógico:

```ts
where: and(
  eq(projects.organizationId, currentUser.organizationId),
  isNull(projects.deletedAt)
)
```

**Test.** Nuevo caso `"excludes projects that belong to other organizations"`:
inserta una segunda organización con un proyecto y verifica que no aparece en la
respuesta del usuario de la primera. Falla sin el fix (RED), pasa con él (GREEN).

## 2. Setup local — colisión de puerto 5432

**Síntoma.** `pnpm run db:migrate` y `pnpm test` fallaban con
`role "teamspace" does not exist` (SQLSTATE 28000) pese a que el contenedor
Docker reportaba `healthy`.

**Causa.** Un PostgreSQL nativo de Homebrew escuchaba en `127.0.0.1:5432` y
`[::1]:5432`. En macOS, el bind **específico** del loopback tiene precedencia
sobre el bind **wildcard** del contenedor Docker (`*:5432`), así que
`localhost:5432` llegaba al Postgres nativo (sin el rol `teamspace`) en lugar del
contenedor. El healthcheck (`pg_isready`) daba `healthy` igual porque solo
verifica que el server responda, no que el rol exista. `drizzle-kit migrate`
ocultaba el error real tras su spinner; se ve corriendo el migrador de
`drizzle-orm/postgres-js/migrator` directamente.

**Resolución (entorno, no código).** Liberar el 5432
(`brew services stop postgresql@17`) o remapear el puerto publicado del
contenedor en `docker-compose.yml` (p. ej. `5434:5432`) y ajustar
`DATABASE_URL`. Resuelto el conflicto, el flujo del README funciona de punta a
punta: `db:migrate` → `db:seed` → `dev`.

## Verificación

- `pnpm test` → 28/28 ✓
- `pnpm run typecheck` → ✓
