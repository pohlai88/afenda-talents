"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "afenda-guided-mode";
const CHANGE_EVENT = "afenda-guided-mode-change";

type GuidedModeContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

const GuidedModeContext = createContext<GuidedModeContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readStored(defaultEnabled: boolean): boolean {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "on") return true;
  if (saved === "off") return false;
  return defaultEnabled;
}

export function AfendaGuidedModeProvider({ children, defaultEnabled = true }: { children: ReactNode; defaultEnabled?: boolean }) {
  const enabled = useSyncExternalStore(
    subscribe,
    () => readStored(defaultEnabled),
    () => defaultEnabled,
  );

  const value = useMemo<GuidedModeContextValue>(() => ({
    enabled,
    setEnabled: (next) => {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      window.dispatchEvent(new Event(CHANGE_EVENT));
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
