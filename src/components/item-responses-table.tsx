"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = { order: number; text: string; value: number; dimension: string };

/**
 * A manual disclosure rather than the Collapsible primitive: print needs the table
 * unconditionally present in the DOM, and Base UI's panel unmounts when closed.
 */
export function ItemResponsesTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="print:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide" : "Show"} item-level responses
      </Button>
      {/* Hidden on screen until toggled; always present in print. */}
      <div className={open ? "mt-3" : "mt-3 hidden print:block"}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Statement</TableHead>
              <TableHead>Dimension</TableHead>
              <TableHead>Answer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.order}>
                <TableCell className="text-muted-foreground">{row.order}</TableCell>
                <TableCell>{row.text}</TableCell>
                <TableCell className="text-muted-foreground">{row.dimension}</TableCell>
                <TableCell className="tabular-nums">{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
