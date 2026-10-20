# Exhibition Vendor Management Portal

Modular monolith for vendor onboarding, versioned forms, field-level corrections, approvals, and a private document archive. The Next.js app and the NestJS API are separate processes. The browser never receives database, storage, or email credentials.

## Requirements

- Node.js 22+
- Docker, for PostgreSQL, Redis, and Mailpit

## Install

From the repository root on Windows:

```powershell
npm run setup
```

That copies `.env.example` to `.env` and `apps/api/.env`, starts Postgres (host port **5433**), Redis, and Mailpit, installs dependencies, applies the Prisma migration, applies row-level security grants, and seeds the development organization.

Equivalent commands:

```powershell
docker compose up -d postgres redis mailpit
npm install
npm run build -w @vmp/shared
npm run prisma:generate -w @vmp/api
npm run db:migrate
```

Grants must run as the database owner. `prisma db execute` accepts either `--url` or `--schema`, not both:

```powershell
npx --prefix apps/api prisma db execute --url "postgresql://postgres:postgres@localhost:5433/vendor_portal" --file apps/api/prisma/sql/grants.sql
npm run db:seed
```

## Run

```powershell
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- OpenAPI: http://localhost:3001/api/docs
- Mailpit: http://localhost:8025

The web app proxies `/api/v1` to `API_PROXY_URL` so the session cookie stays on the web origin. `WEB_ORIGIN` must match the browser origin, including the port.

Development accounts (seed refuses to run when `NODE_ENV=production`):

| Email | Password | Role |
| --- | --- | --- |
| admin@harbor.example | ChangeMe!Admin1 | Organization admin |
| reviewer@harbor.example | ChangeMe!Review1 | Reviewer |

Railway storage (endpoint, region, bucket, access key, and secret) is saved in Admin > Settings. On Railway, `ENDPOINT`, `REGION`, `BUCKET`, `ACCESS_KEY_ID`, and `SECRET_ACCESS_KEY` are copied into those settings when the API starts. This machine keeps files on disk until those values are present.

For a separate worker, set `JOBS_MODE=queue` and `PROCESS_ROLE=worker`, then run `npm run dev:worker`. `JOBS_MODE=inline` processes the outbox inside the API.

## Test

```powershell
npm test
npm run test:e2e -w @vmp/api
npm run typecheck
```

The workflow test covers form publish, invitation acceptance, submission, locked-field rejection, resubmission, approval, a single approval email after retry, cross-vendor denial, and a tenant-less query returning no vendor rows.

## Build

```powershell
npm run build
```

Docker Compose profile `full` builds the API, worker, and web images. It is not part of the default `docker compose up`.
