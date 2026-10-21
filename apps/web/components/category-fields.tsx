"use client";

import { useState } from "react";
import { Button, Field, inputClass } from "./ui";

export type VendorCategoryOption = { id: string; name: string; _count?: { vendors: number } };

export function CategoryFields({
  categories,
  selected,
  onChange,
  onCreate,
  creating,
}: {
  categories: VendorCategoryOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<unknown> | void;
  creating?: boolean;
}) {
  const [name, setName] = useState("");
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }
  return (
    <div className="grid gap-2">
      {categories.length ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category.id} className="inline-flex items-center gap-2 rounded border border-border px-2 py-1 text-sm">
              <input type="checkbox" checked={selected.includes(category.id)} onChange={() => toggle(category.id)} />
              {category.name}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No categories yet. Add one below, then assign it.</p>
      )}
      {onCreate ? (
        <Field label="New category">
          <div className="flex gap-2">
            <input className={inputClass} value={name} placeholder="Stand building" onChange={(event) => setName(event.target.value)} />
            <Button
              type="button"
              disabled={creating || name.trim().length < 2}
              onClick={() => {
                const next = name.trim();
                setName("");
                void onCreate(next);
              }}
            >
              {creating ? "Adding…" : "Add"}
            </Button>
          </div>
        </Field>
      ) : null}
    </div>
  );
}
