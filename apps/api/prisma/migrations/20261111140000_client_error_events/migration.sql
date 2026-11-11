-- CreateTable
CREATE TABLE "client_error_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "vendor_id" UUID,
    "user_email" TEXT NOT NULL DEFAULT '',
    "user_name" TEXT NOT NULL DEFAULT '',
    "company_name" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "code" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "correlation_id" TEXT NOT NULL DEFAULT '',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "alerted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_error_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_error_events_organization_id_created_at_idx" ON "client_error_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "client_error_events_organization_id_path_created_at_idx" ON "client_error_events"("organization_id", "path", "created_at");

-- AddForeignKey
ALTER TABLE "client_error_events" ADD CONSTRAINT "client_error_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
