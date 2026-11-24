import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";

const pdfAccept = [".pdf"];
const pdfImageAccept = [".pdf", ".png", ".jpg", ".jpeg"];

const declaration = [
  "I, the undersigned, being the authorized representative of the above-mentioned company / organization, hereby declare and undertake that we have read, understood and agree to comply with the following requirements throughout our participation in the exhibition:",
  "",
  "A. Health, Safety and Environmental Requirements",
  "1. We shall comply with all applicable health, safety, fire safety and environmental protection requirements.",
  "2. We shall maintain a safe and clean working environment within our assigned exhibition space.",
  "3. We shall ensure that our booth setup, electrical installations, equipment, displays and materials meet the applicable safety standards and have the required approvals.",
  "4. We shall not obstruct emergency exits, fire extinguishers, fire alarms, emergency access routes or other safety equipment.",
  "5. We shall ensure that appropriate precautions are taken to prevent accidents, injuries, fire hazards and other potential risks.",
  "6. We shall immediately report any accident, injury, unsafe condition or safety incident to the Exhibition Organizing Team or relevant venue authorities.",
  "7. We shall cooperate with all health and safety inspections, emergency procedures and instructions issued by authorized personnel.",
  "",
  "B. Responsibility and Accountability",
  "1. We acknowledge responsibility for the conduct and activities of our employees, contractors, agents, suppliers and representatives.",
  "2. We shall ensure that all personnel working on our behalf are adequately briefed on relevant safety procedures and venue requirements.",
  "3. We shall take responsibility for any damage, loss or incident arising from our activities, to the extent of our responsibility under applicable law.",
  "4. We understand that failure to comply with the applicable laws, venue regulations or safety requirements may result in corrective action, suspension of activities or removal from the exhibition, subject to the applicable rules and procedures.",
  "",
  "C. Acknowledgement and Agreement",
  "We confirm that the information provided in this declaration is accurate and complete.",
  "We further confirm that we have read, understood and agreed to comply with the applicable laws of the country, the venue rules and regulations, and all relevant health, safety and operational guidelines issued by the Exhibition Organizers and Venue Management.",
  "We undertake to communicate these obligations to all personnel and third parties working on our behalf during the exhibition.",
  "",
  "Authorized Representative Confirmation",
  "By signing below, I confirm that I am authorized to make this declaration on behalf of the company / organization and agree to the terms and conditions stated above.",
].join("\n");

const importantNotice =
  "This declaration is a mandatory acknowledgement of compliance for exhibition participation. Failure to comply with applicable legal requirements, venue regulations or health and safety guidelines may affect the company's participation in the exhibition.";

type ReuploadSpec = { key: string; label: string; required: boolean; filename: string };

const orderForms: ReuploadSpec[] = [
  { key: "electrical_order_form", label: "Electrical Order Form", required: true, filename: "Electrical_Order_Form.pdf" },
  { key: "handling_order_form", label: "Handling Order Form", required: false, filename: "Handling_Order_Form.pdf" },
  { key: "internet_order_form", label: "Internet Connection Order Form", required: false, filename: "Internet_Connection_Order_Form.pdf" },
  { key: "security_order_form", label: "Security Order Form", required: false, filename: "Security_Order_Form.pdf" },
  { key: "five_star_cleaning_order_form", label: "5 Star Cleaning Order Form", required: false, filename: "5_Star_Cleaning_Order_Form.pdf" },
  { key: "cleaning_order_form", label: "Cleaning order form", required: false, filename: "Cleaning_order_form.pdf" },
  { key: "waste_skips_order_form", label: "Waste Skips Order Form", required: false, filename: "Waste_Skips_Order_Form.pdf" },
  { key: "catering_order_form", label: "Catering order form", required: false, filename: "Catering_order_form.pdf" },
];

const additionalDocs: ReuploadSpec[] = [
  { key: "av_order_form", label: "AV order form", required: false, filename: "AV_order_form.pdf" },
  { key: "furniture_order_form", label: "Furniture order form", required: false, filename: "Furniture_order_form.pdf" },
  { key: "contractor_vehicle_access_pass", label: "Contractor & Vehicle Access Pass", required: true, filename: "Contractor_Vehicle_Access_Pass.pdf" },
  { key: "performance_bond_form", label: "Performance Bond Form", required: true, filename: "Performance_Bond_Form.pdf" },
  { key: "on_stand_activity_form", label: "On stand activity Form", required: false, filename: "On_stand_activity_Form.pdf" },
];

function ensureSection(
  sections: { id: string; title: string; description: string; order: number }[],
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

function ensureReupload(
  fields: FormField[],
  sectionId: string,
  spec: ReuploadSpec,
  order: number,
  templateAsset?: { assetId: string; filename: string } | null,
) {
  const existing = fields.find((field) => field.key === spec.key);
  if (existing) {
    existing.label = spec.label;
    existing.required = spec.required;
    existing.type = "reupload";
    existing.sectionId = sectionId;
    existing.order = order;
    existing.description = "PDF or image";
    existing.file = { accept: pdfImageAccept };
    if (templateAsset) existing.template = templateAsset;
    else if (!existing.template && templateAsset !== null) {
      // keep any prior template
    }
    return;
  }
  fields.push({
    id: randomUUID(),
    key: spec.key,
    type: "reupload",
    label: spec.label,
    required: spec.required,
    description: "PDF or image",
    sectionId,
    order,
    conditional: null,
    file: { accept: pdfImageAccept },
    ...(templateAsset ? { template: templateAsset } : {}),
  });
}

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const form = await tx.formTemplate.findFirst({
      where: { archivedAt: null, name: { equals: FORM_NAME, mode: "insensitive" } },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        assets: { select: { id: true, filename: true }, take: 1 },
      },
    });
    if (!form?.versions[0]) throw new Error("Mandatory design documents form was not found.");

    const schema = formSchemaDefinition.parse(form.versions[0].schema);
    const fallbackTemplate = form.assets[0]
      ? { assetId: form.assets[0].id, filename: form.assets[0].filename }
      : schema.fields.find((field) => field.type === "reupload" && field.template)?.template ?? null;

    const generalId = ensureSection(
      schema.sections,
      /general|compliance|company/i,
      "GENERAL",
      "Fields marked with * are mandatory.",
      0,
    );
    // Fold prior drawings section into GENERAL when present.
    const drawings = schema.sections.find((section) => /drawing|technical/i.test(section.title));
    if (drawings && drawings.id !== generalId) {
      for (const field of schema.fields) {
        if (field.sectionId === drawings.id) field.sectionId = generalId;
      }
      schema.sections = schema.sections.filter((section) => section.id !== drawings.id);
    }

    const orderId = ensureSection(
      schema.sections,
      /order form/i,
      "Order Forms",
      "Download each template, complete it, then upload your signed copy.",
      1,
    );
    const additionalId = ensureSection(
      schema.sections,
      /additional/i,
      "Additional Documents",
      "Download each template, complete it, then upload your signed copy.",
      2,
    );
    const undertakingId = ensureSection(
      schema.sections,
      /undertaking|declaration/i,
      "CONTRACTOR UNDERTAKING",
      "Authorized representative declaration for exhibition participation.",
      3,
    );

    // Align GENERAL field labels with the UI overview where keys already exist.
    for (const field of schema.fields) {
      if (field.sectionId !== generalId) continue;
      switch (field.key) {
        case "trade_license":
          field.label = "Trade license";
          field.description = "PDF or image";
          break;
        case "insurance":
          field.label = "Insurance";
          field.description = "PDF or image";
          break;
        case "rams":
          field.label = "Risk assessment (template will be provided)";
          field.description = "PDF or image";
          break;
        case "construction_phase_plan":
          field.label = "Construction plan phase";
          field.description = "PDF or image";
          break;
        case "renders_3d":
          field.label = "3D Renders";
          field.description = "Add one or more files";
          break;
        case "cad_drawings":
          field.label = "Technical Drawings in CAD & pdf";
          field.description = "Add one or more files";
          break;
        case "electrical_layout":
          field.label = "Electrical grid plan";
          field.description = "Add one or more files";
          break;
        case "structural_calculations":
          field.label = "Structural calculations for complex structures (only for double decker)";
          field.description = "Add one or more files";
          break;
        default:
          break;
      }
    }

    let order = Math.max(0, ...schema.fields.map((field) => field.order)) + 1;
    for (const spec of orderForms) {
      ensureReupload(schema.fields, orderId, spec, order++, fallbackTemplate ? { assetId: fallbackTemplate.assetId, filename: spec.filename } : null);
    }
    for (const spec of additionalDocs) {
      ensureReupload(schema.fields, additionalId, spec, order++, fallbackTemplate ? { assetId: fallbackTemplate.assetId, filename: spec.filename } : null);
    }

    for (const field of schema.fields) {
      if (field.sectionId !== undertakingId) continue;
      if (field.key === "declaration") {
        field.label = "CONTRACTOR UNDERTAKING";
        field.description = declaration;
        field.readOnly = true;
      }
      if (field.key === "how_to_submit") {
        field.label = "IMPORTANT NOTICE";
        field.description = importantNotice;
        field.readOnly = true;
      }
      if (field.key === "company_organization_name") {
        field.placeholder = "Enter company / organization name";
      }
      if (field.key === "authorized_representative_name") {
        field.placeholder = "Enter authorized representative name";
      }
      if (field.key === "designation") {
        field.placeholder = "Enter designation";
      }
      if (field.key === "signature") {
        field.placeholder = "Sign here";
      }
    }

    if (!schema.fields.some((field) => field.key === "undertaking_confirm")) {
      schema.fields.push({
        id: randomUUID(),
        key: "undertaking_confirm",
        type: "checkbox",
        label: "Contractor undertaking confirmation",
        required: true,
        sectionId: undertakingId,
        order: order++,
        conditional: null,
        options: [{ value: "yes", label: "I confirm that I have read and agree to the contractor undertaking." }],
      });
    }

    // Keep confirmation just before the notice / actions.
    const confirm = schema.fields.find((field) => field.key === "undertaking_confirm");
    const notice = schema.fields.find((field) => field.key === "how_to_submit");
    if (confirm && notice) confirm.order = notice.order - 0.5;

    schema.sections.sort((a, b) => a.order - b.order);
    schema.sections.forEach((section, index) => {
      section.order = index;
    });
    schema.fields.sort((a, b) => a.order - b.order);
    schema.fields.forEach((field, index) => {
      field.order = index;
    });

    const parsed = formSchemaDefinition.parse(schema);
    const checksum = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
    await tx.formVersion.update({ where: { id: form.versions[0].id }, data: { schema: parsed, checksum } });
    await tx.formTemplate.update({
      where: { id: form.id },
      data: {
        draftSchema: parsed,
        description:
          "Iktva Forum 2027 contractor pack: GENERAL documents, Order Forms, Additional Documents, and CONTRACTOR UNDERTAKING.",
      },
    });

    return {
      formId: form.id,
      versionId: form.versions[0].id,
      sections: parsed.sections.map((section) => section.title),
      fieldCount: parsed.fields.length,
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
