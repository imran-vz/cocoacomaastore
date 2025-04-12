import { Suspense } from "react";

import { Inventory } from "@/components/inventory";
import { getDesserts } from "./desserts/actions";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function Home() {
	const desserts = getDesserts();

	return (
		<main className="min-h-screen p-3 pb-6">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4">
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				}
			>
				<Inventory desserts={desserts} />
			</Suspense>
		</main>
	);
}
