"use client";

import { use, useCallback, useState } from "react";
import { getCachedDesserts } from "@/app/desserts/actions";
import { DessertsTable } from "@/components/desserts-table";
import type { Dessert } from "@/lib/types";

export default function ManageDesserts({
	initialDesserts,
}: {
	initialDesserts: Promise<Dessert[]>;
}) {
	const initial = use(initialDesserts);
	const [desserts, setDesserts] = useState<Dessert[]>(initial);

	const refetch = useCallback(async () => {
		const newDesserts = await getCachedDesserts({
			shouldShowDisabled: true,
		});
		setDesserts(newDesserts);
	}, []);

	return (
		<DessertsTable
			desserts={desserts}
			setDesserts={setDesserts}
			onRefetch={refetch}
			title="Desserts"
			subtitle="Manage your dessert inventory and visibility"
			maxWidth="max-w-4xl"
		/>
	);
}
