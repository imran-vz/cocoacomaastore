"use client";

import { Search, X } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A search input with a leading icon and a clear button once it has text. */
export function SearchField({
	value,
	onChange,
	label,
	className,
	...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "placeholder"> & {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name: "Search desserts". */
	label: string;
}) {
	return (
		<div className={cn("relative w-full", className)}>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground md:size-4"
			/>
			<Input
				type="search"
				aria-label={label}
				enterKeyHint="search"
				autoComplete="off"
				placeholder={label}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="pr-11 pl-10 md:pl-9 [&::-webkit-search-cancel-button]:hidden"
				{...props}
			/>
			{value ? (
				<Button
					variant="ghost"
					size="icon"
					aria-label="Clear search"
					onClick={() => onChange("")}
					className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground"
				>
					<X />
				</Button>
			) : null}
		</div>
	);
}
