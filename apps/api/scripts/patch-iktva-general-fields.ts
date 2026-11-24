import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";
const accept = [".pdf", ".png", ".jpg", ".jpeg"];

const extras: Array<Pick<FormField, "key" | "label" | "required" | "description" | "type"> & { afterKey: string }> = [
  {
    key: "commercial_registration",
    label: "Commercial Registration",
    required: true,
    description: "PDF or image",
    type: "file",
    afterKey: "trade_license",
  },
  {
    key: "method_statement",
    label: "Method statement",
    required: true,
    description: "PDF or image",
    type: "file",
    afterKey: "rams",
  },
  {
    key: "electrical_certificates",
    label: "Electrical Certificates",
    required: true,
    description: "Add one or more files",
    type: "files",
    afterKey: "structural_calculations",
  },
  {
    key: "fire_retardant_certificates",
    label: "Fire Retardant Certificates",
    required: true,
    description: "Add one or more files",
    type: "files",
    afterKey: "electrical_certificates",
  },
];

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const form = await tx.formTemplate.findFirst({
      where: { archivedAt: null, name: { equals: FORM_NAME, mode: "insensitive" } },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!form?.versions[0]) throw new Error("Form not found");
    const schema = formSchemaDefinition.parse(form.versions[0].schema);
    const general = schema.sections.find((section) => /^general$/i.test(section.title));
    if (!general) throw new Error("GENERAL section missing");

    const keys = new Set(schema.fields.map((field) => field.key));
    for (const spec of extras) {
      if (keys.has(spec.key)) {
        const field = schema.fields.find((item) => item.key === spec.key)!;
        field.label = spec.label;
        field.required = spec.required;
        field.description = spec.description;
        field.type = spec.type;
        field.sectionId = general.id;
        field.file = { accept };
        continue;
      }
      const after = schema.fields.find((field) => field.key === spec.afterKey);
      schema.fields.push({
        id: randomUUID(),
        key: spec.key,
        type: spec.type,
        label: spec.label,
        required: spec.required,
        description: spec.description,
        sectionId: general.id,
        order: (after?.order ?? schema.fields.length) + 0.1,
        conditional: null,
        file: { accept },
      });
      keys.add(spec.key);
    }

    // Match declaration field order from the UI overview: company → representative → designation → signature → stamp → date → confirm → notice.
    const undertaking = schema.sections.find((section) => /undertaking|declaration/i.test(section.title));
    if (undertaking) {
      const preferred = [
        "declaration",
        "company_organization_name",
        "authorized_representative_name",
        "designation",
        "signature",
        "company_stamp",
        "signed_on",
        "undertaking_confirm",
        "how_to_submit",
      ];
      preferred.forEach((key, index) => {
        const field = schema.fields.find((item) => item.key === key && item.sectionId === undertaking.id);
        if (field) field.order = 1000 + index;
      });
      for (const field of schema.fields) {
        if (field.sectionId === undertaking.id && !preferred.includes(field.key)) {
          field.order = 900 + field.order;
        }
      }
    }

    schema.fields.sort((a, b) => a.order - b.order);
    schema.fields.forEach((field, index) => {
      field.order = index;
    });

    const parsed = formSchemaDefinition.parse(schema);
    const checksum = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
    await tx.formVersion.update({ where: { id: form.versions[0].id }, data: { schema: parsed, checksum } });
    await tx.formTemplate.update({ where: { id: form.id }, data: { draftSchema: parsed } });
    return {
      addedOrUpdated: extras.map((item) => item.key),
      generalLabels: parsed.fields.filter((field) => field.sectionId === general.id).map((field) => field.label),
    };
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
