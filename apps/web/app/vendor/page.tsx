"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, statusTone } from "@/components/ui";

type Assignment = {
  id: string;
  status: string;
  deadline: string | null;
  form: { name: string };
  exhibition: { name: string };
};

export default function VendorHomePage() {
  const query = useQuery({ queryKey: ["my-assignments"], queryFn: () => api<{ data: Assignment[] }>("/assignments") });
  const rows = query.data?.data ?? [];
  return (
    <div>
      <PageHeader title="Your forms" description="Sign in, complete the exhibition form, and submit it for review. If an organizer flags fields, edit only those fields and resubmit. Approved answers stay locked." />
      {rows.length === 0 && !query.isLoading ? <EmptyState title="No forms yet" body="When an organizer assigns a form, it will appear here." /> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/vendor/assignments/${row.id}`} className="rounded-lg border border-border bg-surface p-4 hover:bg-secondary">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{row.form.name}</h2>
                <p className="text-sm text-muted">{row.exhibition.name} · Due {formatDate(row.deadline)}</p>
              </div>
              <Badge tone={statusTone(row.status)}>{row.status}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
