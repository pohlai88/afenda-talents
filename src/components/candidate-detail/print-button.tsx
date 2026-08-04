"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog for the scored profile (requirements §8.2, §20). */
export function PrintProfileButton() {
	return (
		<Button
			type="button"
			variant="outline"
			className="print:hidden"
			onClick={() => window.print()}
		>
			<Printer aria-hidden="true" className="size-4" />
			Print profile
		</Button>
	);
}
