"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OperationalRound } from "@/lib/round-context";

const STATUS_LABEL: Record<OperationalRound["status"], string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export function RoundContextSwitcher({
  rounds,
  selectedRoundId,
}: {
  rounds: OperationalRound[];
  selectedRoundId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedRoundId = searchParams.get("round");
  const currentRoundId = rounds.some((round) => round.id === requestedRoundId)
    ? requestedRoundId
    : selectedRoundId;

  if (rounds.length === 0 || !currentRoundId) {
    return (
      <span className="truncate text-sm text-muted-foreground">
        No hiring round
      </span>
    );
  }

  return (
    <Select
      value={currentRoundId}
      onValueChange={(roundId) => {
        if (!roundId || roundId === currentRoundId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("round", roundId);
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger
        aria-label="Current hiring round"
        className="h-8 w-[min(21rem,calc(100vw-7.5rem))] border-0 bg-transparent px-2 shadow-none hover:bg-muted focus-visible:ring-2 sm:w-80"
      >
        <SelectValue placeholder="Choose a hiring round" />
      </SelectTrigger>
      <SelectContent align="start">
        {rounds.map((round) => (
          <SelectItem key={round.id} value={round.id}>
            <span className="flex min-w-0 flex-col py-0.5">
              <span className="truncate font-medium">{round.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {STATUS_LABEL[round.status]} · {round.assessmentTitle} · v
                {round.versionNumber}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
