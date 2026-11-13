"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FormValidationError, validateSubmission, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote, Notice, StatusBadge } from "@/components/ui";

export type VendorAssignment = {
  id: string;
  status: string;
  lockVersion: number;
  deadline: string | null;
  submittedAt?: string | null;
  form: { name: string; versionNumber?: number; schema: FormSchemaDefinition };
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
        showStageForField(first);
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
        const issues = caught.details.filter((item): item is { fieldId: string; message: string } => {
          return Boolean(item) && typeof item === "object" && "fieldId" in item && "message" in item;
        });
        if (!issues.length) {
          setFieldErrors([]);
          setError(friendlyErrorMessage(caught, "The form could not be saved. Please try again."));
          return;
        }
        showFieldErrors(issues);
        return;
      }
      setError(friendlyErrorMessage(caught, "The form could not be saved. Please try again."));
    },
  });

  const sections = [...assignment.form.schema.sections].sort((left, right) => left.order - right.order);
  const [stage, setStage] = useState(0);
  const currentStage = Math.min(stage, Math.max(sections.length - 1, 0));
  const editable = assignment.status === "INVITED" || assignment.status === "IN_PROGRESS" || assignment.status === "CORRECTION_REQUESTED";
  const staged = sections.length > 1;

  function showStageForField(fieldId?: string) {
    const field = assignment.form.schema.fields.find((item) => item.id === fieldId);
    const index = sections.findIndex((section) => section.id === field?.sectionId);
    if (index >= 0) setStage(index);
  }
  return (
    <section id={`assignment-${assignment.id}`} className="scroll-mt-20 grid gap-4">
      {compact ? null : (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate" title={assignment.form.name}>{assignment.form.name}</CardTitle>
              <CardDescription>
                {assignment.exhibition.name}
                {assignment.deadline ? ` · Due ${formatDate(assignment.deadline)}` : ""}
              </CardDescription>
            </div>
            <StatusBadge status={assignment.status} />
          </CardHeader>
        </Card>
      )}
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
      {staged ? (
        <nav aria-label="Form stages" className="grid gap-2 sm:flex sm:flex-wrap">
          {sections.map((section, index) => (
            <Button key={section.id} size="sm" variant={index === currentStage ? "primary" : "outline"} aria-current={index === currentStage ? "step" : undefined} className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 text-left sm:h-8 sm:w-auto sm:whitespace-nowrap" onClick={() => setStage(index)}>
              {index + 1}. {section.title}
            </Button>
          ))}
        </nav>
      ) : null}
      <FormRenderer
        schema={assignment.form.schema}
        values={values}
        editableFieldIds={assignment.editableFieldIds}
        notes={assignment.correction?.fields}
        errors={fieldErrors}
        disabled={!editable}
        idPrefix={assignment.id}
        documentTable
        visibleSectionId={staged ? sections[currentStage]?.id : null}
        onChange={(fieldId, value) => setValues((current) => ({ ...current, [fieldId]: value }))}
        onUpload={upload}
      />
      {editable ? (
        <Card className="sticky bottom-0 z-10 -mx-4 rounded-none border-x-0 border-b-0 sm:static sm:mx-0 sm:rounded-lg sm:border">
          <CardContent className="grid grid-cols-2 gap-2 py-3 sm:flex sm:flex-wrap sm:items-center sm:py-4">
            {staged && currentStage > 0 ? <Button className="w-full sm:w-auto" variant="outline" onClick={() => setStage(currentStage - 1)}>Back</Button> : null}
            {assignment.status !== "CORRECTION_REQUESTED" ? <Button className="w-full sm:w-auto" variant="outline" onClick={() => save.mutate("draft")} disabled={save.isPending}>Save</Button> : null}
            {staged && currentStage < sections.length - 1 ? <Button className="w-full sm:w-auto" variant="primary" onClick={() => setStage(currentStage + 1)}>Next</Button> : null}
            {!staged || currentStage === sections.length - 1 ? (
              <Button className="w-full sm:w-auto" variant="primary" onClick={() => save.mutate("submit")} disabled={save.isPending}>{assignment.status === "CORRECTION_REQUESTED" ? "Send again" : "Send"}</Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
