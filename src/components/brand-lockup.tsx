import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Brand marks (DESIGN.md §Signature).
 *
 * - `BrandLogo`: the photo logo (`/logo.png`, cropped to its ink ring). It is the brand mark at
 *   every size: app bar, sidebar header, collapsed rail, empty states and the sign-in hero.
 */
export function BrandLogo({ size = 64, className }: { size?: number; className?: string }) {
	return (
		<span
			className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-card ring-1 ring-border", className)}
			style={{ width: size, height: size }}
		>
			<Image
				src="/logo.png"
				alt=""
				width={size * 2}
				height={size * 2}
				sizes={`${size}px`}
				loading="eager"
				className="size-full scale-[1.32] object-cover"
			/>
		</span>
	);
}

/** "Cocoa Comaa" in the brand voice: primary, bold, tight tracking. */
export function BrandWordmark({ className }: { className?: string }) {
	return <span className={cn("font-bold tracking-tight text-primary", className)}>Cocoa Comaa</span>;
}

/**
 * Mark + wordmark. `inline` sits in bars (logo 32, wordmark 17/700); `stacked` is the
 * centred sign-in lockup (photo logo 72, wordmark 24/700).
 */
export function BrandLockup({
	variant = "inline",
	className,
	caption,
}: {
	variant?: "inline" | "stacked";
	className?: string;
	caption?: React.ReactNode;
}) {
	if (variant === "stacked") {
		return (
			<div className={cn("flex flex-col items-center gap-3 text-center", className)}>
				<BrandLogo size={72} className="shadow-sm" />
				<div className="space-y-0.5">
					<BrandWordmark className="block text-2xl" />
					{caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
				</div>
			</div>
		);
	}

	return (
		<span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
			<BrandLogo size={32} />
			<span className="flex min-w-0 flex-col leading-tight">
				<BrandWordmark className="truncate text-[17px]" />
				{caption ? <span className="truncate text-xs text-muted-foreground">{caption}</span> : null}
			</span>
		</span>
	);
}
