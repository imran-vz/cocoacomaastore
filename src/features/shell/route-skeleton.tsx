import { RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeaderSkeleton } from "@/components/ui/page-header";

/**
 * The fallback for an area's whole segment. Next shows the nearest loading boundary it knows
 * while the target route's own boundary hasn't been fetched yet (always in dev, and on a tap
 * before prefetch lands), so this stays neutral instead of flashing another screen's shape.
 */
export function RouteSkeleton() {
	return (
		<div aria-hidden="true">
			<PageHeaderSkeleton />
			<RecordListSkeleton rows={6} />
		</div>
	);
}
