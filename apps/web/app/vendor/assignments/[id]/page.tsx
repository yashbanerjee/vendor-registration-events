"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormField, FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { Badge, Button, ErrorNote, PageHeader, statusTone } from "@/components/ui";

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
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["assignment", params.id], queryFn: () => api<Assignment>(`/assignments/${params.id}`) });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
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
    mutationFn: (mode: "draft" | "submit") => api(`/assignments/${params.id}/${mode === "draft" ? "draft" : "submit"}`, {
      method: mode === "draft" ? "PUT" : "POST",
      body: JSON.stringify({ lockVersion: assignment?.lockVersion, values }),
    }),
    onSuccess: async () => {
      setError("");
      setMessage("Saved.");
      await client.invalidateQueries({ queryKey: ["assignment", params.id] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "The form could not be saved."),
  });

  if (!assignment) return <p className="text-sm text-muted">Loading form…</p>;
  const editable = assignment.status === "INVITED" || assignment.status === "IN_PROGRESS" || assignment.status === "CORRECTION_REQUESTED";
  return (
    <div>
      <PageHeader title={assignment.form.name} description={assignment.exhibition.name} actions={<Badge tone={statusTone(assignment.status)}>{assignment.status}</Badge>} />
      <ErrorNote message={error} />
      {message ? <p className="mb-3 text-sm text-success">{message}</p> : null}
      {assignment.status === "APPROVED" ? <p className="mb-3 text-sm">This submission is approved and locked.</p> : null}
      <FormRenderer
        schema={assignment.form.schema}
        values={values}
        editableFieldIds={assignment.editableFieldIds}
        notes={assignment.correction?.fields}
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
