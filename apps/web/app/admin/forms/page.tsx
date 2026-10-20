"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Modal, PageHeader, inputClass } from "@/components/ui";

type FormRow = { id: string; name: string; scope: string; status: string; description: string; versions: { versionNumber: number }[] };

export default function FormsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const query = useQuery({ queryKey: ["forms"], queryFn: () => api<{ data: FormRow[] }>("/forms") });
  const create = useMutation({
    mutationFn: () => api<{ data: { id: string } }>("/forms", { method: "POST", body: JSON.stringify({ name, scope: "GLOBAL" }) }),
    onSuccess: async () => { setOpen(false); setName(""); await client.invalidateQueries({ queryKey: ["forms"] }); },
  });
  return (
    <div>
      <PageHeader title="Forms" description="Drafts stay editable. Publishing creates an immutable version." actions={<Button variant="primary" onClick={() => setOpen(true)}>New form</Button>} />
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Scope</th><th>Status</th><th>Latest version</th></tr></thead>
          <tbody>
            {(query.data?.data ?? []).map((form) => (
              <tr key={form.id}>
                <td><Link className="font-medium underline" href={`/admin/forms/${form.id}`}>{form.name}</Link></td>
                <td>{form.scope}</td>
                <td>{form.status}</td>
                <td>{form.versions[0]?.versionNumber ?? "Draft"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} title="New form" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <Field label="Name"><input className={inputClass} required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Button type="submit" variant="primary">Create draft</Button>
        </form>
      </Modal>
    </div>
  );
}
