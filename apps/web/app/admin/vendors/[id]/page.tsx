"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, Button, ErrorNote, Field, Modal, PageHeader, inputClass, statusTone } from "@/components/ui";

type Profile = {
  data: {
    id: string;
    reference: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    category: string;
    status: string;
    addressLine1: string;
    city: string;
    country: string;
    assignments: { id: string; status: string; exhibition: { id: string; name: string }; formVersion: { id: string; template: { name: string }; versionNumber: number } }[];
    documents: { id: string; status: string; category: string; versions: { filename: string }[] }[];
    audits: { id: string; action: string; createdAt: string; fieldId: string | null }[];
  };
};

type FormOption = { id: string; name: string; status: string; versions?: { id: string; versionNumber: number }[] };
type ExhibitionOption = { id: string; name: string };

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [changing, setChanging] = useState(false);
  const [nextFormId, setNextFormId] = useState("");
  const [nextExhibitionId, setNextExhibitionId] = useState("");
  const [removing, setRemoving] = useState(false);
  const query = useQuery({ queryKey: ["vendor", params.id], queryFn: () => api<Profile>(`/vendors/${params.id}`) });
  const vendor = query.data?.data;
  const current = vendor?.assignments.find((assignment) => assignment.status !== "REVOKED");
  const forms = useQuery({ queryKey: ["forms"], queryFn: () => api<{ data: FormOption[] }>("/forms"), enabled: changing });
  const exhibitions = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: ExhibitionOption[] }>("/exhibitions"), enabled: changing && !current });
  const publishedForms = (forms.data?.data ?? []).flatMap((item) =>
    item.status === "PUBLISHED" ? (item.versions ?? []).map((version) => ({ id: version.id, label: `${item.name} v${version.versionNumber}` })) : [],
  );
  const resetMail = useMutation({
    mutationFn: () => api(`/assignments/${current?.id}/resend`, { method: "POST" }),
    onSuccess: async () => { setNotice("The invitation email was sent again."); await client.invalidateQueries({ queryKey: ["vendor", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not resend the email."),
  });
  const changeForm = useMutation({
    mutationFn: () => current
      ? api(`/assignments/${current.id}/form`, { method: "POST", body: JSON.stringify({ formVersionId: nextFormId }) })
      : api("/assignments", { method: "POST", body: JSON.stringify({ vendorId: vendor?.id, exhibitionId: nextExhibitionId, formVersionId: nextFormId }) }),
    onSuccess: async () => { setChanging(false); setNotice("The form was changed and a new invitation email was sent."); await client.invalidateQueries({ queryKey: ["vendor", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not change the form."),
  });
  const remove = useMutation({
    mutationFn: () => api("/vendors/archive", { method: "POST", body: JSON.stringify({ ids: [vendor?.id] }) }),
    onSuccess: () => router.push("/admin/vendors"),
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the vendor."),
  });
  if (!vendor) return <p className="text-sm text-muted">Loading vendor…</p>;
  return (
    <div>
      <PageHeader
        title={vendor.companyName}
        description={`${vendor.reference} · ${vendor.contactName} · ${vendor.email}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(vendor.status)}>{vendor.status}</Badge>
            <Button size="sm" disabled={!current || resetMail.isPending} onClick={() => { setError(""); resetMail.mutate(); }}>Reset mail</Button>
            <Button size="sm" onClick={() => { setError(""); setNextFormId(current?.formVersion.id ?? ""); setNextExhibitionId(current?.exhibition.id ?? ""); setChanging(true); }}>Change form</Button>
            <Button size="sm" variant="danger" onClick={() => { setError(""); setRemoving(true); }}>Delete</Button>
          </div>
        }
      />
      {notice ? <p className="mb-3 rounded-md bg-[var(--badge-success-bg)] px-3 py-2 text-sm text-[var(--badge-success-fg)]">{notice}</p> : null}
      <ErrorNote message={error} />
      <p className="mb-4 text-sm text-muted">{[vendor.addressLine1, vendor.city, vendor.country, vendor.phone, vendor.category].filter(Boolean).join(" · ")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Assignments</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Exhibition</th><th>Form</th><th>Status</th></tr></thead>
              <tbody>
                {vendor.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.exhibition.name}</td>
                    <td><Link className="underline" href={`/admin/reviews/${assignment.id}`}>{assignment.formVersion.template.name} v{assignment.formVersion.versionNumber}</Link></td>
                    <td><Badge tone={statusTone(assignment.status)}>{assignment.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Documents</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>File</th><th>Status</th></tr></thead>
              <tbody>
                {vendor.documents.map((document) => (
                  <tr key={document.id}>
                    <td><Link className="underline" href={`/admin/documents/vendors/${vendor.id}`}>{document.versions[0]?.filename ?? document.category}</Link></td>
                    <td><Badge tone={statusTone(document.status)}>{document.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <h2 className="mb-2 mt-4 text-sm font-semibold">Audit history</h2>
      <ul className="grid gap-2 text-sm">
        {vendor.audits.map((audit) => (
          <li key={audit.id} className="rounded border border-border bg-surface px-3 py-2">
            <span className="font-medium">{audit.action}</span>
            {audit.fieldId ? <span className="ml-2 text-muted">field {audit.fieldId.slice(0, 8)}</span> : null}
            <span className="float-right text-muted">{formatDate(audit.createdAt)}</span>
          </li>
        ))}
      </ul>
      <Modal open={changing} title="Change form" onClose={() => setChanging(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); changeForm.mutate(); }}>
          <ErrorNote message={error} />
          {!current ? (
            <Field label="Exhibition">
              <select className={inputClass} required value={nextExhibitionId} onChange={(event) => setNextExhibitionId(event.target.value)}>
                <option value="">Select</option>
                {(exhibitions.data?.data ?? []).map((exhibition) => <option key={exhibition.id} value={exhibition.id}>{exhibition.name}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Form" hint="A new invitation email is sent with a link to this form.">
            <select className={inputClass} required value={nextFormId} onChange={(event) => setNextFormId(event.target.value)}>
              <option value="">Select</option>
              {publishedForms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={changeForm.isPending || !nextFormId}>Save form</Button>
        </form>
      </Modal>
      <Modal open={removing} title="Delete vendor" onClose={() => setRemoving(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
          <ErrorNote message={error} />
          <p className="text-sm">Delete {vendor.companyName}? Open invitation links stop working, and the company leaves the directory.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setRemoving(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
