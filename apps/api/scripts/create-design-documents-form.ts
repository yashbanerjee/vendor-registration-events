import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Prisma, PrismaClient } from "@prisma/client";
import { formSchemaDefinition, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { sniffAllowed } from "../src/documents/scan";
import { effectiveSettings, parseStored } from "../src/platform/org-settings";

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
  "This declaration is a mandatory acknowledgement of compliance for participation in the exhibition. Failure to comply with applicable legal requirements, venue regulations or health and safety guidelines may affect the company's participation in the exhibition.",
].join("\n");

function pdf(title: string, lines: string[]) {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const commands = ["BT", "/F1 12 Tf", "72 740 Td", "16 TL", `(${escape(title)}) Tj`, "T*"];
  for (const line of ["", ...lines, "", "Placeholder file. Replace this with the real form before vendors use it."]) {
    commands.push(`(${escape(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) content += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = Buffer.from(content);
  const scan = sniffAllowed(bytes, "form.pdf", "application/pdf");
  if (!scan.clean) throw new Error(scan.details);
  return bytes;
}

function field(sectionId: string, order: number, input: Pick<FormField, "key" | "type" | "label" | "required"> & Partial<FormField>): FormField {
  return {
    id: randomUUID(),
    description: "",
    sectionId,
    order,
    conditional: null,
    ...input,
  };
}

function schema(templates: { key: string; assetId: string; filename: string }[]): FormSchemaDefinition {
  const compliance = randomUUID();
  const drawings = randomUUID();
  const declarationSection = randomUUID();
  const templateFor = (key: string) => {
    const template = templates.find((item) => item.key === key);
    if (!template) throw new Error(`Missing template ${key}`);
    return { assetId: template.assetId, filename: template.filename };
  };
  const pdfAccept = [".pdf"];
  return formSchemaDefinition.parse({
    sections: [
      {
        id: compliance,
        title: "Company & compliance documents",
        description: "Download each file, fill it in, then upload your completed copy. Signed documents must be stamped and, where stated, on company letterhead. Applies to space-only plot (40-120 m2).",
        order: 0,
      },
      {
        id: drawings,
        title: "Drawings & technical documents",
        description: "Upload each drawing in the format named on the field. Applies to space-only plot (40-120 m2).",
        order: 1,
      },
      {
        id: declarationSection,
        title: "Contractor undertaking form",
        description: "Authorized representative declaration covering health, safety, environmental requirements, responsibility, and acknowledgement for exhibition participation.",
        order: 2,
      },
    ],
    fields: [
      field(compliance, 0, { key: "letter_of_undertaking", type: "reupload", label: "Letter of Undertaking", required: true, description: "Contractor undertaking form. Signed and stamped by an authorized representative.", file: { accept: pdfAccept }, template: templateFor("letter_of_undertaking") }),
      field(compliance, 1, { key: "rams", type: "reupload", label: "Risk assessment and method statement (RAMS)", required: true, description: "Signed, stamped, and on company letterhead.", file: { accept: pdfAccept }, template: templateFor("rams") }),
      field(compliance, 2, { key: "contractor_details_checklist", type: "reupload", label: "Contractor details and stand plan checklist", required: true, file: { accept: pdfAccept }, template: templateFor("contractor_details_checklist") }),
      field(compliance, 3, { key: "trade_license", type: "reupload", label: "Trade license / commercial registration", required: true, file: { accept: pdfAccept }, template: templateFor("trade_license") }),
      field(compliance, 4, { key: "insurance", type: "reupload", label: "Contractor's all-risk insurance with public liability cover", required: true, description: "See the insurance requirements in the sponsor manual.", file: { accept: pdfAccept }, template: templateFor("insurance") }),
      field(compliance, 5, { key: "construction_phase_plan", type: "reupload", label: "Construction phase plan", required: true, description: "Onsite team size for build and dismantling, equipment, materials and fire protection measures.", file: { accept: pdfAccept }, template: templateFor("construction_phase_plan") }),
      field(drawings, 6, { key: "renders_3d", type: "files", label: "3D renders showing all perspective views", required: true, description: "Upload every perspective view as a PDF or image.", file: { accept: [".pdf", ".png", ".jpg", ".jpeg"] } }),
      field(drawings, 7, { key: "cad_drawings", type: "file", label: "Technical CAD drawings", required: true, description: "PDF only. Include all dimensions, elevations, sections and steel supports, to scale (not smaller than 1:50).", file: { accept: pdfAccept } }),
      field(drawings, 8, { key: "electrical_layout", type: "file", label: "Electrical layout and load calculation with floor grid", required: true, description: "Upload one PDF.", file: { accept: pdfAccept } }),
      field(drawings, 9, { key: "structural_calculations", type: "file", label: "Structural calculations and rigging plan", required: false, description: "For complex structures. Include the rigging plan where applicable (above 4 m high). PDF only.", file: { accept: pdfAccept } }),
      field(declarationSection, 10, { key: "client_name", type: "text", label: "Client (sponsor) name", required: true }),
      field(declarationSection, 11, { key: "plot_number", type: "text", label: "Plot number", required: true }),
      field(declarationSection, 12, { key: "company_organization_name", type: "text", label: "Company / Organization Name", required: true }),
      field(declarationSection, 13, { key: "authorized_representative_name", type: "text", label: "Authorized Representative Name", required: true }),
      field(declarationSection, 14, { key: "designation", type: "text", label: "Designation", required: true }),
      field(declarationSection, 15, { key: "mobile", type: "tel", label: "Mobile", required: true }),
      field(declarationSection, 16, { key: "email", type: "email", label: "Email", required: true }),
      field(declarationSection, 17, { key: "declaration", type: "info", label: "Contractor undertaking", required: false, description: declaration, readOnly: true }),
      field(declarationSection, 18, { key: "signature", type: "file", label: "Signature", required: true, description: "Upload a signed PDF that includes the company / organization name and authorized representative signature.", file: { accept: pdfAccept } }),
      field(declarationSection, 19, { key: "company_stamp", type: "file", label: "Company Stamp (if applicable)", required: false, description: "Upload a PDF of the company stamp that includes the company / organization name.", file: { accept: pdfAccept } }),
      field(declarationSection, 20, { key: "signed_on", type: "date", label: "Date", required: true }),
      field(declarationSection, 21, { key: "how_to_submit", type: "info", label: "How to submit", required: false, readOnly: true, description: "This undertaking is a mandatory acknowledgement of compliance for exhibition participation. One form per stand contractor, signed by an authorized representative and stamped where applicable. Submit it with your design package. Failure to comply with applicable legal requirements, venue regulations or health and safety guidelines may affect participation." }),
    ],
  });
}

const templates = [
  { key: "letter_of_undertaking", filename: "letter-of-undertaking.pdf", title: "Letter of Undertaking", lines: ["Contractor undertaking form, signed and stamped."] },
  { key: "rams", filename: "risk-assessment-method-statement.pdf", title: "Risk assessment and method statement", lines: ["Sign and stamp this document on company letterhead."] },
  { key: "contractor_details_checklist", filename: "contractor-details-and-stand-plan-checklist.pdf", title: "Contractor details and stand plan checklist", lines: ["Complete every item, then upload the finished file."] },
  { key: "trade_license", filename: "trade-license.pdf", title: "Trade license / commercial registration", lines: ["Attach the current trade license or commercial registration."] },
  { key: "insurance", filename: "all-risk-insurance.pdf", title: "Contractor all-risk insurance", lines: ["Public liability cover is required. See the sponsor manual."] },
  { key: "construction_phase_plan", filename: "construction-phase-plan.pdf", title: "Construction phase plan", lines: ["State the onsite team size for build and dismantling,", "plus equipment, materials and fire protection measures."] },
];

async function putFile(organizationId: string, key: string, body: Buffer, settings: ReturnType<typeof effectiveSettings>) {
  const ready = Boolean(settings.storageEndpoint && settings.storageBucket && settings.storageAccessKey && settings.storageSecret);
  if (!ready && (process.env.STORAGE_DRIVER === "local" || process.env.NODE_ENV !== "production")) {
    const root = path.resolve(process.env.STORAGE_LOCAL_DIR || "storage");
    const target = path.resolve(root, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return;
  }
  const client = new S3Client({
    region: settings.storageRegion || "auto",
    endpoint: settings.storageEndpoint || undefined,
    forcePathStyle: settings.storagePathStyle,
    credentials: { accessKeyId: settings.storageAccessKey, secretAccessKey: settings.storageSecret },
  });
  await client.send(new PutObjectCommand({
    Bucket: settings.storageBucket,
    Key: key,
    Body: body,
    ContentType: "application/pdf",
  }));
}

async function main() {
  const prisma = new PrismaClient();
  const email = (process.env.SEED_ADMIN_EMAIL || "info@vedha.ae").toLowerCase();
  const admin = await prisma.user.findUnique({ where: { email }, select: { id: true, organizationId: true } });
  if (!admin) throw new Error("The admin account was not found.");
  const existing = await prisma.formTemplate.findFirst({
    where: { organizationId: admin.organizationId, name: FORM_NAME, archivedAt: null },
    select: { id: true, status: true },
  });
  if (existing) {
    console.log(JSON.stringify({ formId: existing.id, status: existing.status, created: false }));
    await prisma.$disconnect();
    return;
  }
  const organization = await prisma.organization.findUnique({ where: { id: admin.organizationId }, select: { settings: true } });
  const settings = effectiveSettings(parseStored(organization?.settings));
  const templateId = randomUUID();
  const uploaded = templates.map((item) => ({ ...item, assetId: randomUUID(), bytes: pdf(item.title, item.lines) }));
  await prisma.formTemplate.create({
    data: {
      id: templateId,
      organizationId: admin.organizationId,
      name: FORM_NAME,
      description: "Space-only plot (40-120 m2) for Iktva Forum 2027. Three stages: compliance documents, technical drawings, and the contractor undertaking form.",
      scope: "GLOBAL",
      status: "DRAFT",
      draftSchema: { sections: [{ id: randomUUID(), title: "General", description: "", order: 0 }], fields: [] } as Prisma.InputJsonValue,
      createdById: admin.id,
    },
  });
  for (const item of uploaded) {
    await putFile(admin.organizationId, `org/${admin.organizationId}/forms/${templateId}/${item.assetId}`, item.bytes, settings);
  }
  const draft = schema(uploaded);
  const versionId = randomUUID();
  await prisma.$transaction([
    ...uploaded.map((item) => prisma.formAsset.create({
      data: {
        id: item.assetId,
        organizationId: admin.organizationId,
        templateId,
        storageKey: `org/${admin.organizationId}/forms/${templateId}/${item.assetId}`,
        filename: item.filename,
        mimeType: "application/pdf",
        sizeBytes: item.bytes.length,
        checksum: createHash("sha256").update(item.bytes).digest("hex"),
        uploadedById: admin.id,
      },
    })),
    prisma.formTemplate.update({
      where: { id: templateId },
      data: { draftSchema: draft as unknown as Prisma.InputJsonValue, status: "PUBLISHED" },
    }),
    prisma.formVersion.create({
      data: {
        id: versionId,
        organizationId: admin.organizationId,
        templateId,
        versionNumber: 1,
        schema: draft as unknown as Prisma.InputJsonValue,
        checksum: createHash("sha256").update(JSON.stringify(draft)).digest("hex"),
        publishedById: admin.id,
      },
    }),
  ]);
  console.log(JSON.stringify({ formId: templateId, versionId, status: "PUBLISHED", created: true, files: uploaded.map((item) => item.filename) }));
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The form could not be created.");
  process.exit(1);
});
