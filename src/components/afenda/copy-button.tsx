"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AfendaCopyButton({
  value,
  label = "Copy reference",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setMessage("Reference copied to clipboard.");
      window.setTimeout(() => {
        setCopied(false);
        setMessage("");
      }, 1600);
    } catch {
      setCopied(false);
      setMessage("Could not copy the reference. Select and copy it manually.");
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => void copy()} aria-label={label}>
        {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </span>
    </>
  );
}
