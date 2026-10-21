-- CreateTable
CREATE TABLE "vendor_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_category_links" (
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_category_links_pkey" PRIMARY KEY ("vendor_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_organization_id_id_key" ON "vendor_categories"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_organization_id_name_key" ON "vendor_categories"("organization_id", "name");

-- CreateIndex
CREATE INDEX "vendor_categories_organization_id_name_idx" ON "vendor_categories"("organization_id", "name");

-- CreateIndex
CREATE INDEX "vendor_category_links_organization_id_idx" ON "vendor_category_links"("organization_id");

-- CreateIndex
CREATE INDEX "vendor_category_links_category_id_idx" ON "vendor_category_links"("category_id");

-- AddForeignKey
ALTER TABLE "vendor_categories" ADD CONSTRAINT "vendor_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_category_links" ADD CONSTRAINT "vendor_category_links_organization_id_vendor_id_fkey" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "vendors"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_category_links" ADD CONSTRAINT "vendor_category_links_organization_id_category_id_fkey" FOREIGN KEY ("organization_id", "category_id") REFERENCES "vendor_categories"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
