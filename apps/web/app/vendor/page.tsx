"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { api } from "@/lib/api";
import { PacketCard, type Packet } from "@/components/vendor-packets";
import { VendorAssignmentForm, type VendorAssignment } from "@/components/vendor-assignment-form";
import { EmptyState, ErrorNote, Notice, PageHeader } from "@/components/ui";

export default function VendorHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading your form…</p>}>
      <MasterForm />
    </Suspense>
  );
}

function MasterForm() {
  const submitted = useSearchParams().get("submitted") === "1";
  const client = useQueryClient();
  const assignments = useQuery({ queryKey: ["my-assignments"], queryFn: () => api<{ data: VendorAssignment[] }>("/assignments") });
  const packets = useQuery({ queryKey: ["my-pdf-forms"], queryFn: () => api<{ data: Packet[] }>("/my/pdf-forms") });
  const forms = assignments.data?.data ?? [];
  const pdfs = packets.data?.data ?? [];
  const profile = forms[0];
  const loading = assignments.isLoading || packets.isLoading;
  const failed = assignments.isError || packets.isError;

  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [loading, forms.length, pdfs.length]);

  return (
    <div className="grid gap-4">
      <PageHeader title="Registration form" description="Every field is on this form, including PDF forms. Fill them here instead of opening each exhibition." />
      <Notice message={submitted ? "Your form was submitted." : ""} />
      <ErrorNote message={!loading && failed ? "Could not load your form." : ""} />
      {loading ? <p className="text-sm text-muted">Loading your form…</p> : null}
      {profile ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{profile.vendor.reference}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{profile.vendor.companyName}</h2>
          <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Contact" value={profile.vendor.contactName} />
            <Detail label="Email" value={profile.vendor.email} />
            <Detail label="Phone" value={profile.vendor.phone || "Not provided"} />
            <Detail label="Category" value={profile.vendor.category || "Not provided"} />
          </dl>
        </section>
      ) : null}
      {!loading && !failed && forms.length === 0 && pdfs.length === 0 ? (
        <EmptyState title="No form yet" body="When an organizer assigns your registration form, the fields will appear here." />
      ) : null}
      {forms.map((assignment) => (
        <VendorAssignmentForm key={assignment.id} assignment={assignment} />
      ))}
      {pdfs.length > 0 ? (
        <section className="grid gap-4">
          <div>
            <h2 className="text-base font-semibold">PDF forms</h2>
            <p className="mt-1 text-sm text-muted">These files are part of the same registration form. Download each blank PDF, upload the completed copy, and add any extra documents by name.</p>
          </div>
          {pdfs.map((form) => (
            <div key={form.id} id={`pdf-${form.id}`} className="scroll-mt-20">
              <PacketCard form={form} onChange={async () => { await client.invalidateQueries({ queryKey: ["my-pdf-forms"] }); }} />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
