import { OrdersPageSkeleton } from "@/components/orders/orders-page-skeleton";
import { PageFrame } from "@/components/page-frame";

/** The page awaits today's orders before rendering, so this is what a tap on Orders shows. */
export default function Loading() {
	return (
		<PageFrame as="main" centered>
			<OrdersPageSkeleton variant="manager" />
		</PageFrame>
	);
}
