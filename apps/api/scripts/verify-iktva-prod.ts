import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition } from "@vmp/shared";

const prisma = new PrismaClient();

const requiredSections = ["GENERAL", "Order Forms", "Additional Documents", "CONTRACTOR UNDERTAKING"];
const requiredGeneral = [
  "trade_license",
  "commercial_registration",
  "insurance",
  "rams",
  "method_statement",
  "construction_phase_plan",
  "renders_3d",
  "cad_drawings",
  "electrical_layout",
  "structural_calculations",
  "electrical_certificates",
  "fire_retardant_certificates",
];
const requiredOrder = [
  "electrical_order_form",
  "handling_order_form",
  "internet_order_form",
  "security_order_form",
  "five_star_cleaning_order_form",
  "cleaning_order_form",
  "waste_skips_order_form",
  "catering_order_form",
];
const requiredAdditional = [
  "av_order_form",
  "furniture_order_form",
  "contractor_vehicle_access_pass",
  "performance_bond_form",
  "on_stand_activity_form",
];
const requiredUndertaking = [
  "company_organization_name",
  "authorized_representative_name",
  "designation",
  "declaration",
  "signature",
  "company_stamp",
  "signed_on",
  "undertaking_confirm",
  "how_to_submit",
];

async function main() {
  await prisma.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const form = await prisma.formTemplate.findFirst({
    where: { archivedAt: null, name: { equals: "Mandatory design documents", mode: "insensitive" } },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!form?.versions[0]) throw new Error("Mandatory design documents form missing");

  const schema = formSchemaDefinition.parse(form.versions[0].schema);
  const sectionTitles = schema.sections.sort((a, b) => a.order - b.order).map((section) => section.title);
  const missingSections = requiredSections.filter((title) => !sectionTitles.includes(title));
  const bySection = (title: string) => {
    const section = schema.sections.find((item) => item.title === title);
    if (!section) return [];
    return schema.fields.filter((field) => field.sectionId === section.id).map((field) => field.key);
  };

  const checks = [
    ["sections", missingSections],
    ["GENERAL fields", requiredGeneral.filter((key) => !bySection("GENERAL").includes(key))],
    ["Order Forms fields", requiredOrder.filter((key) => !bySection("Order Forms").includes(key))],
    ["Additional Documents fields", requiredAdditional.filter((key) => !bySection("Additional Documents").includes(key))],
    ["Undertaking fields", requiredUndertaking.filter((key) => !bySection("CONTRACTOR UNDERTAKING").includes(key))],
  ] as const;

  const confirm = schema.fields.find((field) => field.key === "undertaking_confirm");
  const issues: string[] = [];
  for (const [label, missing] of checks) {
    if (missing.length) issues.push(`${label}: missing ${missing.join(", ")}`);
  }
  if (!confirm || confirm.type !== "checkbox" || !confirm.required) {
    issues.push("undertaking_confirm must be a required checkbox");
  }

  const result = {
    ok: issues.length === 0,
    formId: form.id,
    versionId: form.versions[0].id,
    sections: sectionTitles,
    fieldCount: schema.fields.length,
    issues,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
