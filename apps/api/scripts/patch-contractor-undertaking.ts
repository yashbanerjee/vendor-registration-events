import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";

const prisma = new PrismaClient();
const FORM_NAME = "Mandatory design documents";

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
  "",
  "IMPORTANT NOTICE",
  "This declaration is a mandatory acknowledgement of compliance for exhibition participation. Failure to comply with applicable legal requirements, venue regulations or health and safety guidelines may affect the company's participation in the exhibition.",
].join("\n");

const howToSubmit =
  "This undertaking is a mandatory acknowledgement of compliance for exhibition participation. One form per stand contractor, signed by an authorized representative and stamped where applicable. Submit it with your design package. Failure to comply with applicable legal requirements, venue regulations or health and safety guidelines may affect participation.";

function patchField(field: FormField) {
  switch (field.key) {
    case "letter_of_undertaking":
      field.description = "Contractor undertaking form. Signed and stamped by an authorized representative.";
      break;
    case "contractor_name":
      field.key = "company_organization_name";
      field.label = "Company / Organization Name";
      break;
    case "company_organization_name":
      field.label = "Company / Organization Name";
      break;
    case "contact_name":
      field.key = "designation";
      field.label = "Designation";
      break;
    case "designation":
      field.label = "Designation";
      break;
    case "signing_person_name":
      field.key = "authorized_representative_name";
      field.label = "Authorized Representative Name";
      field.description = "";
      break;
    case "authorized_representative_name":
      field.label = "Authorized Representative Name";
      field.description = "";
      break;
    case "id_iqama":
      field.required = false;
      field.description = "Optional. Not required on the contractor undertaking form.";
      break;
    case "declaration":
      field.label = "Contractor undertaking";
      field.description = declaration;
      field.readOnly = true;
      break;
    case "signature":
      field.description = "Upload a signed PDF that includes the company / organization name and authorized representative signature.";
      break;
    case "company_stamp":
      field.label = "Company Stamp (if applicable)";
      field.required = false;
      field.description = "Upload a PDF of the company stamp that includes the company / organization name.";
      break;
    case "how_to_submit":
      field.description = howToSubmit;
      break;
    default:
      break;
  }
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
    for (const section of schema.sections) {
      if (section.title.toLowerCase().includes("declaration") || section.title.toLowerCase().includes("undertaking")) {
        section.title = "Contractor undertaking form";
        section.description =
          "Authorized representative declaration covering health, safety, environmental requirements, responsibility, and acknowledgement for exhibition participation.";
      }
    }
    const keys = new Set(schema.fields.map((field) => field.key));
    for (const field of schema.fields) patchField(field);
    if (!keys.has("designation") && !schema.fields.some((field) => field.key === "designation")) {
      const declarationSection = schema.sections.find(
        (section) => section.title.toLowerCase().includes("undertaking") || section.title.toLowerCase().includes("declaration"),
      );
      if (declarationSection) {
        const after = schema.fields.find((field) => field.key === "authorized_representative_name");
        schema.fields.push({
          id: randomUUID(),
          key: "designation",
          type: "text",
          label: "Designation",
          required: true,
          description: "",
          sectionId: declarationSection.id,
          order: (after?.order ?? 14) + 0.5,
          conditional: null,
        });
      }
    }
    schema.fields.sort((a, b) => a.order - b.order);
    schema.fields.forEach((field, index) => {
      field.order = index;
    });
    const checksum = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
    await tx.formVersion.update({ where: { id: form.versions[0].id }, data: { schema, checksum } });
    await tx.formTemplate.update({
      where: { id: form.id },
      data: {
        draftSchema: schema,
        description:
          "Space-only plot (40-120 m2) for Iktva Forum 2027. Three stages: compliance documents, technical drawings, and the contractor undertaking form.",
      },
    });
    return {
      formId: form.id,
      versionId: form.versions[0].id,
      patched: schema.fields.map((field) => field.key).filter((key) =>
        [
          "letter_of_undertaking",
          "company_organization_name",
          "authorized_representative_name",
          "designation",
          "declaration",
          "signature",
          "company_stamp",
          "how_to_submit",
          "id_iqama",
        ].includes(key),
      ),
    };
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
