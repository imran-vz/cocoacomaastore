"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSheet, useFormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createDessert, deleteDessert, updateDessert } from "@/features/catalog/actions";
import { comboCatalogQuery } from "@/features/catalog/client";
import { nameHint } from "@/features/catalog/name-hint";
import type { Dessert } from "@/features/catalog/queries";
import { type DessertInput, type DessertKind, dessertInputSchema } from "@/features/catalog/schemas";
import { formatList } from "@/lib/format";
import { cn } from "@/lib/utils";

function fieldErrors(errors: unknown[]) {
	return errors
		.map((error) => (typeof error === "string" ? error : (error as { message?: string } | undefined)?.message))
		.filter(Boolean)
		.join(", ");
}

function deleteDessertNote(combosUsing: string[]) {
	const combos =
		combosUsing.length === 0
			? ""
			: combosUsing.length === 1
				? ` The combo ${combosUsing[0]} uses it and stops selling.`
				: ` Combos using it stop selling: ${formatList(combosUsing)}.`;
	return `It leaves the catalog and the Sell screen.${combos} Past orders aren't affected.`;
}

/** The Add / Edit dessert sheet, with Delete in its `⋯` menu. */
export function DessertFormSheet({
	open,
	onOpenChange,
	dessert,
	desserts,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The dessert to edit; `null` adds one. */
	dessert: Dessert | null;
	/** Every dessert in the catalog. */
	desserts: Dessert[];
}) {
	const otherNames = useMemo(
		() => desserts.filter(({ id }) => id !== dessert?.id).map(({ name }) => name),
		[desserts, dessert],
	);
	const { data: comboCatalog } = useQuery({ ...comboCatalogQuery, enabled: open && dessert !== null });
	const combosUsing = dessert
		? (comboCatalog?.combos ?? [])
				.filter(
					(combo) =>
						combo.baseDessertId === dessert.id || combo.items.some(({ dessertId }) => dessertId === dessert.id),
				)
				.map((combo) => combo.name)
		: [];

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={dessert ? "Edit dessert" : "Add dessert"}
			submitLabel={dessert ? "Save" : "Add"}
			savedLabel={dessert ? "Updated" : "Added"}
			onDelete={dessert ? () => deleteDessert(dessert.id) : undefined}
			deleteLabel="Delete dessert"
			deleteTitle={`Delete ${dessert?.name ?? "dessert"}?`}
			deleteDescription={deleteDessertNote(combosUsing)}
		>
			<DessertFields dessert={dessert} otherNames={otherNames} />
		</FormSheet>
	);
}

function DessertFields({ dessert, otherNames }: { dessert: Dessert | null; otherNames: string[] }) {
	const [defaultValues] = useState<DessertInput>(() => ({
		name: dessert?.name ?? "",
		description: dessert?.description ?? "",
		price: dessert?.price ?? 0,
		kind: dessert?.kind ?? "base",
		isOutOfStock: dessert?.isOutOfStock ?? false,
		hasUnlimitedStock: dessert?.hasUnlimitedStock ?? false,
	}));
	const form = useForm({ defaultValues, validators: { onChange: dessertInputSchema } });

	const values = useStore(form.store, (state) => state.values);
	const hint = useMemo(() => nameHint(values.name, otherNames), [values.name, otherNames]);
	const dirty = (Object.keys(defaultValues) as (keyof typeof defaultValues)[]).some(
		(key) => values[key] !== defaultValues[key],
	);

	useFormSheet({
		dirty,
		onSave: async () => {
			const parsed = dessertInputSchema.safeParse(form.state.values);
			if (!parsed.success) {
				// Shows each field's error under it.
				await form.handleSubmit();
				return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the dessert" };
			}
			const input = form.state.values;
			return dessert ? updateDessert(dessert.id, input) : createDessert(input);
		},
	});

	return (
		<>
			<form.Field name="name">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Name</Label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>
						{hint && <p className="text-sm font-medium text-warning">{hint.message}</p>}
						{field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">{fieldErrors(field.state.meta.errors)}</p>
						)}
					</div>
				)}
			</form.Field>

			<form.Field name="description">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Description</Label>
						<Textarea
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>
					</div>
				)}
			</form.Field>

			<form.Field name="price">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Price</Label>
						<Input
							id={field.name}
							type="number"
							inputMode="numeric"
							value={field.state.value}
							onChange={(e) => {
								if (e.target.value === "") {
									field.handleChange(0);
									return;
								}
								field.handleChange(Number(e.target.value));
							}}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">{fieldErrors(field.state.meta.errors)}</p>
						)}
					</div>
				)}
			</form.Field>

			<form.Field name="kind">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>Type</Label>
						<Select value={field.state.value} onValueChange={(value) => field.handleChange(value as DessertKind)}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select type">
									{field.state.value === "modifier" ? "Add-on" : "Dessert"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="base">Dessert</SelectItem>
								<SelectItem value="modifier">Add-on</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Desserts are sold on their own and have stock. Add-ons are extras inside combos.
						</p>
					</div>
				)}
			</form.Field>

			<form.Field name="hasUnlimitedStock">
				{(field) => (
					<div className="flex flex-row items-center space-x-3 space-y-0">
						<Checkbox
							id={field.name}
							checked={field.state.value}
							onCheckedChange={(checked) => {
								field.handleChange(!!checked);
								if (checked) {
									form.setFieldValue("isOutOfStock", false);
								}
							}}
						/>
						<div className="space-y-1 leading-none">
							<Label htmlFor={field.name} className="font-normal cursor-pointer">
								Unlimited stock
							</Label>
							<p className="text-sm text-muted-foreground">For items like water that aren't counted</p>
						</div>
					</div>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.hasUnlimitedStock}>
				{(hasUnlimitedStock) => (
					<form.Field name="isOutOfStock">
						{(field) => (
							<div className="flex flex-row items-center space-x-3 space-y-0">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(!!checked)}
									disabled={hasUnlimitedStock}
								/>
								<Label
									htmlFor={field.name}
									className={cn("font-normal cursor-pointer", hasUnlimitedStock && "text-muted-foreground")}
								>
									Mark as out of stock
								</Label>
							</div>
						)}
					</form.Field>
				)}
			</form.Subscribe>
		</>
	);
}
