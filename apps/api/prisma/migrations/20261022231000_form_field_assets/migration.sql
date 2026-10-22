-- CreateTable
CREATE TABLE "form_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_assets_organization_id_id_key" ON "form_assets"("organization_id", "id");
CREATE INDEX "form_assets_organization_id_template_id_idx" ON "form_assets"("organization_id", "template_id");

-- AddForeignKey
ALTER TABLE "form_assets" ADD CONSTRAINT "form_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_assets" ADD CONSTRAINT "form_assets_organization_id_template_id_fkey" FOREIGN KEY ("organization_id", "template_id") REFERENCES "form_templates"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
