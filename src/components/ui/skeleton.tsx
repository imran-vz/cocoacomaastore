import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="skeleton" className={cn("bg-muted rounded-md animate-pulse", className)} {...props} />;
}

/** A 44px (36px from md) input, select or button. */
function FieldSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn("h-11 w-full rounded-lg md:h-9", className)} />;
}

/** Stable keys for `count` placeholder rows. */
function skeletonSlots(count: number, prefix = "row") {
	return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export { FieldSkeleton, Skeleton, skeletonSlots };
