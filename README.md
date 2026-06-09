# Teamspace

Aplicación compacta de gestión de proyectos construida con Next.js, TypeScript, Drizzle y Postgres.

## Stack

- Next.js App Router
- TypeScript
- Drizzle
- Postgres via Docker Compose
- Vitest
- pnpm

## Setup local

Requisitos:

- Node.js 22
- Docker Desktop instalado y abierto
- pnpm 10

Si no tenés pnpm:

```bash
corepack enable
corepack prepare pnpm@10.22.0 --activate
```

Con Docker Desktop abierto, corré:

```bash
cp .env.example .env
pnpm install
docker compose up -d --wait
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Si `docker compose` falla con un error de conexión al daemon, abrí Docker Desktop, esperá a que termine de iniciar y volvé a correr el comando.

Comandos útiles:

```bash
pnpm run typecheck
pnpm test
```

## Contribuir

Mantené los cambios acotados, corré los checks relevantes y revisá tu propio diff antes de abrir una PR.
