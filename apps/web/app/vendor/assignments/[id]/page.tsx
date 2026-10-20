"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormValidationError, validateSubmission, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { Button, ErrorNote, Notice, PageHeader, StatusBadge } from "@/components/ui";

type Assignment = {
  data: {
    id: string;
    status: string;
    lockVersion: number;
    form: { name: string; schema: FormSchemaDefinition };
    exhibition: { name: string };
    values: Record<string, unknown>;
    editableFieldIds: string[];
    correction: { fields: { fieldId: string; note: string }[] } | null;
  };
};

export default function VendorAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["assignment", params.id], queryFn: () => api<Assignment>(`/assignments/${params.id}`) });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fieldId: string; message: string }[]>([]);
  const [message, setMessage] = useState("");
  const assignment = query.data?.data;

  useEffect(() => {
    if (assignment) setValues(assignment.values ?? {});
  }, [assignment]);

  async function upload(field: FormField, file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("assignmentId", params.id);
    body.set("fieldId", field.id);
    const result = await api<{ data: { id: string; versions: { filename: string }[] } }>("/documents", { method: "POST", body });
    return { documentId: result.data.id, filename: result.data.versions[0]?.filename ?? file.name };
  }

  const save = useMutation({
    mutationFn: (mode: "draft" | "submit") => {
      if (mode === "submit" && assignment) {
        const correcting = assignment.status === "CORRECTION_REQUESTED";
        validateSubmission({
          schema: assignment.form.schema,
          values,
          editableFieldIds: correcting ? new Set(assignment.editableFieldIds) : undefined,
        });
      }
      return api(`/assignments/${params.id}/${mode === "draft" ? "draft" : "submit"}`, {
        method: mode === "draft" ? "PUT" : "POST",
        body: JSON.stringify({ lockVersion: assignment?.lockVersion, values }),
      });
    },
    onSuccess: async (_data, mode) => {
      setError("");
      setFieldErrors([]);
      if (mode === "submit") {
        router.push("/vendor?submitted=1");
        return;
      }
      setMessage("Draft saved.");
      await client.invalidateQueries({ queryKey: ["assignment", params.id] });
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

  if (!assignment) return <p className="text-sm text-muted">Loading form…</p>;
  const editable = assignment.status === "INVITED" || assignment.status === "IN_PROGRESS" || assignment.status === "CORRECTION_REQUESTED";
  return (
    <div>
      <PageHeader title={assignment.form.name} description={assignment.exhibition.name} actions={<StatusBadge status={assignment.status} />} />
      <ErrorNote message={error} />
      <Notice message={message} />
      {assignment.status === "SUBMITTED_PENDING_REVIEW" || assignment.status === "RESUBMITTED_PENDING_REVIEW" ? (
        <p className="mb-3 text-sm">This submission is pending review. Approved answers stay locked.</p>
      ) : null}
      {assignment.status === "CORRECTION_REQUESTED" ? (
        <p className="mb-3 text-sm">Update only the flagged fields, then resubmit. The other answers stay as you sent them.</p>
      ) : null}
      {assignment.status === "APPROVED" ? <p className="mb-3 text-sm">This submission is approved, finalized, and locked. It is ready to export.</p> : null}
      <FormRenderer
        schema={assignment.form.schema}
        values={values}
        editableFieldIds={assignment.editableFieldIds}
        notes={assignment.correction?.fields}
        errors={fieldErrors}
        disabled={!editable}
        onChange={(fieldId, value) => setValues((current) => ({ ...current, [fieldId]: value }))}
        onUpload={upload}
      />
      {editable ? (
        <div className="mt-4 flex gap-2">
          {assignment.status !== "CORRECTION_REQUESTED" ? <Button onClick={() => save.mutate("draft")} disabled={save.isPending}>Save draft</Button> : null}
          <Button variant="primary" onClick={() => save.mutate("submit")} disabled={save.isPending}>{assignment.status === "CORRECTION_REQUESTED" ? "Resubmit" : "Submit"}</Button>
        </div>
      ) : null}
    </div>
  );
}
