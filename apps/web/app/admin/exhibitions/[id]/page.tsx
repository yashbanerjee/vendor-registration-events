"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { EventProgressBoard, type VendorProgress } from "@/components/event-progress-board";
import { ErrorNote, LoadingState, StatusBadge } from "@/components/ui";

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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/exhibitions" className="text-sm font-medium text-muted hover:text-foreground">
            ← All events
          </Link>
          {exhibition ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{exhibition.code}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">{exhibition.name}</h1>
            </div>
          ) : null}
        </div>
        {exhibition ? <StatusBadge status={exhibition.status} /> : null}
      </div>
      <ErrorNote message={query.isError ? "Could not load this exhibition." : ""} />
      {query.isLoading ? <LoadingState label="Loading event…" description="Fetching companies and form progress." /> : null}
      {exhibition ? <EventProgressBoard vendors={exhibition.vendors} /> : null}
    </div>
  );
}
