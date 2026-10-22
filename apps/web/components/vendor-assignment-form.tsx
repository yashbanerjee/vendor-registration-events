"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FormValidationError, validateSubmission, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button, ErrorNote, Notice, StatusBadge } from "@/components/ui";

export type VendorAssignment = {
  id: string;
  status: string;
  lockVersion: number;
  deadline: string | null;
  form: { name: string; schema: FormSchemaDefinition };
  exhibition: { name: string };
  vendor: {
    reference: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string | null;
    category: string | null;
  };
  values: Record<string, unknown>;
  editableFieldIds: string[];
  correction: { fields: { fieldId: string; note: string }[] } | null;
};

export function VendorAssignmentForm({ assignment }: { assignment: VendorAssignment }) {
  const client = useQueryClient();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fieldId: string; message: string }[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setValues(assignment.values ?? {});
  }, [assignment]);

  async function upload(field: FormField, file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("assignmentId", assignment.id);
    body.set("fieldId", field.id);
    const result = await api<{ data: { id: string; versions: { filename: string }[] } }>("/documents", { method: "POST", body });
    return { documentId: result.data.id, filename: result.data.versions[0]?.filename ?? file.name };
  }

  const save = useMutation({
    mutationFn: (mode: "draft" | "submit") => {
      if (mode === "submit") {
        const correcting = assignment.status === "CORRECTION_REQUESTED";
        validateSubmission({
          schema: assignment.form.schema,
          values,
          editableFieldIds: correcting ? new Set(assignment.editableFieldIds) : undefined,
        });
      }
      return api(`/assignments/${assignment.id}/${mode === "draft" ? "draft" : "submit"}`, {
        method: mode === "draft" ? "PUT" : "POST",
        body: JSON.stringify({ lockVersion: assignment.lockVersion, values }),
      });
    },
    onSuccess: async (_data, mode) => {
      setError("");
      setFieldErrors([]);
      setMessage(mode === "submit" ? "Submitted." : "Draft saved.");
      await client.invalidateQueries({ queryKey: ["my-assignments"] });
      await client.invalidateQueries({ queryKey: ["assignment", assignment.id] });
    },
    onError: (caught) => {
      if (caught instanceof FormValidationError) {
        setFieldErrors(caught.issues);
        setError("Fill every compulsory field before submitting.");
        return;
      }
      if (caught instanceof ApiError && Array.isArray(caught.details)) {
        const issues = caught.details.filter((item): item is { fieldId: string; message: string } => {
          return Boolean(item) && typeof item === "object" && "fieldId" in item && "message" in item;
        });
        setFieldErrors(issues);
        setError(issues.length ? "Fill every compulsory field before submitting." : caught.message);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "The form could not be saved.");
    },
  });

  const editable = assignment.status === "INVITED" || assignment.status === "IN_PROGRESS" || assignment.status === "CORRECTION_REQUESTED";
  return (
    <section id={`assignment-${assignment.id}`} className="scroll-mt-20 grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{assignment.form.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {assignment.exhibition.name}
            {assignment.deadline ? ` · Due ${formatDate(assignment.deadline)}` : ""}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>
      <ErrorNote message={error} />
      <Notice message={message} />
      {assignment.status === "SUBMITTED_PENDING_REVIEW" || assignment.status === "RESUBMITTED_PENDING_REVIEW" ? (
        <p className="text-sm">Sent. The organizer will look at it.</p>
      ) : null}
      {assignment.status === "CORRECTION_REQUESTED" ? (
        <p className="text-sm">Please fix the marked questions, then press Send again.</p>
      ) : null}
      {assignment.status === "APPROVED" ? <p className="text-sm">Accepted. This part cannot be changed.</p> : null}
      <FormRenderer
        schema={assignment.form.schema}
        values={values}
        editableFieldIds={assignment.editableFieldIds}
        notes={assignment.correction?.fields}
        errors={fieldErrors}
        disabled={!editable}
        idPrefix={assignment.id}
        onChange={(fieldId, value) => setValues((current) => ({ ...current, [fieldId]: value }))}
        onUpload={upload}
      />
      {editable ? (
        <div className="flex gap-2">
          {assignment.status !== "CORRECTION_REQUESTED" ? <Button onClick={() => save.mutate("draft")} disabled={save.isPending}>Save</Button> : null}
          <Button variant="primary" onClick={() => save.mutate("submit")} disabled={save.isPending}>{assignment.status === "CORRECTION_REQUESTED" ? "Send again" : "Send"}</Button>
        </div>
      ) : null}
    </section>
  );
}
