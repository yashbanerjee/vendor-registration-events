# Implementation status

Recorded after the first milestone workflow passed its automated test and the admin UI was exercised against the running API.

## Verified

- Shared package tests: 5 passed (workflow transitions, locked fields, required-field validation, spreadsheet formula escaping).
- API document scan tests: 2 passed.
- API workflow test: 1 passed. It creates a form, publishes an immutable version, assigns it, accepts a hashed invitation, uploads a document, submits, rejects changes to locked fields, resubmits, approves, confirms the approval email stays at one row after a failed-job retry, denies another vendor by URL, and checks that `app_user` sees zero vendor rows without a tenant setting.
- Web component test: 1 passed (`isEditable`).
- `tsc --noEmit` passed for the shared package, API, and web app after the session cache fix.
- Browser, signed in as the seeded admin: dashboard counts and activity came from the API, a vendor was created and listed, the form builder opened a published form and its field inspector, and the document archive listed the uploaded file.

## Milestone behavior

Published form versions are immutable. Assignments point at a published version. Invitations store a hash of the token. Submissions keep the schema version and revision history. Correction requests name immutable field ids. The server rejects changes to fields that are not on the open correction. Approval writes an immutable snapshot and queues one approval email through the transactional outbox. Documents are stored under generated keys and downloaded through an authorized API stream.

## Still open

- MinIO images were not started in this environment. Use `STORAGE_DRIVER=local` until an S3-compatible service is available.
- ClamAV is optional. Without it, uploads are checked for size, type, extension, and a small set of signatures, including EICAR.
- No measured load test, and no backup restore drill has been executed here.
- The Compose `full` profile has not been built.
- Password reset and MFA enrollment exist on the API. The web app has MFA setup on Settings and does not yet have a reset-password page or a QR code.
- Excel import uses ExcelJS. Very large workbooks are not streamed row by row.
- CI is defined and has not been run on a remote runner from this workspace.
- `tsx` does not emit TypeScript design-time parameter types, so Nest constructors use explicit `@Inject()`.
