"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "afenda-guided-mode";

type GuidedModeContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

const GuidedModeContext = createContext<GuidedModeContextValue | null>(null);

export function AfendaGuidedModeProvider({ children, defaultEnabled = true }: { children: ReactNode; defaultEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "on") setEnabled(true);
    if (saved === "off") setEnabled(false);
  }, []);

  const value = useMemo<GuidedModeContextValue>(() => ({
    enabled,
    setEnabled: (next) => {
      setEnabled(next);
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    },
  }), [enabled]);

  return <GuidedModeContext.Provider value={value}>{children}</GuidedModeContext.Provider>;
}

export function useAfendaGuidedMode() {
  return useContext(GuidedModeContext) ?? { enabled: true, setEnabled: () => undefined };
}

export function AfendaGuidedModeToggle() {
  const { enabled, setEnabled } = useAfendaGuidedMode();
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => setEnabled(!enabled)} aria-pressed={enabled}>
      <CircleHelp aria-hidden="true" />
      Guided mode {enabled ? "on" : "off"}
    </Button>
  );
}
