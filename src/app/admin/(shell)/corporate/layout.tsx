import type { ReactNode } from "react";

import { AfendaGuidedModeProvider } from "@/components/afenda/guided-mode";

export default function CorporateAdministrationLayout({ children }: { children: ReactNode }) {
  return <AfendaGuidedModeProvider>{children}</AfendaGuidedModeProvider>;
}
