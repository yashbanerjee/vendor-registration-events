# Security checklist

These controls are implemented in code. They are not a claim that the system cannot be compromised.

## In place

- Argon2id password hashes.
- Session token stored as a SHA-256 hash in an HttpOnly, SameSite cookie. The CSRF cookie is readable by script and must match the hash stored on the session. State-changing requests also check `Origin` against `WEB_ORIGIN`.
- Invitation and recovery tokens are stored as hashes. The raw invitation token is encrypted inside the outbox payload so the worker can send the link.
- MFA secrets are encrypted with AES-256-GCM using `APP_ENCRYPTION_KEY`. Production startup rejects the development key, `COOKIE_SECURE=false`, and public Swagger.
- Role permissions are checked on the API. Vendor queries are limited to the signed-in vendor.
- PostgreSQL row-level security is forced for the runtime role `app_user` (`NOSUPERUSER`, `NOBYPASSRLS`). Tenant context is set inside the transaction. Auth bootstrap and the outbox worker use an explicit bypass flag.
- Published versions, submission revisions, correction field rows, and audit logs reject update and delete for ordinary roles.
- Uploads check declared type, extension, size, and file signatures. Storage keys do not use the original filename. Downloads go through the API after authorization. Presigned URLs are short-lived and limited to administrators.
- Logs redact authorization headers, cookies, `Set-Cookie`, and password, token, and secret fields. Audit rows do not store raw tokens or file bytes.
- Spreadsheet exports prefix formula-leading cells.
- Authenticated JSON responses send `Cache-Control: no-store` and the API does not emit ETags.

## Residual risk

- The built-in scanner is not a replacement for a maintained malware engine. Set `CLAMAV_HOST` when a daemon is available.
- Row-level security depends on grants being applied after every migration. A superuser connection bypasses it.
- Email status `SENT` means the SMTP server or the JSON transport accepted the message. `DELIVERED` and `BOUNCED` require the provider webhook.
- Rate limiting covers authentication routes. Other routes rely on session checks and request size limits.
- Development seed passwords and the sample encryption key are public. Do not deploy them.
