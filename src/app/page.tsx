import { Suspense } from "react";

import { getCachedDesserts } from "./desserts/actions";
import { Skeleton } from "@/components/ui/skeleton";
import Home from "@/components/home";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const desserts = getCachedDesserts();

	return (
		<main className="min-h-screen p-3 pb-6 max-w-md mx-auto">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4">
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				}
			>
				<Home desserts={desserts} />
			</Suspense>
		</main>
	);
}
