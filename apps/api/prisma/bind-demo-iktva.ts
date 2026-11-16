import { createHash } from "node:crypto";
import { PrismaClient, type AssignmentStatus } from "@prisma/client";
import { formSchemaDefinition, type FormField } from "@vmp/shared";
import { assignVendorCategoryNames } from "../src/catalog/categories";

const prisma = new PrismaClient();

const EVENT_CODE = "1KT";
const EVENT_NAME = "IKTVA2027";
const FORM_NAME = "Mandatory design documents";

type DemoVendor = {
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  categories: string[];
  status: AssignmentStatus;
  daysAgo: number;
  deadlineInDays: number | null;
  blurb: string;
  booth: string;
  correctionNote?: string;
};

const vendors: DemoVendor[] = [
  {
    reference: "VND-LUMEN",
    companyName: "Lumen & Co. Lighting",
    contactName: "Huda Al Marzouqi",
    email: "huda.marzouqi@lumenandco.ae",
    phone: "+971 2 441 9033",
    website: "https://www.lumenandco.ae",
    addressLine1: "Office 506, Al Wahda Tower",
    city: "Abu Dhabi",
    region: "Abu Dhabi",
    postalCode: "109808",
    categories: ["Lighting"],
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 2,
    deadlineInDays: 6,
    blurb: "Track, pendant, and facade lighting packages for exhibitor stands across halls A and B.",
    booth: "B-04",
  },
  {
    reference: "VND-GULFPLATE",
    companyName: "Gulf Plate Catering LLC",
    contactName: "Rami Nassar",
    email: "rami.nassar@gulfplate.ae",
    phone: "+971 6 574 2201",
    website: "https://www.gulfplate.ae",
    addressLine1: "Kitchen 3, Al Nahda Street",
    city: "Sharjah",
    region: "Sharjah",
    postalCode: "61111",
    categories: ["Catering"],
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 1,
    deadlineInDays: 4,
    blurb: "Hot and cold hospitality for exhibitor lounges, including halal and vegetarian menus.",
    booth: "H-18",
  },
  {
    reference: "VND-HORIZON",
    companyName: "Horizon AV Systems FZCO",
    contactName: "Daniel Okonkwo",
    email: "daniel.okonkwo@horizonav.ae",
    phone: "+971 4 514 6620",
    website: "https://www.horizonav.ae",
    addressLine1: "Office 1204, Aspect Tower, Business Bay",
    city: "Dubai",
    region: "Dubai",
    postalCode: "113234",
    categories: ["Audio visual"],
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 1,
    deadlineInDays: 5,
    blurb: "LED walls, PA systems, and presentation kits with an on-site technician for product demos.",
    booth: "B-16",
  },
  {
    reference: "VND-BRIGHTLINE",
    companyName: "Brightline Signage & Print",
    contactName: "Noor Al Suwaidi",
    email: "noor.suwaidi@brightlinesign.ae",
    phone: "+971 6 742 1184",
    website: "https://www.brightlinesign.ae",
    addressLine1: "Unit 8, Ajman Free Zone",
    city: "Ajman",
    region: "Ajman",
    postalCode: "30000",
    categories: ["Signage and print"],
    status: "SUBMITTED_PENDING_REVIEW",
    daysAgo: 2,
    deadlineInDays: 3,
    blurb: "Fascia lettering, fabric lightboxes, and floor graphics produced in-house overnight.",
    booth: "A-07",
  },
  {
    reference: "VND-MARINA",
    companyName: "Marina Booth Works LLC",
    contactName: "Omar Al Hashimi",
    email: "omar.hashimi@marinabooth.ae",
    phone: "+971 4 355 2180",
    website: "https://www.marinabooth.ae",
    addressLine1: "Warehouse 14, Al Quoz Industrial Area 3",
    city: "Dubai",
    region: "Dubai",
    postalCode: "26100",
    categories: ["Stand building", "Electrical"],
    status: "APPROVED",
    daysAgo: 16,
    deadlineInDays: null,
    blurb: "Custom double-deck stands with in-house joinery. Eight technicians cover build-up and dismantle.",
    booth: "A-12",
  },
  {
    reference: "VND-SANDCEDAR",
    companyName: "Sand & Cedar Furniture Trading",
    contactName: "Yousef Rahman",
    email: "yousef.rahman@sandcedar.ae",
    phone: "+971 4 228 7715",
    website: "https://www.sandcedar.ae",
    addressLine1: "Showroom 2, Al Ittihad Road",
    city: "Dubai",
    region: "Dubai",
    postalCode: "124511",
    categories: ["Furniture"],
    status: "APPROVED",
    daysAgo: 12,
    deadlineInDays: null,
    blurb: "Lounge furniture hire including sofas, counters, and oak meeting tables finished for exhibition use.",
    booth: "C-21",
  },
  {
    reference: "VND-QASR",
    companyName: "Qasr Flooring Systems",
    contactName: "Leila Haddad",
    email: "leila.haddad@qasrflooring.ae",
    phone: "+971 6 555 0192",
    website: "https://www.qasflooring.ae",
    addressLine1: "Warehouse B, Industrial Area 10",
    city: "Sharjah",
    region: "Sharjah",
    postalCode: "61321",
    categories: ["Flooring"],
    status: "APPROVED",
    daysAgo: 14,
    deadlineInDays: null,
    blurb: "Raised platform floors and carpet tiles with cable-managed walkways for aisle transitions.",
    booth: "C-03",
  },
  {
    reference: "VND-PEARL",
    companyName: "Pearl Guard Security Services",
    contactName: "Majid Al Kaabi",
    email: "majid.kaabi@pearlguard.ae",
    phone: "+971 2 641 8800",
    website: "https://www.pearlguard.ae",
    addressLine1: "Office 214, Al Markaziyah",
    city: "Abu Dhabi",
    region: "Abu Dhabi",
    postalCode: "3798",
    categories: ["Security"],
    status: "APPROVED",
    daysAgo: 11,
    deadlineInDays: null,
    blurb: "Licensed event security, night guarding, and access control for exhibitor stands.",
    booth: "S-08",
  },
  {
    reference: "VND-ATLAS",
    companyName: "Atlas Freight Logistics",
    contactName: "Sara Qureshi",
    email: "sara.qureshi@atlasfreight.ae",
    phone: "+971 4 881 6400",
    website: "https://www.atlasfreight.ae",
    addressLine1: "Plot 22, Jebel Ali Industrial Area",
    city: "Dubai",
    region: "Dubai",
    postalCode: "17000",
    categories: ["Logistics"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 6,
    deadlineInDays: 2,
    blurb: "Door-to-stand freight, customs clearance, and empty-case storage for exhibitors.",
    booth: "D-09",
    correctionNote: "Please re-upload your customs brokerage authorization on company letterhead.",
  },
  {
    reference: "VND-CRESCENT",
    companyName: "Crescent Print Studio",
    contactName: "Faris Al Mulla",
    email: "faris.mulla@crescentprint.ae",
    phone: "+971 4 398 2217",
    website: "https://www.crescentprint.ae",
    addressLine1: "Unit 6, Ras Al Khor Industrial 2",
    city: "Dubai",
    region: "Dubai",
    postalCode: "47400",
    categories: ["Signage and print"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 3,
    deadlineInDays: 3,
    blurb: "Large-format fabric print, vinyl wraps, and booth graphics finished overnight.",
    booth: "P-11",
    correctionNote: "Upload a higher-resolution copy of the signed stand drawings for compliance review.",
  },
  {
    reference: "VND-NIMBUS",
    companyName: "Nimbus Event Security",
    contactName: "Khalid Al Blooshi",
    email: "khalid.blooshi@nimbussecurity.ae",
    phone: "+971 2 667 4410",
    website: "https://www.nimbussecurity.ae",
    addressLine1: "Building 19, Mussafah Industrial",
    city: "Abu Dhabi",
    region: "Abu Dhabi",
    postalCode: "20600",
    categories: ["Security"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 5,
    deadlineInDays: 2,
    blurb: "Event security and overnight stand guarding with SIRA-compliant officers.",
    booth: "S-01",
    correctionNote: "Please re-upload a clear PDF of your trade license. The previous scan is cropped and the expiry date is unreadable.",
  },
  {
    reference: "VND-BAYAN",
    companyName: "Bayan Hosts & Interiors",
    contactName: "Lina Mansour",
    email: "lina.mansour@bayanhosts.ae",
    phone: "+971 4 452 9088",
    website: "https://www.bayanhosts.ae",
    addressLine1: "Office 903, Jumeirah Bay Tower X3",
    city: "Dubai",
    region: "Dubai",
    postalCode: "124600",
    categories: ["Stand building", "Furniture"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 4,
    deadlineInDays: 3,
    blurb: "Host teams and furnished meeting rooms fitted inside the exhibitor stand.",
    booth: "A-19",
    correctionNote: "Please upload an updated public liability insurance certificate covering the show dates.",
  },
  {
    reference: "VND-SAFFRON",
    companyName: "Saffron & Salt Hospitality",
    contactName: "Amina Farooq",
    email: "amina.farooq@saffronsalt.ae",
    phone: "+971 4 294 7730",
    website: "https://www.saffronsalt.ae",
    addressLine1: "Kitchen 11, Al Quoz 1",
    city: "Dubai",
    region: "Dubai",
    postalCode: "26111",
    categories: ["Catering"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 2,
    deadlineInDays: 4,
    blurb: "Coffee-service counters and tasting menus for exhibitor meeting lounges.",
    booth: "H-06",
    correctionNote: "Re-upload your municipality food-handler certificates for the named kitchen team.",
  },
  {
    reference: "VND-EMIRATELECT",
    companyName: "Emiratelect Power Solutions",
    contactName: "Hassan Al Shehhi",
    email: "hassan.shehhi@emiratelect.ae",
    phone: "+971 7 233 4800",
    website: "https://www.emiratelect.ae",
    addressLine1: "Shop 15, Al Nakheel",
    city: "Ras Al Khaimah",
    region: "Ras Al Khaimah",
    postalCode: "72500",
    categories: ["Electrical"],
    status: "CORRECTION_REQUESTED",
    daysAgo: 7,
    deadlineInDays: 1,
    blurb: "Temporary power distribution and certified electricians for stand fit-out.",
    booth: "E-14",
    correctionNote: "The trade license PDF is password-protected. Please upload an unlocked copy.",
  },
  {
    reference: "VND-OASISFLORAL",
    companyName: "Oasis Floral Design",
    contactName: "Maya Fernandes",
    email: "maya.fernandes@oasisfloral.ae",
    phone: "+971 4 330 9055",
    website: "https://www.oasisfloral.ae",
    addressLine1: "Shop 4, Al Wasl Road",
    city: "Dubai",
    region: "Dubai",
    postalCode: "127221",
    categories: ["Florals"],
    status: "IN_PROGRESS",
    daysAgo: 3,
    deadlineInDays: 8,
    blurb: "Fresh and dried arrangements for reception desks and evening receptions.",
    booth: "F-02",
  },
  {
    reference: "VND-DESERTLINE",
    companyName: "Desertline Stand Builders",
    contactName: "Tariq Al Mazrouei",
    email: "tariq.mazrouei@desertline.ae",
    phone: "+971 4 885 1102",
    website: "https://www.desertline.ae",
    addressLine1: "Plot 41, Dubai Investment Park 1",
    city: "Dubai",
    region: "Dubai",
    postalCode: "282222",
    categories: ["Stand building"],
    status: "IN_PROGRESS",
    daysAgo: 2,
    deadlineInDays: 9,
    blurb: "Shell-scheme upgrades and custom modular stands for mid-size exhibitors.",
    booth: "A-28",
  },
  {
    reference: "VND-CLEARSOUND",
    companyName: "Clearsound Productions",
    contactName: "Elena Petrova",
    email: "elena.petrova@clearsound.ae",
    phone: "+971 4 368 4421",
    website: "https://www.clearsound.ae",
    addressLine1: "Warehouse 9, Al Quoz 4",
    city: "Dubai",
    region: "Dubai",
    postalCode: "37555",
    categories: ["Audio visual"],
    status: "IN_PROGRESS",
    daysAgo: 4,
    deadlineInDays: 7,
    blurb: "Stage audio, wireless microphones, and compact LED screens for product demos.",
    booth: "B-22",
  },
  {
    reference: "VND-GOLDENSPOON",
    companyName: "Golden Spoon Culinary",
    contactName: "Karim Haddad",
    email: "karim.haddad@goldenspoon.ae",
    phone: "+971 4 277 6509",
    website: "https://www.goldenspoon.ae",
    addressLine1: "Kitchen Suite 5, Dubai Production City",
    city: "Dubai",
    region: "Dubai",
    postalCode: "478828",
    categories: ["Catering"],
    status: "INVITED",
    daysAgo: 1,
    deadlineInDays: 11,
    blurb: "Live cooking counters and plated hospitality for VIP exhibitor lounges.",
    booth: "H-12",
  },
  {
    reference: "VND-NORTHSTAR",
    companyName: "Northstar Lighting Hire",
    contactName: "Priya Menon",
    email: "priya.menon@northstarlight.ae",
    phone: "+971 4 321 7780",
    website: "https://www.northstarlight.ae",
    addressLine1: "Unit 12, Dubai Industrial City",
    city: "Dubai",
    region: "Dubai",
    postalCode: "3004",
    categories: ["Lighting"],
    status: "INVITED",
    daysAgo: 3,
    deadlineInDays: 10,
    blurb: "Architectural lighting kits and DMX control for branded exhibitor environments.",
    booth: "B-09",
  },
  {
    reference: "VND-SILKROUTE",
    companyName: "Silk Route Logistics DWC",
    contactName: "Ahmed Mansoor",
    email: "ahmed.mansoor@silkroutelogistics.ae",
    phone: "+971 4 870 3355",
    website: "https://www.silkroutelogistics.ae",
    addressLine1: "Warehouse A4, Dubai South Logistics District",
    city: "Dubai",
    region: "Dubai",
    postalCode: "390667",
    categories: ["Logistics"],
    status: "INVITED",
    daysAgo: 2,
    deadlineInDays: 13,
    blurb: "Air freight handling, on-site delivery, and return shipping for exhibition cargo.",
    booth: "D-17",
  },
];

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function answerFor(field: FormField, vendor: DemoVendor, index: number): unknown {
  if (field.type === "email") return vendor.email;
  if (field.type === "tel") return vendor.phone;
  if (field.type === "url") return vendor.website;
  if (field.type === "number") return 12 + index;
  if (field.type === "currency") return 4800 + index * 250;
  if (field.type === "date") return "2026-12-30";
  if (field.type === "time") return "09:30";
  if (field.type === "datetime") return "2026-12-30T18:40:00.000Z";
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
  if (field.type === "file" || field.type === "image" || field.type === "files" || field.type === "reupload") return undefined;
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
    if (["heading", "info", "file", "image", "files", "reupload"].includes(field.type)) continue;
    if (field.type === "repeater") {
      values[field.id] = [];
      continue;
    }
    values[field.id] = answerFor(field, vendor, index);
  }
  return values;
}

async function main() {
  if (vendors.length !== 20) throw new Error(`Expected 20 companies, found ${vendors.length}.`);

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const organization = await tx.organization.findUnique({ where: { slug: "vehda" } });
    if (!organization) throw new Error("Organization not found. Run prisma:seed first.");
    const admin = await tx.user.findFirst({
      where: { organizationId: organization.id, status: "ACTIVE", roles: { some: { role: { name: "ORG_ADMIN" } } } },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new Error("Organization admin not found.");

    const exhibition =
      (await tx.exhibition.findFirst({
        where: {
          organizationId: organization.id,
          status: { not: "ARCHIVED" },
          OR: [{ code: { equals: EVENT_CODE, mode: "insensitive" } }, { name: { equals: EVENT_NAME, mode: "insensitive" } }],
        },
      })) ??
      (await tx.exhibition.findFirst({
        where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
      }));
    if (!exhibition) throw new Error(`Event ${EVENT_NAME} (${EVENT_CODE}) was not found.`);

    const form =
      (await tx.formTemplate.findFirst({
        where: { organizationId: organization.id, archivedAt: null, name: { equals: FORM_NAME, mode: "insensitive" } },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      })) ?? null;
    if (!form?.versions[0]) throw new Error(`Published form "${FORM_NAME}" was not found.`);
    const version = form.versions[0];
    const fields = formSchemaDefinition.parse(version.schema).fields;
    const textField = fields.find((item) => item.type === "text");
    const fileField = fields.find((item) => item.type === "file" || item.type === "reupload" || item.type === "files");

    // Keep demo companies on this one event + form only.
    const demoRefs = vendors.map((item) => item.reference);
    const existingDemo = await tx.vendor.findMany({
      where: { organizationId: organization.id, reference: { in: demoRefs } },
      select: { id: true },
    });
    if (existingDemo.length) {
      await tx.formAssignment.updateMany({
        where: {
          organizationId: organization.id,
          vendorId: { in: existingDemo.map((item) => item.id) },
          OR: [{ exhibitionId: { not: exhibition.id } }, { formVersionId: { not: version.id } }],
          status: { not: "REVOKED" },
        },
        data: { status: "REVOKED" },
      });
      await tx.vendorExhibition.deleteMany({
        where: {
          organizationId: organization.id,
          vendorId: { in: existingDemo.map((item) => item.id) },
          exhibitionId: { not: exhibition.id },
        },
      });
    }

    let created = 0;
    let updated = 0;
    for (const [index, vendor] of vendors.entries()) {
      const createdAt = daysFromNow(-vendor.daysAgo);
      const submitted = ["SUBMITTED_PENDING_REVIEW", "RESUBMITTED_PENDING_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED"].includes(vendor.status);
      let row = await tx.vendor.findFirst({ where: { organizationId: organization.id, reference: vendor.reference } });
      if (!row) row = await tx.vendor.findFirst({ where: { organizationId: organization.id, email: vendor.email } });
      if (row) {
        row = await tx.vendor.update({
          where: { id: row.id },
          data: {
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
            archivedAt: null,
          },
        });
        updated += 1;
      } else {
        row = await tx.vendor.create({
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
        created += 1;
      }
      await assignVendorCategoryNames(tx, organization.id, row.id, vendor.categories);
      await tx.vendorExhibition.upsert({
        where: { vendorId_exhibitionId: { vendorId: row.id, exhibitionId: exhibition.id } },
        update: {},
        create: { organizationId: organization.id, vendorId: row.id, exhibitionId: exhibition.id, createdAt },
      });

      let assignment = await tx.formAssignment.findFirst({
        where: { organizationId: organization.id, vendorId: row.id, exhibitionId: exhibition.id, formVersionId: version.id },
      });
      if (!assignment) {
        assignment = await tx.formAssignment.create({
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
      } else {
        assignment = await tx.formAssignment.update({
          where: { id: assignment.id },
          data: {
            status: vendor.status,
            deadline: vendor.deadlineInDays === null ? null : daysFromNow(vendor.deadlineInDays),
            submittedAt: submitted ? daysFromNow(-Math.max(vendor.daysAgo - 1, 0)) : null,
            approvedAt: vendor.status === "APPROVED" ? daysFromNow(-Math.max(vendor.daysAgo - 2, 0)) : null,
            approvedById: vendor.status === "APPROVED" ? admin.id : null,
          },
        });
      }

      if (vendor.status === "INVITED") continue;

      let submission = await tx.submission.findUnique({ where: { assignmentId: assignment.id } });
      if (!submission) {
        submission = await tx.submission.create({
          data: { organizationId: organization.id, assignmentId: assignment.id, createdAt },
        });
      }
      const revisionData = answersFor(fields, vendor, index);
      let revision = await tx.submissionRevision.findFirst({ where: { submissionId: submission.id, revisionNumber: 1 } });
      if (!revision) {
        revision = await tx.submissionRevision.create({
          data: {
            organizationId: organization.id,
            submissionId: submission.id,
            formVersionId: version.id,
            revisionNumber: 1,
            data: revisionData,
            createdById: admin.id,
            createdAt,
          },
        });
      } else {
        revision = await tx.submissionRevision.update({ where: { id: revision.id }, data: { data: revisionData, formVersionId: version.id } });
      }

      await tx.correctionRequest.updateMany({
        where: { submissionId: submission.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
      if (vendor.status === "CORRECTION_REQUESTED" && (fileField || textField)) {
        const note = vendor.correctionNote ?? "Please re-upload the requested compliance document so we can complete verification.";
        await tx.correctionRequest.create({
          data: {
            organizationId: organization.id,
            submissionId: submission.id,
            revisionId: revision.id,
            status: "OPEN",
            requestedById: admin.id,
            createdAt: daysFromNow(-1),
            fields: {
              create: [{ organizationId: organization.id, fieldId: (fileField ?? textField)!.id, note }],
            },
          },
        });
      }
      await tx.submission.update({ where: { id: submission.id }, data: { currentRevisionId: revision.id } });
      if (vendor.status === "APPROVED") {
        await tx.formAssignment.update({ where: { id: assignment.id }, data: { approvedRevisionId: revision.id } });
      }
    }

    const linked = await tx.vendorExhibition.count({
      where: { organizationId: organization.id, exhibitionId: exhibition.id, vendor: { reference: { in: demoRefs }, archivedAt: null } },
    });
    const assigned = await tx.formAssignment.groupBy({
      by: ["status"],
      where: {
        organizationId: organization.id,
        exhibitionId: exhibition.id,
        formVersionId: version.id,
        vendor: { reference: { in: demoRefs }, archivedAt: null },
      },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(assigned.map((row) => [row.status, row._count._all]));
    return {
      event: { id: exhibition.id, code: exhibition.code, name: exhibition.name },
      form: { id: form.id, name: form.name, version: version.versionNumber },
      created,
      updated,
      linkedToEvent: linked,
      waitingForReview: byStatus.SUBMITTED_PENDING_REVIEW ?? 0,
      verified: byStatus.APPROVED ?? 0,
      reuploadRequested: byStatus.CORRECTION_REQUESTED ?? 0,
      inProgress: byStatus.IN_PROGRESS ?? 0,
      invited: byStatus.INVITED ?? 0,
      checksum: createHash("sha256").update(JSON.stringify(version.schema)).digest("hex").slice(0, 12),
    };
  }, { maxWait: 20_000, timeout: 180_000 });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Could not bind companies to IKTVA event/form.");
    await prisma.$disconnect();
    process.exit(1);
  });
