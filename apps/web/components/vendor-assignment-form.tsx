"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, Building2, ClipboardList, FileText, History, Landmark, Megaphone, Package, SquareCheckBig, Store, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { FormValidationError, validateSubmission, type FormField, type FormSchemaDefinition } from "@vmp/shared";
import { FormRenderer } from "@/components/form-renderer";
import { ApiError, api } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
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
  const lastStage = !staged || currentStage === sections.length - 1;
  // A form sent back for correction is not saved as a draft: the vendor fixes the marked fields and sends again.
  const canDraft = assignment.status !== "CORRECTION_REQUESTED";
  const cardId = `assignment-${assignment.id}`;

  function showStageForField(fieldId?: string) {
    const field = assignment.form.schema.fields.find((item) => item.id === fieldId);
    const index = sections.findIndex((section) => section.id === field?.sectionId);
    if (index >= 0) setStage(index);
  }

  /** Opens a step and brings the top of the card back into view, like a page change. */
  function goToStage(index: number) {
    setStage(index);
    requestAnimationFrame(() => document.getElementById(cardId)?.scrollIntoView({ block: "start" }));
  }

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
        {staged ? <span className="brand-counter">Step {currentStage + 1} of {sections.length}</span> : null}
      </div>
      {staged ? (
        <ol className="steps" aria-label="Form stages">
          {sections.map((section, index) => {
            const Icon = stepIcon(section.title, index);
            return (
              <li key={section.id} className={`step ${index === currentStage ? "is-active" : index < currentStage ? "is-filled" : "is-todo"}`} aria-current={index === currentStage ? "step" : undefined}>
                <button type="button" className="step-button" title={section.title} aria-label={`Step ${index + 1}: ${section.title}`} onClick={() => goToStage(index)}>
                  <span className="step-icon"><Icon aria-hidden /></span>
                  <span className="step-label">{section.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
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
        <div className="form-actions">
          {staged && currentStage > 0 ? <Button size="xl" variant="secondary" onClick={() => goToStage(currentStage - 1)}>Back</Button> : null}
          {lastStage && canDraft ? (
            <Button size="xl" variant="secondary" onClick={() => save.mutate("draft")} disabled={save.isPending}>{save.isPending && save.variables === "draft" ? "Saving…" : "Save"}</Button>
          ) : null}
          {lastStage ? (
            <Button size="xl" variant="primary" className="is-primary" onClick={() => save.mutate("submit")} disabled={save.isPending}>{save.isPending && save.variables === "submit" ? "Sending…" : assignment.status === "CORRECTION_REQUESTED" ? "Send again" : "Send"}</Button>
          ) : canDraft ? (
            // Like the parent site: each step is saved as a draft before the next one opens.
            <Button size="xl" variant="primary" className="is-primary" onClick={() => save.mutate("draft", { onSuccess: () => goToStage(currentStage + 1) })} disabled={save.isPending}>Save and continue</Button>
          ) : (
            <Button size="xl" variant="primary" className="is-primary" onClick={() => goToStage(currentStage + 1)}>Next</Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

const STEP_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /declar|consent|agree|terms|confirm|\bsign/i, icon: SquareCheckBig },
  { match: /document|\bfile|upload|attach|certificate/i, icon: FileText },
  { match: /contact|people|team|staff|person/i, icon: Users },
  { match: /market|brand|promot|media/i, icon: Megaphone },
  { match: /previous|history|past|experience/i, icon: History },
  { match: /eligib|registration|licen|complian|verif/i, icon: BadgeCheck },
  { match: /bank|payment|financ|invoice|billing/i, icon: Landmark },
  { match: /product|service|item/i, icon: Package },
  { match: /booth|stand|exhibit|space/i, icon: Store },
  { match: /business|profile|activity|sector/i, icon: Briefcase },
  { match: /company|organi[sz]ation|entity|vendor|general/i, icon: Building2 },
];
const STEP_FALLBACK: LucideIcon[] = [Building2, BadgeCheck, Briefcase, History, Users, Megaphone, SquareCheckBig];

/** Picks the square's icon from the section title, so a "Contacts" step shows people and so on. */
function stepIcon(title: string, index: number): LucideIcon {
  return STEP_ICONS.find((item) => item.match.test(title))?.icon ?? STEP_FALLBACK[index % STEP_FALLBACK.length]!;
}
