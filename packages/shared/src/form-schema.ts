import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "tel",
  "number",
  "currency",
  "date",
  "time",
  "datetime",
  "select",
  "multiselect",
  "radio",
  "checkbox",
  "toggle",
  "file",
  "files",
  "reupload",
  "image",
  "url",
  "address",
  "country",
  "heading",
  "info",
  "repeater",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const DISPLAY_ONLY_TYPES: FieldType[] = ["heading", "info"];

const conditionSchema = z.object({
  fieldId: z.string().uuid(),
  operator: z.enum(["eq", "neq", "includes"]),
  value: z.string(),
});

export const fieldSchema: z.ZodType<FormField> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    key: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/, "Use a lowercase internal key."),
    type: z.enum(FIELD_TYPES),
    label: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    required: z.boolean(),
    placeholder: z.string().max(200).optional(),
    defaultValue: z.unknown().optional(),
    options: z
      .array(
        z.object({
          value: z.string().min(1).max(120),
          label: z.string().min(1).max(200),
        }),
      )
      .max(200)
      .optional(),
    validation: z
      .object({
        minLength: z.number().int().nonnegative().optional(),
        maxLength: z.number().int().positive().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().max(200).optional(),
      })
      .optional(),
    file: z
      .object({
        accept: z.array(z.string()).max(20).optional(),
        maxSizeBytes: z.number().int().positive().max(50_000_000).optional(),
        maxFiles: z.number().int().positive().max(20).optional(),
      })
      .optional(),
    template: z
      .object({
        assetId: z.string().uuid(),
        filename: z.string().min(1).max(180),
      })
      .optional(),
    sectionId: z.string().uuid(),
    order: z.number().int().nonnegative(),
    conditional: conditionSchema.nullable().optional(),
    readOnly: z.boolean().optional(),
    children: z.array(fieldSchema).max(30).optional(),
  }),
);

export type FormField = {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  file?: {
    accept?: string[];
    maxSizeBytes?: number;
    maxFiles?: number;
  };
  template?: {
    assetId: string;
    filename: string;
  };
  sectionId: string;
  order: number;
  conditional?: {
    fieldId: string;
    operator: "eq" | "neq" | "includes";
    value: string;
  } | null;
  readOnly?: boolean;
  children?: FormField[];
};

export const formSchemaDefinition = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        order: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(50),
  fields: z.array(fieldSchema).max(300),
});

export type FormSchemaDefinition = z.infer<typeof formSchemaDefinition>;

export class FormValidationError extends Error {
  constructor(
    readonly issues: { fieldId: string; message: string }[],
  ) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "FormValidationError";
  }
}

export class LockedFieldError extends Error {
  constructor(readonly fieldId: string) {
    super(`Field ${fieldId} is locked and cannot be changed.`);
    this.name = "LockedFieldError";
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export type FieldAnswer = { id: string; label: string; filled: boolean };

function hasAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (Array.isArray(value)) return value.some((item) => hasAnswer(item));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("documentId" in record) return Boolean(record.documentId);
    return Object.values(record).some((item) => hasAnswer(item));
  }
  return false;
}

/** Answerable fields on a form, and whether the current answers include a value for each one. */
export function fieldAnswers(schema: FormSchemaDefinition, values: Record<string, unknown>): FieldAnswer[] {
  const byId = new Map<string, FormField>();
  const index = (fields: FormField[]) => {
    for (const field of fields) {
      byId.set(field.id, field);
      if (field.children) index(field.children);
    }
  };
  index(schema.fields);
  const answers: FieldAnswer[] = [];
  for (const field of schema.fields) {
    if (DISPLAY_ONLY_TYPES.includes(field.type)) continue;
    if (!isFieldVisible(field, values, byId)) continue;
    answers.push({ id: field.id, label: field.label, filled: hasAnswer(values[field.id]) });
  }
  return answers;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function isFieldVisible(
  field: FormField,
  values: Record<string, unknown>,
  byId: Map<string, FormField>,
): boolean {
  if (!field.conditional) return true;
  const source = byId.get(field.conditional.fieldId);
  if (!source) return false;
  const current = values[field.conditional.fieldId];
  const expected = field.conditional.value;
  if (field.conditional.operator === "eq") return asText(current) === expected;
  if (field.conditional.operator === "neq") return asText(current) !== expected;
  if (Array.isArray(current)) return current.map(asText).includes(expected);
  return asText(current).split(",").includes(expected);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stable(record[key]);
        return acc;
      }, {});
  }
  return value ?? null;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stable(left ?? null)) === JSON.stringify(stable(right ?? null));
}

export function assertLockedFieldsUnchanged(input: {
  fields: FormField[];
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
  editableFieldIds: ReadonlySet<string>;
}): void {
  const walk = (fields: FormField[]) => {
    for (const field of fields) {
      if (DISPLAY_ONLY_TYPES.includes(field.type)) continue;
      if (input.editableFieldIds.has(field.id)) {
        if (field.type === "repeater" && field.children?.length) {
          continue;
        }
        continue;
      }
      if (!valuesEqual(input.previous[field.id] ?? null, input.next[field.id] ?? null)) {
        throw new LockedFieldError(field.id);
      }
      if (field.type === "repeater" && field.children?.length) {
        const prevRows = Array.isArray(input.previous[field.id]) ? (input.previous[field.id] as Record<string, unknown>[]) : [];
        const nextRows = Array.isArray(input.next[field.id]) ? (input.next[field.id] as Record<string, unknown>[]) : [];
        if (prevRows.length !== nextRows.length) throw new LockedFieldError(field.id);
      }
    }
  };
  walk(input.fields);
  const known = new Set<string>();
  const collect = (fields: FormField[]) => {
    for (const field of fields) {
      known.add(field.id);
      if (field.children) collect(field.children);
    }
  };
  collect(input.fields);
  for (const key of Object.keys(input.next)) {
    if (!known.has(key)) {
      throw new LockedFieldError(key);
    }
  }
}

function validateLeaf(field: FormField, value: unknown, issues: { fieldId: string; message: string }[]) {
  if (DISPLAY_ONLY_TYPES.includes(field.type)) return;
  if (field.required && isEmpty(value)) {
    issues.push({ fieldId: field.id, message: `${field.label} is required.` });
    return;
  }
  if (isEmpty(value)) return;
  const text = asText(value);
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    issues.push({ fieldId: field.id, message: `${field.label} must be an email address.` });
  }
  if (field.type === "url") {
    try {
      const url = new URL(text);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
    } catch {
      issues.push({ fieldId: field.id, message: `${field.label} must be an http(s) URL.` });
    }
  }
  if ((field.type === "number" || field.type === "currency") && Number.isNaN(Number(value))) {
    issues.push({ fieldId: field.id, message: `${field.label} must be a number.` });
  }
  if (field.validation?.minLength && text.length < field.validation.minLength) {
    issues.push({ fieldId: field.id, message: `${field.label} is too short.` });
  }
  if (field.validation?.maxLength && text.length > field.validation.maxLength) {
    issues.push({ fieldId: field.id, message: `${field.label} is too long.` });
  }
  if (field.validation?.pattern) {
    const pattern = new RegExp(field.validation.pattern);
    if (!pattern.test(text)) issues.push({ fieldId: field.id, message: `${field.label} is invalid.` });
  }
  if ((field.type === "select" || field.type === "radio") && field.options?.length) {
    if (!field.options.some((option) => option.value === text)) {
      issues.push({ fieldId: field.id, message: `${field.label} has an unknown option.` });
    }
  }
  if ((field.type === "file" || field.type === "image" || field.type === "reupload") && value) {
    const record = value as { documentId?: string };
    if (!record.documentId) issues.push({ fieldId: field.id, message: `${field.label} is missing a document.` });
  }
  if (field.type === "files" && Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object" || !(item as { documentId?: string }).documentId) {
        issues.push({ fieldId: field.id, message: `${field.label} contains an invalid file.` });
      }
    }
  }
}

export function validateSubmission(input: {
  schema: FormSchemaDefinition;
  values: Record<string, unknown>;
  editableFieldIds?: ReadonlySet<string>;
}): void {
  const issues: { fieldId: string; message: string }[] = [];
  const byId = new Map(input.schema.fields.map((field) => [field.id, field]));
  for (const field of input.schema.fields) {
    if (!isFieldVisible(field, input.values, byId)) continue;
    if (input.editableFieldIds && !input.editableFieldIds.has(field.id) && field.type !== "repeater") continue;
    if (field.type === "repeater") {
      const rows = Array.isArray(input.values[field.id]) ? (input.values[field.id] as Record<string, unknown>[]) : [];
      if (field.required && rows.length === 0) {
        issues.push({ fieldId: field.id, message: `${field.label} needs at least one row.` });
      }
      for (const row of rows) {
        for (const child of field.children ?? []) {
          validateLeaf(child, row[child.id], issues);
        }
      }
      continue;
    }
    validateLeaf(field, input.values[field.id], issues);
  }
  if (issues.length) throw new FormValidationError(issues);
}

export function collectDocumentIds(fields: FormField[], values: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const take = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) take(item);
      return;
    }
    if (typeof value === "object" && value && "documentId" in value) {
      const id = (value as { documentId?: unknown }).documentId;
      if (typeof id === "string") ids.push(id);
    }
  };
  for (const field of fields) {
    if (field.type === "file" || field.type === "files" || field.type === "image" || field.type === "reupload") take(values[field.id]);
    if (field.type === "repeater" && Array.isArray(values[field.id])) {
      for (const row of values[field.id] as Record<string, unknown>[]) {
        for (const child of field.children ?? []) take(row[child.id]);
      }
    }
  }
  return ids;
}
