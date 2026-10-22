import assert from "node:assert/strict";
import test from "node:test";
import { assertTransition, WorkflowError } from "./workflow";
import { assertLockedFieldsUnchanged, collectDocumentIds, fieldAnswers, formSchemaDefinition, LockedFieldError, validateSubmission } from "./form-schema";
import { escapeSpreadsheetCell, toCsv } from "./csv";

const sectionId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const boothId = "33333333-3333-4333-8333-333333333333";
const notesId = "44444444-4444-4444-8444-444444444444";

const schema = formSchemaDefinition.parse({
  sections: [{ id: sectionId, title: "Company", description: "", order: 0 }],
  fields: [
    {
      id: companyId,
      key: "company",
      type: "text",
      label: "Company",
      required: true,
      sectionId,
      order: 0,
    },
    {
      id: boothId,
      key: "booth",
      type: "text",
      label: "Booth",
      required: true,
      sectionId,
      order: 1,
    },
    {
      id: notesId,
      key: "notes",
      type: "textarea",
      label: "Notes",
      required: false,
      sectionId,
      order: 2,
    },
  ],
});

test("workflow rejects approval before submission", () => {
  assert.throws(() => assertTransition("IN_PROGRESS", "APPROVED"), WorkflowError);
});

test("workflow allows the correction cycle", () => {
  assert.doesNotThrow(() => assertTransition("SUBMITTED_PENDING_REVIEW", "CORRECTION_REQUESTED"));
  assert.doesNotThrow(() => assertTransition("CORRECTION_REQUESTED", "RESUBMITTED_PENDING_REVIEW"));
  assert.doesNotThrow(() => assertTransition("RESUBMITTED_PENDING_REVIEW", "APPROVED"));
});

test("locked fields reject tampered values and unknown keys", () => {
  const editable = new Set([boothId]);
  assert.throws(
    () =>
      assertLockedFieldsUnchanged({
        fields: schema.fields,
        previous: { [companyId]: "Harbor", [boothId]: "A1", [notesId]: "Keep" },
        next: { [companyId]: "Changed", [boothId]: "B2", [notesId]: "Keep" },
        editableFieldIds: editable,
      }),
    (error: unknown) => error instanceof LockedFieldError && error.fieldId === companyId,
  );
  assert.throws(
    () =>
      assertLockedFieldsUnchanged({
        fields: schema.fields,
        previous: { [companyId]: "Harbor", [boothId]: "A1" },
        next: { [companyId]: "Harbor", [boothId]: "B2", injected: true },
        editableFieldIds: editable,
      }),
    LockedFieldError,
  );
  assert.doesNotThrow(() =>
    assertLockedFieldsUnchanged({
      fields: schema.fields,
      previous: { [companyId]: "Harbor", [boothId]: "A1", [notesId]: "" },
      next: { [companyId]: "Harbor", [boothId]: "B2", [notesId]: "" },
      editableFieldIds: editable,
    }),
  );
});

test("submission validation reports required fields", () => {
  assert.throws(() => validateSubmission({ schema, values: { [companyId]: "Harbor" } }));
  assert.doesNotThrow(() =>
    validateSubmission({ schema, values: { [companyId]: "Harbor", [boothId]: "A1" } }),
  );
});

test("field answers mark filled and empty inputs", () => {
  const answers = fieldAnswers(schema, { [companyId]: "Harbor", [boothId]: "  ", [notesId]: "" });
  assert.deepEqual(answers, [
    { id: companyId, label: "Company", filled: true },
    { id: boothId, label: "Booth", filled: false },
    { id: notesId, label: "Notes", filled: false },
  ]);
});

test("a download and reupload field requires the vendor file", () => {
  const fieldId = "55555555-5555-4555-8555-555555555555";
  const assetId = "66666666-6666-4666-8666-666666666666";
  const documentId = "77777777-7777-4777-8777-777777777777";
  const withReupload = formSchemaDefinition.parse({
    sections: schema.sections,
    fields: [
      ...schema.fields,
      {
        id: fieldId,
        key: "packet",
        type: "reupload",
        label: "Booth plan",
        required: true,
        sectionId,
        order: 3,
        template: { assetId, filename: "booth-plan.pdf" },
      },
    ],
  });
  assert.throws(() => validateSubmission({ schema: withReupload, values: { [companyId]: "Harbor", [boothId]: "A1" } }));
  assert.doesNotThrow(() =>
    validateSubmission({
      schema: withReupload,
      values: { [companyId]: "Harbor", [boothId]: "A1", [fieldId]: { documentId, filename: "booth-plan-filled.pdf" } },
    }),
  );
  assert.deepEqual(collectDocumentIds(withReupload.fields, { [fieldId]: { documentId, filename: "booth-plan-filled.pdf" } }), [documentId]);
});

test("spreadsheet cells neutralize formula injection", () => {
  assert.equal(escapeSpreadsheetCell("=cmd()"), "'=cmd()");
  assert.equal(escapeSpreadsheetCell("+1"), "'+1");
  const csv = toCsv([{ name: "@SUM(A1)" }], ["name"]);
  assert.match(csv, /'@SUM/);
});
