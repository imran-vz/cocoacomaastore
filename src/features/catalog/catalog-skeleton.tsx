import { RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeaderSkeleton } from "@/components/ui/page-header";
import { SegmentedSkeleton } from "@/components/ui/segmented-control";
import { FieldSkeleton } from "@/components/ui/skeleton";
import type { Area } from "@/features/access/area";
import { CatalogLinks } from "@/features/catalog/catalog-toolbar";

/** Desserts and Combos while they load: both tabs share one layout. */
export function CatalogSkeleton({ area }: { area: Area }) {
	return (
		<div>
			<PageHeaderSkeleton description secondary action>
				<CatalogLinks area={area} />
			</PageHeaderSkeleton>
			<div className="flex flex-col gap-3 pb-4" aria-hidden="true">
				<FieldSkeleton />
				<SegmentedSkeleton className="w-full" />
			</div>
			<div aria-hidden="true">
				<RecordListSkeleton rows={8} chevron trailing action="switch" />
			</div>
		</div>
	);
}
