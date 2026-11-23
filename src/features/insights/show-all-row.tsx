"use client";

/** The last row of a previewed list: expands to the rest (`label`, e.g. "Show all 12") and collapses back. */
export function ShowAllRow({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
	return (
		<li>
			<button
				type="button"
				aria-expanded={expanded}
				onClick={onToggle}
				className="focus-ring-inset flex min-h-12 w-full items-center px-4 text-sm font-semibold text-primary hover:bg-muted/60"
			>
				{expanded ? "Show less" : label}
			</button>
		</li>
	);
}
