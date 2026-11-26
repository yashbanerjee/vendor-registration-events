import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";

const POWER_ITEMS: { key: string; label: string; cost: string }[] = [
  { key: "power_qty_32a_single", label: "32A Single Phase Power Point", cost: "1000" },
  { key: "power_qty_63a_single", label: "63A Single Phase Power Point", cost: "1500" },
  { key: "power_qty_32a_380", label: "32A /380 Phase Power Point", cost: "2500" },
  { key: "power_qty_63a_380", label: "63A /380 Phase Power Point", cost: "3000" },
  { key: "power_qty_100a_380", label: "100A/380V Three Phase Power Point", cost: "4000" },
  { key: "power_qty_200a_380", label: "200A/380V Three Phase Power Point", cost: "9500" },
  {
    key: "power_qty_connection",
    label: "Electrical connection (does not include cables, circuit breakers & panels)",
    cost: "0",
  },
];

function ensureField(
  fields: FormField[],
  sectionId: string,
  draft: Omit<FormField, "id" | "sectionId"> & { id?: string },
) {
  const existing = fields.find((field) => field.key === draft.key);
  if (existing) {
    Object.assign(existing, {
      ...draft,
      id: existing.id,
      sectionId,
    });
    return existing;
  }
  const created: FormField = {
    id: draft.id ?? randomUUID(),
    sectionId,
    key: draft.key,
    type: draft.type,
    label: draft.label,
    description: draft.description,
    required: draft.required,
    placeholder: draft.placeholder,
    order: draft.order,
    validation: draft.validation,
    file: draft.file,
    template: draft.template,
    options: draft.options,
    readOnly: draft.readOnly,
  };
  fields.push(created);
  return created;
}

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const form = await tx.formTemplate.findFirst({
      where: { archivedAt: null, name: { equals: FORM_NAME, mode: "insensitive" } },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!form?.versions[0]) throw new Error("Mandatory design documents form was not found.");
    const schema = formSchemaDefinition.parse(form.versions[0].schema);
    const orderSection =
      schema.sections.find((section) => /order forms/i.test(section.title))
      ?? schema.sections.sort((a, b) => a.order - b.order)[0];
    if (!orderSection) throw new Error("Order Forms section was not found.");

    const electrical = schema.fields.find((field) => field.key === "electrical_order_form");
    const insertAfter = electrical?.order ?? 20;

    // Shift later fields so Power details + notes sit immediately after the Electrical Order Form.
    for (const field of schema.fields) {
      if (field.sectionId === orderSection.id && field.order > insertAfter && !field.key.startsWith("power_")) {
        field.order += POWER_ITEMS.length + 2;
      }
    }

    POWER_ITEMS.forEach((item, index) => {
      ensureField(schema.fields, orderSection.id, {
        key: item.key,
        type: "number",
        label: item.label,
        description: item.cost,
        required: false,
        placeholder: "0",
        order: insertAfter + 1 + index,
        validation: { min: 0 },
      });
    });

    ensureField(schema.fields, orderSection.id, {
      key: "power_additional_notes",
      type: "textarea",
      label: "Additional requirements / remarks",
      description: "Add any extra electrical notes after the power details. No price applies to this section.",
      required: false,
      placeholder: "Enter additional requirements or remarks",
      order: insertAfter + 1 + POWER_ITEMS.length,
      validation: { maxLength: 4000 },
    });

    schema.fields
      .filter((field) => field.sectionId === orderSection.id)
      .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
      .forEach((field, index) => {
        field.order = index + 1;
      });

    const parsed = formSchemaDefinition.parse(schema);
    const checksum = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
    await tx.formVersion.update({
      where: { id: form.versions[0].id },
      data: { schema: parsed as object, checksum },
    });
    await tx.formTemplate.update({
      where: { id: form.id },
      data: { draftSchema: parsed as object },
    });

    return {
      formId: form.id,
      versionId: form.versions[0].id,
      added: [...POWER_ITEMS.map((item) => item.key), "power_additional_notes"],
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
