"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { EventProgressBoard, type VendorProgress } from "@/components/event-progress-board";
import { ErrorNote, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

type ExhibitionDetail = {
  data: {
    id: string;
    name: string;
    code: string;
    status: string;
    vendors: VendorProgress[];
  };
};

export default function ExhibitionDetailPage() {
  const params = useParams<{ id: string }>().id;
  const query = useQuery({
    queryKey: ["exhibition", params],
    queryFn: () => api<ExhibitionDetail>(`/exhibitions/${params}`),
    enabled: Boolean(params),
  });
  const exhibition = query.data?.data;

  return (
    <div>
      <Link href="/admin/exhibitions" className="mb-3 inline-block text-sm font-medium text-muted hover:text-foreground">
        ← All events
      </Link>
      {exhibition ? <PageHeader eyebrow={exhibition.code} title={exhibition.name} actions={<StatusBadge status={exhibition.status} />} /> : null}
      <ErrorNote className="mb-3" message={query.isError ? "Could not load this exhibition." : ""} />
      {query.isLoading ? <LoadingState label="Loading event…" description="Fetching companies and form progress." /> : null}
      {exhibition ? <EventProgressBoard vendors={exhibition.vendors} /> : null}
    </div>
  );
}
