# Operations

## Environments

Use a distinct `.env` for development, staging, and production. Production must set `NODE_ENV=production`, `COOKIE_SECURE=true`, `ENABLE_SWAGGER=false`, a unique `APP_ENCRYPTION_KEY`, and real SMTP, Redis, and storage endpoints. Do not run the seed in production.

## Health

- `GET /api/v1/health` reports process liveness.
- `GET /api/v1/health/ready` checks the database.

## Email

Mailpit receives development mail on port 1025. A provider can post delivery evidence to `POST /api/v1/email/provider-events` with header `x-email-webhook-secret`.

Failed outbox rows are listed under Jobs. Retry is idempotent: the email message uses a unique idempotency key, so a second attempt does not insert another approval email.

## Backup and restore

Postgres data lives in the `vmp_pgdata` volume. Example backup from the host:

```powershell
docker compose exec -T postgres pg_dump -U postgres -d vendor_portal -Fc > vendor_portal.dump
```

Restore into an empty database:

```powershell
docker compose exec -T postgres pg_restore -U postgres -d vendor_portal --clean --if-exists < vendor_portal.dump
```

After restore, re-apply `apps/api/prisma/sql/grants.sql` as the owner so row-level security and the `app_user` grants match the schema. Object storage is separate from the database dump. Back up the bucket or the `STORAGE_LOCAL_DIR` tree with the same retention policy as the database. This restore procedure has not been executed in the current environment.

Encrypt backup files at rest and restrict who can read them. The dump includes form answers and audit metadata.

## Documents

Until Railway bucket values are saved for the organization, files are written under `STORAGE_LOCAL_DIR` (default `storage`). A complete bucket configuration in Admin > Settings uses that endpoint. Files are quarantined until the scan job marks them clean.

## Shutdown

The API enables Nest shutdown hooks. The outbox worker closes its timer, BullMQ worker, and Redis connections on module destroy.
