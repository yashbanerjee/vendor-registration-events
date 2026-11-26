import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";

const POWER_ITEMS: { key: string; label: string }[] = [
  { key: "power_qty_32a_single", label: "32A Single Phase Power Point" },
  { key: "power_qty_63a_single", label: "63A Single Phase Power Point" },
  { key: "power_qty_32a_380", label: "32A /380 Phase Power Point" },
  { key: "power_qty_63a_380", label: "63A /380 Phase Power Point" },
  { key: "power_qty_100a_380", label: "100A/380V Three Phase Power Point" },
  { key: "power_qty_200a_380", label: "200A/380V Three Phase Power Point" },
  {
    key: "power_qty_connection",
    label: "Electrical connection (does not include cables, circuit breakers & panels)",
  },
];

function ensureSection(
  sections: { id: string; title: string; description?: string; order: number }[],
  match: RegExp,
  title: string,
  description: string,
  order: number,
) {
  const existing = sections.find((section) => match.test(section.title));
  if (existing) {
    existing.title = title;
    existing.description = description;
    existing.order = order;
    return existing.id;
  }
  const id = randomUUID();
  sections.push({ id, title, description, order });
  return id;
}

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
      description: draft.description,
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

    const general = schema.sections.find((section) => /general/i.test(section.title));
    const orderForms = schema.sections.find((section) => /order forms/i.test(section.title));
    const additional = schema.sections.find((section) => /additional/i.test(section.title));
    const undertaking = schema.sections.find((section) => /undertaking/i.test(section.title));

    // Place Electric Power Order after Order Forms (or General).
    const powerOrder =
      (orderForms?.order ?? general?.order ?? 1) + 1;
    const powerSectionId = ensureSection(
      schema.sections,
      /electric(al)? power order/i,
      "Electric Power Order",
      "Select quantities for the power points you need, then add any extra remarks. No prices are shown in this section.",
      powerOrder,
    );

    if (additional) additional.order = powerOrder + 1;
    if (undertaking) undertaking.order = powerOrder + 2;
    schema.sections.sort((left, right) => left.order - right.order).forEach((section, index) => {
      section.order = index + 1;
    });

    // Remove Electrical Order Form PDF reupload from Order Forms.
    const before = schema.fields.length;
    schema.fields = schema.fields.filter((field) => field.key !== "electrical_order_form");
    const removedPdf = before !== schema.fields.length;

    POWER_ITEMS.forEach((item, index) => {
      ensureField(schema.fields, powerSectionId, {
        key: item.key,
        type: "number",
        label: item.label,
        description: undefined,
        required: false,
        placeholder: "0",
        order: index + 1,
        validation: { min: 0 },
      });
    });

    ensureField(schema.fields, powerSectionId, {
      key: "power_additional_notes",
      type: "textarea",
      label: "Additional requirements / remarks",
      description: "Add any extra electrical notes. No price applies to this section.",
      required: false,
      placeholder: "Enter additional requirements or remarks",
      order: POWER_ITEMS.length + 1,
      validation: { maxLength: 4000 },
    });

    // Drop any leftover cost descriptions on power qty fields.
    for (const field of schema.fields) {
      if (field.key.startsWith("power_qty_")) {
        field.description = undefined;
        field.sectionId = powerSectionId;
      }
      if (field.key === "power_additional_notes") {
        field.sectionId = powerSectionId;
      }
    }

    // Re-index Order Forms without the electrical PDF field.
    if (orderForms) {
      schema.fields
        .filter((field) => field.sectionId === orderForms.id)
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
        .forEach((field, index) => {
          field.order = index + 1;
        });
    }

    schema.fields
      .filter((field) => field.sectionId === powerSectionId)
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
      removedPdf,
      powerSectionId,
      sections: parsed.sections.map((section) => ({ title: section.title, order: section.order })),
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
