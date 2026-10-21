"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/utils";
import { CategoryFields, type VendorCategoryOption } from "@/components/category-fields";
import { Button, ErrorNote, Field, Modal, Notice, PageHeader, StatusBadge, inputClass } from "@/components/ui";

type Profile = {
  data: {
    id: string;
    reference: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    category: string;
    categories?: { category: { id: string; name: string } }[];
    status: string;
    addressLine1: string;
    city: string;
    country: string;
    assignments: { id: string; status: string; exhibition: { id: string; name: string }; formVersion: { id: string; template: { name: string }; versionNumber: number } }[];
    documents: { id: string; status: string; category: string; versions: { filename: string }[] }[];
    audits: { id: string; action: string; createdAt: string; fieldId: string | null }[];
    emails: { id: string; toAddress: string; template: string; subject: string; status: string; createdAt: string }[];
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
  const [categoryIds, setCategoryIds] = useState<string[] | null>(null);
  const query = useQuery({ queryKey: ["vendor", params.id], queryFn: () => api<Profile>(`/vendors/${params.id}`) });
  const categories = useQuery({ queryKey: ["vendor-categories"], queryFn: () => api<{ data: VendorCategoryOption[] }>("/vendor-categories") });
  const vendor = query.data?.data;
  const current = vendor?.assignments.find((assignment) => assignment.status !== "REVOKED");
  const forms = useQuery({ queryKey: ["forms"], queryFn: () => api<{ data: FormOption[] }>("/forms"), enabled: changing });
  const exhibitions = useQuery({ queryKey: ["exhibitions"], queryFn: () => api<{ data: ExhibitionOption[] }>("/exhibitions"), enabled: changing && !current });
  const publishedForms = (forms.data?.data ?? []).flatMap((item) =>
    item.status === "PUBLISHED" ? (item.versions ?? []).map((version) => ({ id: version.id, label: `${item.name} v${version.versionNumber}` })) : [],
  );
  const changeForm = useMutation({
    mutationFn: () => current
      ? api(`/assignments/${current.id}/form`, { method: "POST", body: JSON.stringify({ formVersionId: nextFormId }) })
      : api("/assignments", { method: "POST", body: JSON.stringify({ vendorId: vendor?.id, exhibitionId: nextExhibitionId, formVersionId: nextFormId }) }),
    onSuccess: async () => { setChanging(false); setNotice("The form was changed and a new invitation email was sent."); await client.invalidateQueries({ queryKey: ["vendor", params.id] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not change the form."),
  });
  const saveCategories = useMutation({
    mutationFn: () => api(`/vendors/${params.id}`, { method: "PATCH", body: JSON.stringify({ categoryIds: categoryIds ?? [] }) }),
    onSuccess: async () => {
      setCategoryIds(null);
      setNotice("Categories saved.");
      await client.invalidateQueries({ queryKey: ["vendor", params.id] });
      await client.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not save the categories."),
  });
  const addCategory = useMutation({
    mutationFn: (name: string) => api<{ data: VendorCategoryOption }>("/vendor-categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: async (result) => {
      setCategoryIds((current) => {
        const base = current ?? (vendor?.categories ?? []).map((link) => link.category.id);
        return base.includes(result.data.id) ? base : [...base, result.data.id];
      });
      await client.invalidateQueries({ queryKey: ["vendor-categories"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not add the category."),
  });
  const remove = useMutation({
    mutationFn: () => api("/vendors/archive", { method: "POST", body: JSON.stringify({ ids: [vendor?.id] }) }),
    onSuccess: () => router.push("/admin/vendors"),
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the vendor."),
  });
  if (!vendor) return <p className="text-sm text-muted">Loading vendor…</p>;
  const selectedCategories = categoryIds ?? (vendor.categories ?? []).map((link) => link.category.id);
  return (
    <div>
      <PageHeader
        title={vendor.companyName}
        description={`${vendor.reference} · ${vendor.contactName} · ${vendor.email}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={vendor.status} />
            <Button size="sm" onClick={() => { setError(""); setNextFormId(current?.formVersion.id ?? ""); setNextExhibitionId(current?.exhibition.id ?? ""); setChanging(true); }}>Change form</Button>
            <Button size="sm" variant="danger" onClick={() => { setError(""); setRemoving(true); }}>Delete</Button>
          </div>
        }
      />
      <Notice message={notice} />
      <ErrorNote message={error} />
      <p className="mb-4 text-sm text-muted">{[vendor.addressLine1, vendor.city, vendor.country, vendor.phone].filter(Boolean).join(" · ")}</p>
      <section className="mb-4 rounded border border-border bg-surface p-3">
        <h2 className="mb-2 text-sm font-semibold">Categories</h2>
        <CategoryFields
          categories={categories.data?.data ?? []}
          selected={selectedCategories}
          onChange={setCategoryIds}
          onCreate={(name) => addCategory.mutateAsync(name)}
          creating={addCategory.isPending}
        />
        <div className="mt-3">
          <Button size="sm" variant="primary" disabled={saveCategories.isPending || categoryIds === null} onClick={() => { setError(""); saveCategories.mutate(); }}>Save categories</Button>
        </div>
      </section>
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
                    <td><StatusBadge status={assignment.status} /></td>
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
                    <td><StatusBadge status={document.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <h2 className="mb-2 mt-4 text-sm font-semibold">Audit history</h2>
      <ul className="grid gap-2 text-sm">
        {[
          ...vendor.audits.map((audit) => ({ kind: "audit" as const, ...audit })),
          ...(vendor.emails ?? []).map((email) => ({ kind: "email" as const, ...email })),
        ]
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="rounded border border-border bg-surface px-3 py-2">
              {entry.kind === "email" ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-medium">Email {formatLabel(entry.template).toLowerCase()}</span>
                  <StatusBadge status={entry.status} />
                  <span className="text-muted">{entry.toAddress}</span>
                  {entry.subject ? <span className="text-muted">{entry.subject}</span> : null}
                </span>
              ) : (
                <>
                  <span className="font-medium">{formatLabel(entry.action)}</span>
                  {entry.fieldId ? <span className="ml-2 text-muted">field {entry.fieldId.slice(0, 8)}</span> : null}
                </>
              )}
              <span className="float-right text-muted">{formatDate(entry.createdAt)}</span>
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
