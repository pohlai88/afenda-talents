"use client";

import { useState } from "react";

type Row = { order: number; text: string; value: number; dimension: string };

export function ItemResponsesTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm underline print:hidden"
      >
        {open ? "Hide" : "Show"} item-level responses
      </button>
      {/* Hidden on screen until toggled; always present in print. */}
      <div className={open ? "mt-4" : "mt-4 hidden print:block"}>
        <table className="w-full text-left text-xs">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2">#</th>
              <th className="pr-2">Statement</th>
              <th className="pr-2">Dimension</th>
              <th>Answer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.order} className="border-b">
                <td className="py-1.5 pr-2">{row.order}</td>
                <td className="pr-2">{row.text}</td>
                <td className="pr-2">{row.dimension}</td>
                <td className="tabular-nums">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
