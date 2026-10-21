"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, Modal, Notice, PageHeader, inputClass } from "@/components/ui";

type Category = { id: string; name: string; _count: { vendors: number } };

export default function CategoriesPage() {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [removing, setRemoving] = useState<Category | null>(null);
  const query = useQuery({ queryKey: ["vendor-categories"], queryFn: () => api<{ data: Category[] }>("/vendor-categories") });
  const categories = usePagedRows(query.data?.data ?? []);
  const refresh = () => client.invalidateQueries({ queryKey: ["vendor-categories"] });
  const create = useMutation({
    mutationFn: () => api("/vendor-categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: async () => {
      setCreating(false);
      setName("");
      setError("");
      setNotice("Category added.");
      await refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not add the category."),
  });
  const update = useMutation({
    mutationFn: () => api(`/vendor-categories/${editing?.id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) }),
    onSuccess: async () => {
      setEditing(null);
      setError("");
      setNotice("Category updated.");
      await refresh();
      await client.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not update the category."),
  });
  const remove = useMutation({
    mutationFn: () => api(`/vendor-categories/${removing?.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setRemoving(null);
      setError("");
      setNotice("Category deleted.");
      await refresh();
      await client.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the category."),
  });
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Trade categories you can assign to vendors and use as a filter."
        actions={<Button variant="primary" onClick={() => { setError(""); setName(""); setCreating(true); }}>Add category</Button>}
      />
      <Notice message={notice} />
      <ErrorNote message={error} />
      <div className="table-wrap mt-3">
        <table className="data">
          <thead><tr><th>Name</th><th>Vendors</th><th></th></tr></thead>
          <tbody>
            {categories.rows.map((category) => (
              <tr key={category.id}>
                <td className="font-medium">{category.name}</td>
                <td>{category._count.vendors}</td>
                <td className="text-right">
                  <div className="inline-flex gap-2">
                    <Button size="sm" onClick={() => { setError(""); setEditName(category.name); setEditing(category); }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => { setError(""); setRemoving(category); }}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={categories.page} pageCount={categories.pageCount} total={categories.total} rangeStart={categories.rangeStart} rangeEnd={categories.rangeEnd} onPage={categories.setPage} />
      {!query.isLoading && categories.total === 0 ? <p className="mt-3 text-sm text-muted">No categories yet.</p> : null}
      <Modal open={creating} title="Add category" onClose={() => setCreating(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); create.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Name"><input className={inputClass} required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Button type="submit" variant="primary" disabled={create.isPending}>Add category</Button>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit category" onClose={() => setEditing(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); setError(""); update.mutate(); }}>
          <ErrorNote message={error} />
          <Field label="Name"><input className={inputClass} required minLength={2} value={editName} onChange={(event) => setEditName(event.target.value)} /></Field>
          <Button type="submit" variant="primary" disabled={update.isPending}>Save category</Button>
        </form>
      </Modal>
      <Modal open={Boolean(removing)} title="Delete category" onClose={() => setRemoving(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
          <ErrorNote message={error} />
          <p className="text-sm">Delete {removing?.name}? Vendors in this category stay in the directory, and the category is removed from them.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
