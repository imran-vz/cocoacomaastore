"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The Orders page's refresh action: a 44px icon button on phones, icon + "Refresh" from md. */
export function RefreshOrdersButton({ onRefresh, busy }: { onRefresh: () => void; busy?: boolean }) {
	return (
		<Button
			variant="outline"
			onClick={onRefresh}
			disabled={busy}
			aria-busy={busy || undefined}
			className="max-md:size-11 max-md:px-0"
		>
			<RefreshCw
				aria-hidden="true"
				className={cn("max-md:size-5", busy && "animate-spin motion-reduce:animate-none")}
			/>
			<span className="max-md:sr-only">{busy ? "Refreshing" : "Refresh"}</span>
		</Button>
	);
}
