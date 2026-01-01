"use client";

import { use, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Dessert } from "@/lib/types";
import {
	getCachedTodayInventory,
	upsertTodayInventory,
	type TodayInventoryRow,
} from "./actions";

function toInventoryMap(rows: TodayInventoryRow[]) {
	return new Map(rows.map((r) => [r.dessertId, r.quantity] as const));
}

export default function InventoryPage({
	initialDesserts,
	initialInventory,
}: {
	initialDesserts: Promise<Dessert[]>;
	initialInventory: Promise<TodayInventoryRow[]>;
}) {
	const desserts = use(initialDesserts);
	const inventoryRows = use(initialInventory);
	const inventoryMap = useMemo(
		() => toInventoryMap(inventoryRows),
		[inventoryRows],
	);

	const [isSaving, setIsSaving] = useState(false);
	const [quantities, setQuantities] = useState<Record<number, string>>(() => {
		const initial: Record<number, string> = {};
		for (const dessert of desserts) {
			initial[dessert.id] = String(inventoryMap.get(dessert.id) ?? 0);
		}
		return initial;
	});

	const todayLabel = useMemo(
		() =>
			new Date().toLocaleDateString("en-IN", {
				year: "numeric",
				month: "short",
				day: "numeric",
			}),
		[],
	);

	const handleSave = async () => {
		try {
			setIsSaving(true);
			await upsertTodayInventory(
				desserts.map((d) => ({
					dessertId: d.id,
					quantity: Number.parseInt(quantities[d.id] ?? "0", 10),
				})),
			);

			const latest = await getCachedTodayInventory();
			const latestMap = toInventoryMap(latest);
			setQuantities((prev) => {
				const next: Record<number, string> = { ...prev };
				for (const dessert of desserts) {
					next[dessert.id] = String(latestMap.get(dessert.id) ?? 0);
				}
				return next;
			});

			toast.success("Inventory saved");
		} catch (error) {
			console.error(error);
			toast.error("Failed to save inventory");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-baseline justify-between gap-2">
				<div>
					<h1 className="text-2xl font-bold">Inventory</h1>
					<p className="text-sm text-muted-foreground">Today: {todayLabel}</p>
				</div>
				<Button onClick={handleSave} disabled={isSaving}>
					{isSaving ? <Spinner /> : "Save"}
				</Button>
			</div>

			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Dessert</TableHead>
							<TableHead className="w-40">Qty</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{desserts.map((dessert) => (
							<TableRow key={dessert.id}>
								<TableCell className="font-medium">
									{dessert.name}
								</TableCell>
								<TableCell>
									<Input
										type="number"
										min={0}
										step={1}
										value={quantities[dessert.id] ?? "0"}
										onChange={(e) => {
											setQuantities((prev) => ({
												...prev,
												[dessert.id]: e.target.value,
											}));
										}}
										className="h-9"
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
