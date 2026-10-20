import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { toCsv, VENDOR_IMPORT_COLUMNS } from "@vmp/shared";
import { parse } from "csv-parse";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { AuthContext } from "../common/auth";
import { env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService } from "../prisma/prisma.service";

const rowSchema = z.object({
  reference: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  companyName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(200),
  email: z.string().email(),
  additionalEmails: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  region: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  country: z.string().optional().default(""),
  category: z.string().optional().default(""),
});

@Injectable()
export class ImportsService {
  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  template() {
    const sample = {
      reference: "VND-1001",
      companyName: "Northwind Displays",
      contactName: "Amina Shah",
      email: "amina@northwind.example",
      additionalEmails: "ops@northwind.example",
      phone: "+1-202-555-0101",
      addressLine1: "18 Market Street",
      addressLine2: "",
      city: "Boston",
      region: "MA",
      postalCode: "02110",
      country: "US",
      category: "Booth builder",
    };
    return toCsv([sample], [...VENDOR_IMPORT_COLUMNS]);
  }

  async create(user: AuthContext, file?: { buffer?: Buffer; path?: string; originalname: string; size: number }) {
    if (!file) throw new ConflictException("Choose a CSV or Excel file.");
    if (file.size > env().IMPORT_MAX_BYTES) throw new ConflictException("The import file exceeds the size limit.");
    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith(".csv") && !filename.endsWith(".xlsx")) {
      throw new ConflictException("Upload a .csv or .xlsx file.");
    }
    const buffer = file.buffer ?? (file.path ? await readFileBuffer(file.path) : undefined);
    if (!buffer) throw new ConflictException("The import file could not be read.");
    const importLimit = await this.tenant.transaction(user.organizationId, async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: user.organizationId }, select: { settings: true } });
      return effectiveSettings(parseStored(organization?.settings)).importMaxRows;
    });
    const rows = filename.endsWith(".csv") ? await parseCsvStream(buffer, importLimit) : await parseXlsx(buffer, importLimit);
    const header = rows.length ? Object.keys(rows[0]) : [];
    const missing = VENDOR_IMPORT_COLUMNS.filter((column) => !header.includes(column));
    if (missing.length) throw new ConflictException(`The file is missing columns: ${missing.join(", ")}`);
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    const job = await this.tenant.transaction(user.organizationId, async (tx) => {
      const created = await tx.importJob.create({
        data: {
          organizationId: user.organizationId,
          createdById: user.id,
          filename: file.originalname.replace(/[^\w.\- ]+/g, "_").slice(0, 180),
          fileSha256,
          status: "PROCESSING",
          totalRows: rows.length,
        },
      });
      const seenEmails = new Set<string>();
      const seenReferences = new Set<string>();
      let createdCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const parsed = rowSchema.safeParse(row);
        if (!parsed.success) {
          errorCount += 1;
          await tx.importJobRow.create({
            data: {
              organizationId: user.organizationId,
              importJobId: created.id,
              rowNumber,
              status: "ERROR",
              payload: row,
              messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
            },
          });
          continue;
        }
        const email = parsed.data.email.toLowerCase();
        const reference = parsed.data.reference;
        if (seenEmails.has(email) || seenReferences.has(reference)) {
          errorCount += 1;
          await tx.importJobRow.create({
            data: {
              organizationId: user.organizationId,
              importJobId: created.id,
              rowNumber,
              status: "ERROR",
              payload: row,
              messages: ["Duplicate reference or email inside this file."],
            },
          });
          continue;
        }
        seenEmails.add(email);
        seenReferences.add(reference);
        const existing = await tx.vendor.findFirst({
          where: { organizationId: user.organizationId, OR: [{ email }, { reference }] },
        });
        if (existing) {
          skippedCount += 1;
          await tx.importJobRow.create({
            data: {
              organizationId: user.organizationId,
              importJobId: created.id,
              rowNumber,
              status: "SKIPPED",
              payload: row,
              messages: ["A vendor with this email or reference already exists."],
              vendorId: existing.id,
            },
          });
          continue;
        }
        const vendor = await tx.vendor.create({
          data: {
            organizationId: user.organizationId,
            reference,
            companyName: parsed.data.companyName,
            contactName: parsed.data.contactName,
            email,
            additionalEmails: parsed.data.additionalEmails.split(/[;,]/).map((item) => item.trim().toLowerCase()).filter(Boolean),
            phone: parsed.data.phone,
            addressLine1: parsed.data.addressLine1,
            addressLine2: parsed.data.addressLine2,
            city: parsed.data.city,
            region: parsed.data.region,
            postalCode: parsed.data.postalCode,
            country: parsed.data.country.toUpperCase(),
            category: parsed.data.category,
          },
        });
        createdCount += 1;
        await tx.importJobRow.create({
          data: {
            organizationId: user.organizationId,
            importJobId: created.id,
            rowNumber,
            status: "CREATED",
            payload: row,
            vendorId: vendor.id,
          },
        });
      }
      const finished = await tx.importJob.update({
        where: { id: created.id },
        data: { status: "COMPLETED", createdCount, skippedCount, errorCount, completedAt: new Date() },
      });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "vendors.imported",
        resourceType: "import_job",
        resourceId: created.id,
        newValue: { createdCount, skippedCount, errorCount },
      });
      return finished;
    });
    if (file.path) await rm(file.path, { force: true });
    return { data: job };
  }

  async get(user: AuthContext, id: string) {
    const job = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.importJob.findFirst({
        where: { id, organizationId: user.organizationId },
        include: { rows: { orderBy: { rowNumber: "asc" }, take: 200 } },
      }),
    );
    if (!job) throw new NotFoundException();
    return { data: job };
  }

  async list(user: AuthContext) {
    const jobs = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.importJob.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, take: 25 }),
    );
    return { data: jobs };
  }

  async errorReport(user: AuthContext, id: string) {
    const rows = await this.tenant.transaction(user.organizationId, (tx) =>
      tx.importJobRow.findMany({ where: { importJobId: id, organizationId: user.organizationId, status: "ERROR" }, orderBy: { rowNumber: "asc" } }),
    );
    const flat = rows.map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      return { rowNumber: row.rowNumber, messages: row.messages.join("; "), ...payload };
    });
    return toCsv(flat, ["rowNumber", "messages", ...VENDOR_IMPORT_COLUMNS]);
  }
}

async function parseCsvStream(buffer: Buffer, maxRows: number) {
  const records: Record<string, string>[] = [];
  const parser = Readable.from(buffer).pipe(parse({ columns: true, trim: true, skip_empty_lines: true, relax_column_count: true, bom: true }));
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    records.push(row);
    if (records.length > maxRows) throw new ConflictException(`Imports are limited to ${maxRows} rows.`);
  }
  return records;
}

async function parseXlsx(buffer: Buffer, maxRows: number) {
  const directory = await mkdtemp(path.join(tmpdir(), "vmp-import-"));
  const filePath = path.join(directory, "import.xlsx");
  await writeFile(filePath, buffer);
  const rows: Record<string, string>[] = [];
  try {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { entries: "emit", sharedStrings: "cache", worksheets: "emit" });
    for await (const worksheet of reader) {
      let headers: string[] = [];
      for await (const row of worksheet) {
        const values = row.values as unknown[];
        if (!headers.length) {
          headers = values.map((value) => String(value ?? "").trim());
          continue;
        }
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (!header) return;
          record[header] = String(values[index] ?? "").trim();
        });
        if (Object.values(record).some(Boolean)) rows.push(record);
        if (rows.length > maxRows) throw new ConflictException(`Imports are limited to ${maxRows} rows.`);
      }
      break;
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return rows;
}

async function readFileBuffer(filePath: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(filePath)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
