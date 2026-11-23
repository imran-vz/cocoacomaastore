import { RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeaderSkeleton } from "@/components/ui/page-header";
import { SectionHeadingSkeleton } from "@/components/ui/section-heading";

export function StockSkeleton() {
	return (
		<div className="w-full" aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-20" description />
			<SectionHeadingSkeleton width="w-20" />
			<RecordListSkeleton rows={6} trailing />
		</div>
	);
}
