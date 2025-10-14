import type { Metadata } from "next";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedDesserts } from "./actions";
import ManageDesserts from "./manage-desserts";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Dessert Management",
	description: "Dessert Management",
};

export default async function page() {
	const desserts = getCachedDesserts({
		shouldShowDisabled: true,
	});

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<Suspense
				fallback={
					<div className="flex flex-col gap-4">
						<div className="flex justify-between items-center">
							<h2 className="text-2xl font-bold">Desserts</h2>
							<Button type="button">Add Dessert</Button>
						</div>

						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				}
			>
				<ManageDesserts initialDesserts={desserts} />
			</Suspense>
		</main>
	);
}
