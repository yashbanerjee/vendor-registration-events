"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, PageHeader, statusTone } from "@/components/ui";

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
    assignments: { id: string; status: string; exhibition: { name: string }; formVersion: { template: { name: string }; versionNumber: number } }[];
    documents: { id: string; status: string; category: string; versions: { filename: string }[] }[];
    audits: { id: string; action: string; createdAt: string; fieldId: string | null }[];
  };
};

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const query = useQuery({ queryKey: ["vendor", params.id], queryFn: () => api<Profile>(`/vendors/${params.id}`) });
  const vendor = query.data?.data;
  if (!vendor) return <p className="text-sm text-muted">Loading vendor…</p>;
  return (
    <div>
      <PageHeader title={vendor.companyName} description={`${vendor.reference} · ${vendor.contactName} · ${vendor.email}`} actions={<Badge tone={statusTone(vendor.status)}>{vendor.status}</Badge>} />
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
    </div>
  );
}
