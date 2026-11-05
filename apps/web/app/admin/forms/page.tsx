"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import { Pager, usePagedRows } from "@/components/pager";
import { Button, ErrorNote, Field, Modal, Notice, PageHeader, inputClass } from "@/components/ui";

type FormRow = { id: string; name: string; scope: string; status: string; description: string; versions: { versionNumber: number }[] };

export default function FormsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState<FormRow | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["forms"], queryFn: () => api<{ data: FormRow[] }>("/forms") });
  const forms = usePagedRows(query.data?.data ?? []);
  const create = useMutation({
    mutationFn: () => api<{ data: { id: string } }>("/forms", { method: "POST", body: JSON.stringify({ name, scope: "GLOBAL" }) }),
    onSuccess: async () => { setOpen(false); setName(""); setError(""); setNotice("Form created."); await client.invalidateQueries({ queryKey: ["forms"] }); },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not create the form."),
  });
  const remove = useMutation({
    mutationFn: () => api("/forms/archive", { method: "POST", body: JSON.stringify({ ids: [removing?.id] }) }),
    onSuccess: async () => {
      setNotice(`${removing?.name ?? "Form"} deleted.`);
      setRemoving(null);
      setError("");
      await client.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : "Could not delete the form."),
  });
  return (
    <div>
      <PageHeader title="Forms" description="Write the questions a company answers online. Publish a form when it is ready to send." actions={<Button variant="primary" onClick={() => setOpen(true)}>New form</Button>} />
      <ErrorNote message={error} />
      <Notice message={notice} />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Scope</th><th>Status</th><th>Latest version</th><th></th></tr></thead>
          <tbody>
            {forms.rows.map((form) => (
              <tr key={form.id}>
                <td><Link className="font-medium underline" href={`/admin/forms/${form.id}`}>{form.name}</Link></td>
                <td>{formatLabel(form.scope)}</td>
                <td>{formatLabel(form.status)}</td>
                <td>{form.versions[0]?.versionNumber ?? "Draft"}</td>
                <td><Button size="sm" variant="danger" onClick={() => { setError(""); setRemoving(form); }}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={forms.page} pageCount={forms.pageCount} total={forms.total} rangeStart={forms.rangeStart} rangeEnd={forms.rangeEnd} onPage={forms.setPage} />
      <Modal open={open} title="New form" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <Field label="Name"><input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Button type="submit" variant="primary">Create draft</Button>
        </form>
      </Modal>
      <Modal open={Boolean(removing)} title="Delete form" onClose={() => setRemoving(null)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); remove.mutate(); }}>
          <p className="text-sm">Delete {removing?.name}? It leaves this list and cannot be assigned again. Answers already sent stay on record. A company that has not sent it yet will no longer see it.</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={remove.isPending}>Delete</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
