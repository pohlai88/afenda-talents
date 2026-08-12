"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { AssessmentBuilder } from "@/components/assessment-builder/assessment-builder";
import type { DraftInstrumentDocument } from "@/lib/instrument-draft";

type Props = {
  assessmentId: string;
  initialTitle: string;
  initialDraft: DraftInstrumentDocument;
  initialDraftRevision: number;
  isSystem: boolean;
  latestVersionNumber: number | null;
};

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof Request) return new URL(input.url, window.location.origin);
  return new URL(String(input), window.location.origin);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

/**
 * Transport boundary for the existing visual builder.
 *
 * The builder predates optimistic draft revisions and owns several internal fetch calls.
 * This page-scoped boundary keeps those calls ordered, injects the latest revision into
 * draft PATCH requests, and prevents validate/publish/preview from overtaking an
 * unsaved draft. It restores the native fetch implementation on unmount and ignores
 * every request outside this one assessment editor.
 */
export function AssessmentBuilderBoundary({
  initialDraftRevision,
  ...builderProps
}: Props) {
  const revisionRef = useRef(initialDraftRevision);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSaveSucceededRef = useRef(true);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const assessmentPath = `/api/admin/assessments/${builderProps.assessmentId}`;
    const validatePath = `${assessmentPath}/validate`;
    const publishPath = `${assessmentPath}/publish`;
    const previewPath = `/admin/assessments/${builderProps.assessmentId}/preview`;

    const interceptedFetch: typeof window.fetch = async (input, init) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url.pathname === assessmentPath && method === "PATCH") {
        const operation = saveQueueRef.current.then(async () => {
          let body: Record<string, unknown> = {};
          try {
            const rawBody = init?.body;
            if (typeof rawBody === "string") {
              body = JSON.parse(rawBody) as Record<string, unknown>;
            }
          } catch {
            lastSaveSucceededRef.current = false;
            return new Response(JSON.stringify({ error: "Invalid draft request" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const response = await nativeFetch(input, {
            ...init,
            body: JSON.stringify({
              ...body,
              expectedRevision: revisionRef.current,
            }),
          });

          if (!response.ok) {
            lastSaveSucceededRef.current = false;
            return response;
          }

          const responseBody = await response
            .clone()
            .json()
            .catch(() => null);
          if (
            !responseBody ||
            typeof responseBody.draftRevision !== "number"
          ) {
            lastSaveSucceededRef.current = false;
            return new Response(
              JSON.stringify({
                error: "The server did not confirm the saved draft revision.",
              }),
              {
                status: 502,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          revisionRef.current = responseBody.draftRevision;
          lastSaveSucceededRef.current = true;
          return response;
        });

        saveQueueRef.current = operation.then(
          () => undefined,
          () => undefined,
        );
        try {
          return await operation;
        } catch (error) {
          lastSaveSucceededRef.current = false;
          throw error;
        }
      }

      if (
        method === "POST" &&
        (url.pathname === validatePath || url.pathname === publishPath)
      ) {
        await saveQueueRef.current;
        if (!lastSaveSucceededRef.current) {
          return new Response(
            JSON.stringify({
              error: "The latest draft was not saved. Resolve the save error before continuing.",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      return nativeFetch(input, init);
    };

    async function protectPreview(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname !== previewPath) return;

      event.preventDefault();
      const previewWindow =
        anchor.target === "_blank" ? window.open("about:blank", "_blank") : null;

      // Let the builder's click handler flush its debounce timer and enqueue the PATCH.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await saveQueueRef.current;
      if (!lastSaveSucceededRef.current) {
        previewWindow?.close();
        toast.error("Preview was not opened because the latest draft is unsaved.");
        return;
      }

      if (previewWindow) previewWindow.location.href = url.href;
      else window.location.assign(url.href);
    }

    window.fetch = interceptedFetch;
    document.addEventListener("click", protectPreview, true);
    return () => {
      if (window.fetch === interceptedFetch) window.fetch = nativeFetch;
      document.removeEventListener("click", protectPreview, true);
    };
  }, [builderProps.assessmentId]);

  return <AssessmentBuilder {...builderProps} />;
}
