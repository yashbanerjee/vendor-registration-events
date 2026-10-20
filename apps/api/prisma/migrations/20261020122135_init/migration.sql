-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExhibitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormScope" AS ENUM ('GLOBAL', 'EXHIBITION', 'VENDOR');

-- CreateEnum
CREATE TYPE "FormTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('INVITED', 'IN_PROGRESS', 'SUBMITTED_PENDING_REVIEW', 'CORRECTION_REQUESTED', 'RESUBMITTED_PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvitationPurpose" AS ENUM ('ACCOUNT_ACTIVATION', 'FORM_ASSIGNMENT', 'CORRECTION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'RESOLVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('QUARANTINED', 'AVAILABLE', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('CREATED', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "vendor_id" UUID,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_secrets" (
    "user_id" UUID NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "mfa_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "additional_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT NOT NULL DEFAULT '',
    "address_line1" TEXT NOT NULL DEFAULT '',
    "address_line2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postal_code" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "status" "VendorStatus" NOT NULL DEFAULT 'INVITED',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ExhibitionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exhibitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_exhibitions" (
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "exhibition_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_exhibitions_pkey" PRIMARY KEY ("vendor_id","exhibition_id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" "FormScope" NOT NULL DEFAULT 'GLOBAL',
    "status" "FormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "exhibition_id" UUID,
    "vendor_id" UUID,
    "draft_schema" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "published_by_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "exhibition_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'INVITED',
    "deadline" TIMESTAMPTZ(6),
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "approved_revision_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "form_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purpose" "InvitationPurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "vendor_id" UUID,
    "assignment_id" UUID,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "current_revision_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "requested_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_request_fields" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "field_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "correction_request_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "exhibition_id" UUID,
    "assignment_id" UUID,
    "submission_revision_id" UUID,
    "field_id" TEXT,
    "category" TEXT NOT NULL DEFAULT 'form-upload',
    "status" "DocumentStatus" NOT NULL DEFAULT 'QUARANTINED',
    "retention_until" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "scan_status" TEXT NOT NULL DEFAULT 'pending',
    "scan_details" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL DEFAULT '',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "to_address" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email_message_id" UUID NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload_enc" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "vendor_id" UUID,
    "field_id" TEXT,
    "previous_value" JSONB,
    "new_value" JSONB,
    "correlation_id" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "messages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vendor_id" UUID,

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_id_key" ON "users"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_challenges_token_hash_key" ON "mfa_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "mfa_challenges_user_id_idx" ON "mfa_challenges"("user_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_company_name_idx" ON "vendors"("organization_id", "company_name");

-- CreateIndex
CREATE INDEX "vendors_organization_id_status_idx" ON "vendors"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_id_id_key" ON "vendors"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_id_reference_key" ON "vendors"("organization_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_id_email_key" ON "vendors"("organization_id", "email");

-- CreateIndex
CREATE INDEX "exhibitions_organization_id_starts_at_idx" ON "exhibitions"("organization_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "exhibitions_organization_id_id_key" ON "exhibitions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "exhibitions_organization_id_code_key" ON "exhibitions"("organization_id", "code");

-- CreateIndex
CREATE INDEX "vendor_exhibitions_organization_id_idx" ON "vendor_exhibitions"("organization_id");

-- CreateIndex
CREATE INDEX "form_templates_organization_id_status_idx" ON "form_templates"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "form_templates_organization_id_id_key" ON "form_templates"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_organization_id_id_key" ON "form_versions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_template_id_version_number_key" ON "form_versions"("template_id", "version_number");

-- CreateIndex
CREATE INDEX "form_assignments_organization_id_status_idx" ON "form_assignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "form_assignments_organization_id_deadline_idx" ON "form_assignments"("organization_id", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "form_assignments_organization_id_id_key" ON "form_assignments"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "form_assignments_vendor_id_exhibition_id_form_version_id_key" ON "form_assignments"("vendor_id", "exhibition_id", "form_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_assignment_id_purpose_idx" ON "invitations"("organization_id", "assignment_id", "purpose");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_key" ON "submissions"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_organization_id_id_key" ON "submissions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_organization_id_assignment_id_key" ON "submissions"("organization_id", "assignment_id");

-- CreateIndex
CREATE INDEX "submission_revisions_organization_id_created_at_idx" ON "submission_revisions"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_revisions_submission_id_revision_number_key" ON "submission_revisions"("submission_id", "revision_number");

-- CreateIndex
CREATE INDEX "correction_requests_organization_id_status_idx" ON "correction_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "correction_request_fields_organization_id_idx" ON "correction_request_fields"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "correction_request_fields_correction_request_id_field_id_key" ON "correction_request_fields"("correction_request_id", "field_id");

-- CreateIndex
CREATE INDEX "review_notes_submission_id_created_at_idx" ON "review_notes"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_organization_id_vendor_id_created_at_idx" ON "documents"("organization_id", "vendor_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_organization_id_status_idx" ON "documents"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_organization_id_id_key" ON "documents"("organization_id", "id");

-- CreateIndex
CREATE INDEX "document_versions_organization_id_filename_idx" ON "document_versions"("organization_id", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_idempotency_key_key" ON "email_messages"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_messages_organization_id_status_idx" ON "email_messages"("organization_id", "status");

-- CreateIndex
CREATE INDEX "email_delivery_events_email_message_id_created_at_idx" ON "email_delivery_events"("email_message_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_resource_type_resource_id_idx" ON "audit_logs"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_vendor_id_idx" ON "audit_logs"("organization_id", "vendor_id");

-- CreateIndex
CREATE INDEX "import_jobs_organization_id_created_at_idx" ON "import_jobs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "import_job_rows_organization_id_idx" ON "import_job_rows"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_job_rows_import_job_id_row_number_key" ON "import_job_rows"("import_job_id", "row_number");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_secrets" ADD CONSTRAINT "mfa_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_exhibitions" ADD CONSTRAINT "vendor_exhibitions_organization_id_vendor_id_fkey" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "vendors"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_exhibitions" ADD CONSTRAINT "vendor_exhibitions_organization_id_exhibition_id_fkey" FOREIGN KEY ("organization_id", "exhibition_id") REFERENCES "exhibitions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_exhibition_id_fkey" FOREIGN KEY ("exhibition_id") REFERENCES "exhibitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_organization_id_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "form_templates"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_vendor_id_fkey" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "vendors"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_exhibition_id_fkey" FOREIGN KEY ("organization_id", "exhibition_id") REFERENCES "exhibitions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_form_version_id_fkey" FOREIGN KEY ("organization_id", "form_version_id") REFERENCES "form_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "form_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_assignment_id_fkey" FOREIGN KEY ("organization_id", "assignment_id") REFERENCES "form_assignments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_revisions" ADD CONSTRAINT "submission_revisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_revisions" ADD CONSTRAINT "submission_revisions_organization_id_submission_id_fkey" FOREIGN KEY ("organization_id", "submission_id") REFERENCES "submissions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_revisions" ADD CONSTRAINT "submission_revisions_organization_id_form_version_id_fkey" FOREIGN KEY ("organization_id", "form_version_id") REFERENCES "form_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_submission_id_fkey" FOREIGN KEY ("organization_id", "submission_id") REFERENCES "submissions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_request_fields" ADD CONSTRAINT "correction_request_fields_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_organization_id_submission_id_fkey" FOREIGN KEY ("organization_id", "submission_id") REFERENCES "submissions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_vendor_id_fkey" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "vendors"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_exhibition_id_fkey" FOREIGN KEY ("exhibition_id") REFERENCES "exhibitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "form_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
