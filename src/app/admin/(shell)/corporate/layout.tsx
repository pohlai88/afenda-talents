import type { ReactNode } from "react";

import { AfendaGuidedModeProvider } from "@/components/afenda/guided-mode";
import { CorporateCommandPalette } from "@/components/corporate/corporate-command-palette";

export default function CorporateAdministrationLayout({ children }: { children: ReactNode }) {
  return (
    <AfendaGuidedModeProvider>
      <div className="fixed bottom-4 right-4 z-40 hidden md:block">
        <CorporateCommandPalette />
      </div>
      {children}
    </AfendaGuidedModeProvider>
  );
}
