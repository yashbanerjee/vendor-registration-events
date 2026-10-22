-- CreateEnum
CREATE TYPE "PacketStatus" AS ENUM ('AWAITING', 'SUBMITTED', 'REUPLOAD');

-- CreateTable
CREATE TABLE "exhibition_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exhibition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibition_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibition_form_returns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "exhibition_form_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" "PacketStatus" NOT NULL DEFAULT 'AWAITING',
    "storage_key" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT '',
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL DEFAULT '',
    "admin_note" TEXT NOT NULL DEFAULT '',
    "requested_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exhibition_form_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibition_form_files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PacketStatus" NOT NULL DEFAULT 'AWAITING',
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "admin_note" TEXT NOT NULL DEFAULT '',
    "requested_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exhibition_form_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exhibition_forms_organization_id_id_key" ON "exhibition_forms"("organization_id", "id");
CREATE INDEX "exhibition_forms_organization_id_exhibition_id_idx" ON "exhibition_forms"("organization_id", "exhibition_id");

CREATE UNIQUE INDEX "exhibition_form_returns_organization_id_id_key" ON "exhibition_form_returns"("organization_id", "id");
CREATE UNIQUE INDEX "exhibition_form_returns_exhibition_form_id_vendor_id_key" ON "exhibition_form_returns"("exhibition_form_id", "vendor_id");
CREATE INDEX "exhibition_form_returns_organization_id_vendor_id_idx" ON "exhibition_form_returns"("organization_id", "vendor_id");

CREATE UNIQUE INDEX "exhibition_form_files_organization_id_id_key" ON "exhibition_form_files"("organization_id", "id");
CREATE INDEX "exhibition_form_files_organization_id_return_id_idx" ON "exhibition_form_files"("organization_id", "return_id");

-- AddForeignKey
ALTER TABLE "exhibition_forms" ADD CONSTRAINT "exhibition_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exhibition_forms" ADD CONSTRAINT "exhibition_forms_organization_id_exhibition_id_fkey" FOREIGN KEY ("organization_id", "exhibition_id") REFERENCES "exhibitions"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exhibition_form_returns" ADD CONSTRAINT "exhibition_form_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exhibition_form_returns" ADD CONSTRAINT "exhibition_form_returns_organization_id_exhibition_form_id_fkey" FOREIGN KEY ("organization_id", "exhibition_form_id") REFERENCES "exhibition_forms"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exhibition_form_returns" ADD CONSTRAINT "exhibition_form_returns_organization_id_vendor_id_fkey" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "vendors"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exhibition_form_files" ADD CONSTRAINT "exhibition_form_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exhibition_form_files" ADD CONSTRAINT "exhibition_form_files_organization_id_return_id_fkey" FOREIGN KEY ("organization_id", "return_id") REFERENCES "exhibition_form_returns"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
