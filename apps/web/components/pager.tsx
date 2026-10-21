"use client";

import { useState } from "react";
import { Button } from "./ui";

export const PAGE_SIZE = 10;

export function usePagedRows<T>(rows: T[], resetKey = "") {
  const [page, setPage] = useState(0);
  const [key, setKey] = useState(resetKey);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (key !== resetKey) {
    setKey(resetKey);
    setPage(0);
  } else if (page > pageCount - 1) {
    setPage(pageCount - 1);
  }
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    page: safePage,
    pageCount,
    total: rows.length,
    setPage,
    rangeStart: rows.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + PAGE_SIZE, rows.length),
  };
}

export function Pager({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPage: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">{rangeStart}–{rangeEnd} of {total}</p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="text-muted">Page {page + 1} of {pageCount}</span>
        <Button type="button" size="sm" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
