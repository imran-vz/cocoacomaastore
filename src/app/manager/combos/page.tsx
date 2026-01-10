import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getCachedAllCombos,
	getCachedBaseDesserts,
	getCachedModifierDesserts,
} from "./actions";
import ManageCombos from "./manage-combos";

export const dynamic = "force-dynamic";

export default async function ManagerCombosPage() {
	const combos = getCachedAllCombos();
	const baseDesserts = getCachedBaseDesserts();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
			<Suspense
				fallback={
					<div className="space-y-6">
						<div className="flex justify-between items-center">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-9 w-32" />
						</div>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							<Skeleton className="h-40" />
							<Skeleton className="h-40" />
							<Skeleton className="h-40" />
						</div>
					</div>
				}
			>
				<ManageCombos
					initialCombos={combos}
					baseDesserts={baseDesserts}
					modifierDesserts={modifierDesserts}
				/>
			</Suspense>
		</main>
	);
}
