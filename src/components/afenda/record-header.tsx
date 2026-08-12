import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";

export function AfendaRecordHeader({
  context,
  title,
  identity,
  status,
  actions,
}: {
  context: string;
  title: string;
  identity: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      eyebrow={context}
      title={title}
      description={identity}
      meta={status}
      actions={actions}
    />
  );
}
