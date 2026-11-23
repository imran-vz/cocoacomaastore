import type { Metadata } from "next";
import { Suspense } from "react";

import { PageFrame } from "@/components/page-frame";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getCachedAllCombos,
	getCachedBaseDesserts,
	getCachedModifierDesserts,
} from "@/lib/role-actions/manager-combos";
import ManageCombos from "./manage-combos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Combos",
	description: "Dessert combos",
};

export default async function ManagerCombosPage() {
	const combos = getCachedAllCombos();
	const baseDesserts = getCachedBaseDesserts();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<PageFrame as="main" frame="narrow" centered>
			<Suspense
				fallback={
					<div className="flex w-full flex-col gap-3">
						<Skeleton className="h-7 w-32" />
						<Skeleton className="h-5 w-44" />
						<Skeleton className="mt-1 h-11 w-full md:h-9 @2xl/main:max-w-xs" />
						<Skeleton className="mt-3 h-11 w-full md:h-9" />
						<Skeleton className="h-11 w-full md:h-9" />
						<Skeleton className="h-36 w-full rounded-xl" />
					</div>
				}
			>
				<ManageCombos initialCombos={combos} baseDesserts={baseDesserts} modifierDesserts={modifierDesserts} />
			</Suspense>
		</PageFrame>
	);
}
