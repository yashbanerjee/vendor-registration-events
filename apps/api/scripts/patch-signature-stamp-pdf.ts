import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const form = await tx.formTemplate.findFirst({
      where: { archivedAt: null, name: { equals: FORM_NAME, mode: "insensitive" } },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!form?.versions[0]) throw new Error("form missing");
    const schema = formSchemaDefinition.parse(form.versions[0].schema);
    for (const field of schema.fields) {
      if (field.key === "signature" || field.key === "company_stamp") {
        field.type = "file";
        field.file = { accept: [".pdf"] };
        field.description =
          field.key === "signature"
            ? "Upload a signed PDF that includes the company name and authorized representative signature."
            : "Upload a PDF of the company stamp that includes the company name.";
      }
    }
    const checksum = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
    await tx.formVersion.update({ where: { id: form.versions[0].id }, data: { schema, checksum } });
    await tx.formTemplate.update({ where: { id: form.id }, data: { draftSchema: schema } });
    return { formId: form.id, updated: ["signature", "company_stamp"] };
  });
  console.log(JSON.stringify(summary));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
