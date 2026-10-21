import { createHash, randomUUID } from "node:crypto";
import { PrismaClient, type AssignmentStatus } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";
import { assignVendorCategoryNames } from "../src/catalog/categories";

const prisma = new PrismaClient();

const categoryNames = [
  "Stand building",
  "Lighting",
  "Audio visual",
  "Catering",
  "Furniture",
  "Signage and print",
  "Logistics",
  "Electrical",
  "Florals",
  "Security",
  "Flooring",
];

type DemoVendor = {
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  categories: string[];
  exhibitionCode: string;
  status: AssignmentStatus;
  daysAgo: number;
  deadlineInDays: number | null;
  blurb: string;
  booth: string;
};

const vendors: DemoVendor[] = [
  {
    reference: "VND-MARINA",
    companyName: "Marina Booth Works",
    contactName: "Omar Al Hashimi",
    email: "omar.hashimi@marinabooth.example",
    phone: "+971 4 355 2180",
    addressLine1: "Warehouse 14, Al Quoz Industrial Area 3",
    city: "Dubai",
    region: "Dubai",
    postalCode: "26100",
    categories: ["Stand building", "Electrical"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "APPROVED",
    daysAgo: 16,
    deadlineInDays: null,
    blurb: "Double-deck stands with in-house joinery. Crew of eight on site for build and dismantle.",
    booth: "A-12",
  },
  {
    reference: "VND-LUMEN",
    companyName: "Lumen & Co. Lighting",
    contactName: "Huda Al Marzouqi",
    email: "huda.marzouqi@lumenandco.example",
    phone: "+971 2 441 9033",
    addressLine1: "Office 506, Al Wahda Tower",
    city: "Abu Dhabi",
    region: "Abu Dhabi",
    postalCode: "109808",
    categories: ["Lighting"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 2,
    deadlineInDays: 6,
    blurb: "Track, pendant, and facade lighting packages for exhibitor stands.",
    booth: "B-04",
  },
  {
    reference: "VND-GULFPLATE",
    companyName: "Gulf Plate Catering",
    contactName: "Rami Nassar",
    email: "rami.nassar@gulfplate.example",
    phone: "+971 6 574 2201",
    addressLine1: "Kitchen 3, Al Nahda Street",
    city: "Sharjah",
    region: "Sharjah",
    postalCode: "61111",
    categories: ["Catering"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 1,
    deadlineInDays: 4,
    blurb: "Hot and cold hospitality for exhibitor lounges, including halal and vegetarian service.",
    booth: "H-18",
  },
  {
    reference: "VND-ATLAS",
    companyName: "Atlas Freight Logistics",
    contactName: "Sara Qureshi",
    email: "sara.qureshi@atlasfreight.example",
    phone: "+971 4 881 6400",
    addressLine1: "Plot 22, Jebel Ali Industrial Area",
    city: "Dubai",
    region: "Dubai",
    postalCode: "17000",
    categories: ["Logistics"],
    exhibitionCode: "WOC-2027",
    status: "IN_PROGRESS",
    daysAgo: 6,
    deadlineInDays: 5,
    blurb: "Door-to-stand freight, customs clearance, and empty-case storage.",
    booth: "D-09",
  },
  {
    reference: "VND-SANDCEDAR",
    companyName: "Sand & Cedar Furniture",
    contactName: "Yousef Rahman",
    email: "yousef.rahman@sandcedar.example",
    phone: "+971 4 228 7715",
    addressLine1: "Showroom 2, Al Ittihad Road",
    city: "Dubai",
    region: "Dubai",
    postalCode: "124511",
    categories: ["Furniture"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "APPROVED",
    daysAgo: 12,
    deadlineInDays: null,
    blurb: "Lounge furniture hire: sofas, counters, and meeting tables finished in oak and walnut.",
    booth: "C-21",
  },
  {
    reference: "VND-BRIGHTLINE",
    companyName: "Brightline Signage",
    contactName: "Noor Al Suwaidi",
    email: "noor.suwaidi@brightline.example",
    phone: "+971 6 742 1184",
    addressLine1: "Unit 8, Ajman Free Zone",
    city: "Ajman",
    region: "Ajman",
    postalCode: "30000",
    categories: ["Signage and print"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "CORRECTION_REQUESTED",
    daysAgo: 4,
    deadlineInDays: -1,
    blurb: "Fascia lettering, fabric lightboxes, and floor stickers produced in house.",
    booth: "A-07",
  },
  {
    reference: "VND-HORIZON",
    companyName: "Horizon AV Systems",
    contactName: "Daniel Okonkwo",
    email: "daniel.okonkwo@horizonav.example",
    phone: "+971 4 514 6620",
    addressLine1: "Office 1204, Aspect Tower, Business Bay",
    city: "Dubai",
    region: "Dubai",
    postalCode: "113234",
    categories: ["Audio visual"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "RESUBMITTED_PENDING_REVIEW",
    daysAgo: 3,
    deadlineInDays: 3,
    blurb: "LED walls, PA, and presentation laptops with an on-site technician.",
    booth: "B-16",
  },
  {
    reference: "VND-PALMCOURT",
    companyName: "Palm Court Florals",
    contactName: "Maya Fernandes",
    email: "maya.fernandes@palmcourt.example",
    phone: "+971 4 330 9055",
    addressLine1: "Shop 4, Al Wasl Road",
    city: "Dubai",
    region: "Dubai",
    postalCode: "127221",
    categories: ["Florals"],
    exhibitionCode: "WOC-2027",
    status: "INVITED",
    daysAgo: 1,
    deadlineInDays: 10,
    blurb: "Fresh and dried arrangements for reception desks and evening receptions.",
    booth: "F-02",
  },
  {
    reference: "VND-NIMBUS",
    companyName: "Nimbus Security Services",
    contactName: "Khalid Al Blooshi",
    email: "khalid.blooshi@nimbussecurity.example",
    phone: "+971 2 667 4410",
    addressLine1: "Building 19, Mussafah Industrial",
    city: "Abu Dhabi",
    region: "Abu Dhabi",
    postalCode: "20600",
    categories: ["Security"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "IN_PROGRESS",
    daysAgo: 5,
    deadlineInDays: 7,
    blurb: "Licensed event security and overnight stand guarding.",
    booth: "S-01",
  },
  {
    reference: "VND-QASR",
    companyName: "Qasr Flooring",
    contactName: "Leila Haddad",
    email: "leila.haddad@qasrflooring.example",
    phone: "+971 6 555 0192",
    addressLine1: "Warehouse B, Industrial Area 10",
    city: "Sharjah",
    region: "Sharjah",
    postalCode: "61321",
    categories: ["Flooring"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "APPROVED",
    daysAgo: 14,
    deadlineInDays: null,
    blurb: "Raised platform floors and carpet tiles, including cable-managed walkways.",
    booth: "C-03",
  },
  {
    reference: "VND-SAFFRON",
    companyName: "Saffron & Salt Catering",
    contactName: "Amina Farooq",
    email: "amina.farooq@saffronsalt.example",
    phone: "+971 4 294 7730",
    addressLine1: "Kitchen 11, Al Quoz 1",
    city: "Dubai",
    region: "Dubai",
    postalCode: "26111",
    categories: ["Catering"],
    exhibitionCode: "WOC-2027",
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 1,
    deadlineInDays: 8,
    blurb: "Coffee-service counters and tasting menus for exhibitor meetings.",
    booth: "H-06",
  },
  {
    reference: "VND-CRESCENT",
    companyName: "Crescent Print Studio",
    contactName: "Faris Al Mulla",
    email: "faris.mulla@crescentprint.example",
    phone: "+971 4 398 2217",
    addressLine1: "Unit 6, Ras Al Khor Industrial 2",
    city: "Dubai",
    region: "Dubai",
    postalCode: "47400",
    categories: ["Signage and print"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "REJECTED",
    daysAgo: 9,
    deadlineInDays: null,
    blurb: "Large-format fabric print. This submission was turned down because the artwork arrived after the print deadline.",
    booth: "P-11",
  },
  {
    reference: "VND-DUNE",
    companyName: "Dune Electrical",
    contactName: "Hassan Al Shehhi",
    email: "hassan.shehhi@duneelectrical.example",
    phone: "+971 7 233 4800",
    addressLine1: "Shop 15, Al Nakheel",
    city: "Ras Al Khaimah",
    region: "Ras Al Khaimah",
    postalCode: "72500",
    categories: ["Electrical"],
    exhibitionCode: "WOC-2027",
    status: "INVITED",
    daysAgo: 8,
    deadlineInDays: -2,
    blurb: "Temporary power distribution and certified electricians for stand fit-out.",
    booth: "E-14",
  },
  {
    reference: "VND-BAYAN",
    companyName: "Bayan Hosts",
    contactName: "Lina Mansour",
    email: "lina.mansour@bayanhosts.example",
    phone: "+971 4 452 9088",
    addressLine1: "Office 903, Jumeirah Bay Tower X3",
    city: "Dubai",
    region: "Dubai",
    postalCode: "124600",
    categories: ["Stand building", "Furniture"],
    exhibitionCode: "DOWNTOWN-2026",
    status: "IN_PROGRESS",
    daysAgo: 4,
    deadlineInDays: 2,
    blurb: "Hostess teams and furnished meeting rooms inside the stand.",
    booth: "A-19",
  },
];

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function answerFor(field: FormField, vendor: DemoVendor, index: number): unknown {
  if (field.type === "email") return vendor.email;
  if (field.type === "tel") return vendor.phone;
  if (field.type === "url") return "https://www.example.com";
  if (field.type === "number") return 12 + index;
  if (field.type === "currency") return 4800 + index * 250;
  if (field.type === "date") return "2026-11-11";
  if (field.type === "time") return "09:30";
  if (field.type === "datetime") return "2026-11-11T05:30:00.000Z";
  if (field.type === "country") return "AE";
  if (field.type === "toggle") return true;
  if (field.type === "select" || field.type === "radio") {
    const options = field.options ?? [];
    return options[index % Math.max(options.length, 1)]?.value ?? vendor.booth;
  }
  if (field.type === "checkbox" || field.type === "multiselect") {
    const option = field.options?.[0];
    return option ? [option.value] : [];
  }
  if (field.type === "textarea") return vendor.blurb;
  const label = `${field.key} ${field.label}`.toLowerCase();
  if (label.includes("booth")) return vendor.booth;
  if (label.includes("company")) return vendor.companyName;
  if (label.includes("contact") || label.includes("name")) return vendor.contactName;
  if (label.includes("phone")) return vendor.phone;
  if (label.includes("city")) return vendor.city;
  return vendor.blurb;
}

function answersFor(fields: FormField[], vendor: DemoVendor, index: number) {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "heading" || field.type === "info" || field.type === "file" || field.type === "image" || field.type === "files") continue;
    if (field.type === "repeater") {
      values[field.id] = [];
      continue;
    }
    values[field.id] = answerFor(field, vendor, index);
  }
  return values;
}

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const organization = await tx.organization.findUnique({ where: { slug: "vehda" } });
    if (!organization) throw new Error("The Vehda organization was not found.");
    const admin = await tx.user.findFirst({
      where: { organizationId: organization.id, roles: { some: { role: { name: "ORG_ADMIN" } } }, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new Error("An organization admin was not found.");

    for (const name of categoryNames) {
      const existing = await tx.vendorCategory.findFirst({
        where: { organizationId: organization.id, name: { equals: name, mode: "insensitive" } },
      });
      if (!existing) await tx.vendorCategory.create({ data: { organizationId: organization.id, name } });
    }

    const labeled = await tx.vendor.findMany({
      where: { organizationId: organization.id, archivedAt: null, category: { not: "" }, categories: { none: {} } },
    });
    for (const vendor of labeled) {
      await assignVendorCategoryNames(tx, organization.id, vendor.id, vendor.category.split(","));
    }

    const exhibitions = [
      {
        code: "DOWNTOWN-2026",
        name: "Downtown Design Dubai 2026",
        venue: "Dubai Design District",
        description: "Design, furniture, and fit-out show. Exhibitor registration is open.",
        startsAt: new Date("2026-11-11T05:00:00.000Z"),
        endsAt: new Date("2026-11-14T15:00:00.000Z"),
      },
      {
        code: "WOC-2027",
        name: "World of Coffee Dubai 2027",
        venue: "Dubai World Trade Centre",
        description: "Coffee producers, equipment, and hospitality suppliers.",
        startsAt: new Date("2027-02-01T05:00:00.000Z"),
        endsAt: new Date("2027-02-03T15:00:00.000Z"),
      },
    ];
    for (const exhibition of exhibitions) {
      await tx.exhibition.upsert({
        where: { organizationId_code: { organizationId: organization.id, code: exhibition.code } },
        update: { name: exhibition.name, venue: exhibition.venue, description: exhibition.description, status: "PUBLISHED" },
        create: { organizationId: organization.id, status: "PUBLISHED", ...exhibition },
      });
    }

    const sectionId = "6a1c0b7e-1f4a-4c2d-9a10-0b5e8f2a11c3";
    const schema = formSchemaDefinition.parse({
      sections: [{ id: sectionId, title: "Stand details", description: "Tell us how you will use the stand.", order: 0 }],
      fields: [
        field(sectionId, "8c2d4e10-6b7a-4f11-9c22-1a2b3c4d5e6f", "company_name", "text", "Company name on the fascia", 0),
        field(sectionId, "9d3e5f21-7c8b-4012-8d33-2b3c4d5e6f70", "booth_number", "text", "Booth number", 1),
        field(sectionId, "ae4f6032-8d9c-4123-9e44-3c4d5e6f7081", "onsite_contact", "text", "On-site contact", 2),
        field(sectionId, "bf507143-9ead-4234-af55-4d5e6f708192", "onsite_phone", "tel", "On-site phone", 3),
        field(sectionId, "c0618254-afbe-4345-b066-5e6f708192a3", "booth_size", "select", "Booth size", 4, ["3x3 m", "3x6 m", "6x6 m", "9x6 m"]),
        field(sectionId, "d1729365-b0cf-4456-8177-6f708192a3b4", "power", "select", "Power requirement", 5, ["None", "13A", "32A", "63A"]),
        field(sectionId, "e283a476-c1d0-4567-9288-708192a3b4c5", "exhibit", "textarea", "What you will exhibit", 6),
        field(sectionId, "f394b587-d2e1-4678-a399-8192a3b4c5d6", "website", "url", "Website", 7, undefined, false),
      ],
    });
    let template = await tx.formTemplate.findFirst({ where: { organizationId: organization.id, name: "Exhibitor registration" } });
    if (!template) {
      template = await tx.formTemplate.create({
        data: {
          organizationId: organization.id,
          name: "Exhibitor registration",
          description: "Stand, power, and on-site contact details for the show.",
          scope: "GLOBAL",
          status: "PUBLISHED",
          draftSchema: schema,
          createdById: admin.id,
        },
      });
    }
    let version = await tx.formVersion.findFirst({ where: { templateId: template.id, versionNumber: 1 } });
    if (!version) {
      version = await tx.formVersion.create({
        data: {
          organizationId: organization.id,
          templateId: template.id,
          versionNumber: 1,
          schema,
          checksum: createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
          publishedById: admin.id,
        },
      });
      await tx.formTemplate.update({ where: { id: template.id }, data: { status: "PUBLISHED", draftSchema: schema } });
    }
    const fields = formSchemaDefinition.parse(version.schema).fields;
    const textField = fields.find((item) => item.type === "text");

    let createdVendors = 0;
    for (const [index, vendor] of vendors.entries()) {
      const existing = await tx.vendor.findFirst({ where: { organizationId: organization.id, email: vendor.email } });
      if (existing) continue;
      const createdAt = daysFromNow(-vendor.daysAgo);
      const row = await tx.vendor.create({
        data: {
          organizationId: organization.id,
          reference: vendor.reference,
          companyName: vendor.companyName,
          contactName: vendor.contactName,
          email: vendor.email,
          phone: vendor.phone,
          addressLine1: vendor.addressLine1,
          city: vendor.city,
          region: vendor.region,
          postalCode: vendor.postalCode,
          country: "AE",
          status: vendor.status === "INVITED" ? "INVITED" : "ACTIVE",
          createdAt,
        },
      });
      await assignVendorCategoryNames(tx, organization.id, row.id, vendor.categories);
      const exhibition = await tx.exhibition.findUniqueOrThrow({
        where: { organizationId_code: { organizationId: organization.id, code: vendor.exhibitionCode } },
      });
      await tx.vendorExhibition.create({
        data: { organizationId: organization.id, vendorId: row.id, exhibitionId: exhibition.id, createdAt },
      });
      const submitted = ["SUBMITTED_PENDING_REVIEW", "RESUBMITTED_PENDING_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED"].includes(vendor.status);
      const assignment = await tx.formAssignment.create({
        data: {
          organizationId: organization.id,
          vendorId: row.id,
          exhibitionId: exhibition.id,
          formVersionId: version.id,
          status: vendor.status,
          deadline: vendor.deadlineInDays === null ? null : daysFromNow(vendor.deadlineInDays),
          submittedAt: submitted ? daysFromNow(-Math.max(vendor.daysAgo - 1, 0)) : null,
          approvedAt: vendor.status === "APPROVED" ? daysFromNow(-Math.max(vendor.daysAgo - 2, 0)) : null,
          approvedById: vendor.status === "APPROVED" ? admin.id : null,
          createdById: admin.id,
          createdAt,
        },
      });
      if (vendor.status !== "INVITED") {
        const submission = await tx.submission.create({
          data: { organizationId: organization.id, assignmentId: assignment.id, createdAt },
        });
        const revision = await tx.submissionRevision.create({
          data: {
            organizationId: organization.id,
            submissionId: submission.id,
            formVersionId: version.id,
            revisionNumber: 1,
            data: answersFor(fields, vendor, index),
            createdById: admin.id,
            createdAt,
          },
        });
        let currentRevisionId = revision.id;
        if (vendor.status === "RESUBMITTED_PENDING_REVIEW" && textField) {
          const correction = await tx.correctionRequest.create({
            data: {
              organizationId: organization.id,
              submissionId: submission.id,
              revisionId: revision.id,
              status: "RESOLVED",
              requestedById: admin.id,
              createdAt: daysFromNow(-vendor.daysAgo),
              resolvedAt: daysFromNow(-1),
              fields: { create: { organizationId: organization.id, fieldId: textField.id, note: "Please use the booth number from the floor plan." } },
            },
          });
          void correction;
          const second = await tx.submissionRevision.create({
            data: {
              organizationId: organization.id,
              submissionId: submission.id,
              formVersionId: version.id,
              revisionNumber: 2,
              data: { ...answersFor(fields, vendor, index), [textField.id]: vendor.booth },
              createdById: admin.id,
              createdAt: daysFromNow(-1),
            },
          });
          currentRevisionId = second.id;
        }
        if (vendor.status === "CORRECTION_REQUESTED" && textField) {
          await tx.correctionRequest.create({
            data: {
              organizationId: organization.id,
              submissionId: submission.id,
              revisionId: revision.id,
              status: "OPEN",
              requestedById: admin.id,
              createdAt: daysFromNow(-1),
              fields: { create: { organizationId: organization.id, fieldId: textField.id, note: "The fascia name does not match the company on the contract. Please confirm it." } },
            },
          });
        }
        await tx.submission.update({ where: { id: submission.id }, data: { currentRevisionId } });
        if (vendor.status === "APPROVED") {
          await tx.formAssignment.update({ where: { id: assignment.id }, data: { approvedRevisionId: currentRevisionId } });
          await tx.reviewNote.create({
            data: {
              organizationId: organization.id,
              submissionId: submission.id,
              authorId: admin.id,
              body: "Stand drawings and the requested power load are accepted.",
              createdAt: daysFromNow(-Math.max(vendor.daysAgo - 2, 0)),
            },
          });
        }
      }
      await tx.emailMessage.create({
        data: {
          organizationId: organization.id,
          toAddress: vendor.email,
          template: "invitation",
          subject: `${exhibition.name}: complete your exhibitor form`,
          status: "SENT",
          idempotencyKey: `demo-invite:${row.id}`,
          createdAt,
        },
      });
      if (submitted) {
        await tx.emailMessage.create({
          data: {
            organizationId: organization.id,
            toAddress: vendor.email,
            template: "submission-ack",
            subject: `We received ${vendor.companyName}'s exhibitor form`,
            status: "SENT",
            idempotencyKey: `demo-ack:${row.id}`,
            createdAt: daysFromNow(-Math.max(vendor.daysAgo - 1, 0)),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: admin.id,
          actorRole: "ORG_ADMIN",
          action: "vendor.created",
          resourceType: "vendor",
          resourceId: row.id,
          vendorId: row.id,
          newValue: { reference: vendor.reference },
          createdAt,
        },
      });
      if (submitted) {
        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            actorId: admin.id,
            actorRole: "ORG_ADMIN",
            action: vendor.status === "APPROVED" ? "submission.approved" : vendor.status === "REJECTED" ? "submission.rejected" : vendor.status === "CORRECTION_REQUESTED" ? "correction.requested" : "assignment.created",
            resourceType: "assignment",
            resourceId: assignment.id,
            vendorId: row.id,
            createdAt: daysFromNow(-Math.max(vendor.daysAgo - 1, 0)),
          },
        });
      }
      if (vendor.status === "SUBMITTED_PENDING_REVIEW" || vendor.status === "RESUBMITTED_PENDING_REVIEW") {
        await tx.notification.create({
          data: {
            organizationId: organization.id,
            userId: admin.id,
            title: `${vendor.companyName} is waiting for review`,
            body: `${vendor.contactName} submitted the exhibitor form for ${exhibition.name}.`,
            link: `/admin/reviews/${assignment.id}`,
            createdAt: daysFromNow(-Math.max(vendor.daysAgo - 1, 0)),
          },
        });
      }
      createdVendors += 1;
    }

    const [vendorCount, categoryCount, exhibitionCount] = await Promise.all([
      tx.vendor.count({ where: { organizationId: organization.id, archivedAt: null } }),
      tx.vendorCategory.count({ where: { organizationId: organization.id } }),
      tx.exhibition.count({ where: { organizationId: organization.id, status: "PUBLISHED" } }),
    ]);
    return { createdVendors, vendorCount, categoryCount, exhibitionCount };
  }, { maxWait: 20_000, timeout: 120_000 });
  console.log(JSON.stringify(summary));
}

function field(sectionId: string, id: string, key: string, type: FormField["type"], label: string, order: number, options?: string[], required = true): FormField {
  return {
    id,
    key,
    type,
    label,
    required,
    sectionId,
    order,
    ...(options ? { options: options.map((option) => ({ value: option, label: option })) } : {}),
  };
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Demo data could not be added.");
    await prisma.$disconnect();
    process.exit(1);
  });
