import Image from "next/image";

import { cn } from "@/lib/utils";

/** The shop's name, wherever the app names it (titles, invoices, the UPI payee). */
export const BRAND_NAME = "Cocoa Comaa";

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

/** The brand name in the brand voice: primary, bold, tight tracking. */
export function BrandWordmark({ className }: { className?: string }) {
	return <span className={cn("font-bold tracking-tight text-primary", className)}>{BRAND_NAME}</span>;
}

/** The centred sign-in lockup: the photo logo (72) over the wordmark (24/700). */
export function BrandLockup({ className }: { className?: string }) {
	return (
		<div className={cn("flex flex-col items-center gap-3 text-center", className)}>
			<BrandLogo size={72} className="shadow-sm" />
			<BrandWordmark className="block text-2xl" />
		</div>
	);
}
