"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { FormValidationError, validateSubmission, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { vendorErrorMessage, vendorFieldMessage } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorNote, LoadingState, Notice, StatusBadge } from "@/components/ui";

export type VendorAssignment = {
  id: string;
  status: string;
  lockVersion: number;
  deadline: string | null;
  submittedAt?: string | null;
  form: { name: string; versionNumber?: number; schema: FormSchemaDefinition };
  exhibition: { name: string };
  vendor: {
    id: string;
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

export function VendorAssignmentForm({
  assignment,
  compact = false,
  onSubmitted,
}: {
  assignment: VendorAssignment;
  compact?: boolean;
  onSubmitted?: () => void;
}) {
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
    if (assignment.vendor.id) body.set("vendorId", assignment.vendor.id);
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
      return api<{ data: VendorAssignment }>(`/assignments/${assignment.id}/${mode === "draft" ? "draft" : "submit"}`, {
        method: mode === "draft" ? "PUT" : "POST",
        body: JSON.stringify({ lockVersion: assignment.lockVersion, values }),
      });
    },
    onSuccess: async (result, mode) => {
      setError("");
      setFieldErrors([]);
      client.setQueryData<{ data: VendorAssignment[] }>(["my-assignments"], (current) => current ? { ...current, data: current.data.map((item) => item.id === result.data.id ? result.data : item) } : current);
      client.setQueryData(["assignment", assignment.id], result);
      if (mode === "submit") {
        setMessage("Sent. The organizer will look at it.");
        onSubmitted?.();
        return;
      }
      setMessage("Saved. The status is now in progress.");
    },
    onError: (caught) => {
      const showFieldErrors = (issues: { fieldId: string; message: string }[]) => {
        setFieldErrors(issues);
        setError("Fill every compulsory field before submitting.");
        const first = issues[0]?.fieldId;
        requestAnimationFrame(() => {
          if (!first) return;
          document.getElementById(`${assignment.id}-${first}`)?.scrollIntoView({ block: "center" });
        });
      };
      if (caught instanceof FormValidationError) {
        showFieldErrors(caught.issues);
        return;
      }
      if (caught instanceof ApiError && Array.isArray(caught.details)) {
        const issues = caught.details
          .filter((item): item is { fieldId: string; message: string } => {
            return Boolean(item) && typeof item === "object" && "fieldId" in item && "message" in item;
          })
          .map((item) => ({
            fieldId: item.fieldId,
            message: vendorFieldMessage(item.message, "Please check this field and try again."),
          }));
        if (!issues.length) {
          setFieldErrors([]);
          setError(vendorErrorMessage(caught, "The form could not be saved. Please try again."));
          return;
        }
        showFieldErrors(issues);
        return;
      }
      setError(vendorErrorMessage(caught, "The form could not be saved. Please try again."));
    },
  });

  const sections = [...assignment.form.schema.sections]
    .sort((left, right) => left.order - right.order)
    .filter((section) => assignment.form.schema.fields.some((field) => field.sectionId === section.id));
  const editable = assignment.status === "INVITED" || assignment.status === "IN_PROGRESS" || assignment.status === "CORRECTION_REQUESTED";
  // A form sent back for correction is not saved as a draft: the vendor fixes the marked fields and sends again.
  const canDraft = assignment.status !== "CORRECTION_REQUESTED";
  const cardId = `assignment-${assignment.id}`;

  return (
    <section id={cardId} className="brand-card min-w-0 scroll-mt-4">
      {save.isPending ? (
        <LoadingState
          variant="overlay"
          label={save.variables === "submit" ? "Sending your form…" : "Saving your draft…"}
          description="Please wait a moment."
        />
      ) : null}
      <div className="brand-card-head">
        <span className="brand-kicker">
          <Store size={15} aria-hidden />
          <span className="min-w-0 break-words">{assignment.exhibition.name}</span>
        </span>
      </div>
      {compact ? null : (
        <div className="brand-callout">
          <span className="brand-callout-icon"><ClipboardList size={20} aria-hidden /></span>
          <span className="brand-callout-text">
            <strong title={assignment.form.name}>{assignment.form.name}</strong>
            <span>
              <b>{assignment.vendor.companyName}</b>
              {assignment.deadline ? ` – Due ${formatDate(assignment.deadline)}` : ""}
            </span>
          </span>
          <StatusBadge status={assignment.status} />
        </div>
      )}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 empty:hidden">
        <ErrorNote message={error} />
        <Notice message={message} />
        {assignment.status === "SUBMITTED_PENDING_REVIEW" || assignment.status === "RESUBMITTED_PENDING_REVIEW" ? (
          <Alert><AlertDescription>Sent. The organizer will look at it.</AlertDescription></Alert>
        ) : null}
        {assignment.status === "CORRECTION_REQUESTED" ? (
          <Alert variant="warning"><AlertDescription>Please fix the marked questions, then press Send again.</AlertDescription></Alert>
        ) : null}
        {assignment.status === "APPROVED" ? (
          <Alert variant="success"><AlertDescription>Accepted. This part cannot be changed.</AlertDescription></Alert>
        ) : null}
      </div>
      <FormRenderer
        bare
        schema={{
          ...assignment.form.schema,
          // Keep section titles; hide empty sections only.
          sections: sections.length > 0 ? sections : assignment.form.schema.sections,
        }}
        values={values}
        editableFieldIds={assignment.editableFieldIds}
        notes={assignment.correction?.fields}
        errors={fieldErrors}
        disabled={!editable}
        idPrefix={assignment.id}
        documentTable
        onChange={(fieldId, value) => setValues((current) => ({ ...current, [fieldId]: value }))}
        onUpload={upload}
      />
      {editable ? (
        <div className="form-actions">
          {canDraft ? (
            <Button size="xl" variant="secondary" onClick={() => save.mutate("draft")} disabled={save.isPending}>
              {save.isPending && save.variables === "draft" ? "Saving…" : "Save"}
            </Button>
          ) : null}
          <Button size="xl" variant="primary" className="is-primary" onClick={() => save.mutate("submit")} disabled={save.isPending}>
            {save.isPending && save.variables === "submit" ? "Submitting…" : assignment.status === "CORRECTION_REQUESTED" ? "Submit again" : "Submit"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
