"use client";

import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReactiveButtonComponent, ReactiveButtonControls } from "@/components/ui/reactive-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { distance } from "@/lib/levenshtein-distance";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dessertFormSchema } from "./form-schema/dessert";

type onSubmit = (values: Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted">) => Promise<void>;

type DessertFormProps = {
	initialData?: Dessert;
	onSubmit: onSubmit;
	onDelete?: () => Promise<void>;
	/** Controls for the shared submit button (state lives in the parent). */
	submitControls: ReactiveButtonControls;
	/** Stable reactive submit button, configured by the parent. */
	SubmitButton: ReactiveButtonComponent;
	existingNames?: string[];
};

type NameHint =
	| { tier: "exact"; message: string }
	| { tier: "starts-with"; message: string }
	| { tier: "levenshtein"; message: string; match: string };

function getNameHint(input: string, existingNames: string[]): NameHint | null {
	if (!input.trim() || existingNames.length === 0) return null;

	const lowerInput = input.trim().toLowerCase();

	// Tier 1: Exact match (case-insensitive)
	const exactMatch = existingNames.find((n) => n.toLowerCase() === lowerInput);
	if (exactMatch) {
		return {
			tier: "exact",
			message: `⚠️ A dessert named "${exactMatch}" already exists`,
		};
	}

	// Tier 2: Starts-with match (input ≥ 3 chars)
	if (lowerInput.length >= 3) {
		const startsWithMatches = existingNames.filter((n) => n.toLowerCase().startsWith(lowerInput));
		if (startsWithMatches.length > 0) {
			const display = startsWithMatches.slice(0, 3).join(", ");
			return {
				tier: "starts-with",
				message: `⚠️ Similar desserts exist: ${display}`,
			};
		}
	}

	// Tier 3: Levenshtein distance ≤ 2 (input ≥ 6 chars)
	if (lowerInput.length >= 6) {
		const closeMatches = existingNames.filter((n) => distance(lowerInput, n.toLowerCase()) <= 2);
		if (closeMatches.length > 0) {
			return {
				tier: "levenshtein",
				message: `💡 Did you mean "${closeMatches[0]}"?`,
				match: closeMatches[0],
			};
		}
	}

	return null;
}

export function DessertForm({
	initialData,
	onSubmit,
	onDelete,
	submitControls,
	SubmitButton,
	existingNames = [],
}: DessertFormProps) {
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const [pendingValues, setPendingValues] = useState<Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted"> | null>(
		null,
	);
	const [currentName, setCurrentName] = useState(initialData?.name || "");
	const nameHint = useMemo(() => getNameHint(currentName, existingNames), [currentName, existingNames]);

	const form = useForm({
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			price: initialData?.price || 0,
			kind: initialData?.kind || ("base" as const),
			isOutOfStock: initialData?.isOutOfStock || false,
			hasUnlimitedStock: initialData?.hasUnlimitedStock || false,
		},
		validators: {
			onChange: dessertFormSchema,
		},
		onSubmit: async ({ value }) => {
			// Check if there's a levenshtein hint — requires confirmation
			if (nameHint?.tier === "levenshtein" && !pendingValues) {
				setPendingValues(value);
				setShowConfirmDialog(true);
				return;
			}
			setPendingValues(null);
			await onSubmit(value);
		},
	});

	return (
		<>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<form.Field name="name">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>Name</Label>
							<Input
								id={field.name}
								value={field.state.value}
								onChange={(e) => {
									field.handleChange(e.target.value);
									setCurrentName(e.target.value);
								}}
								onBlur={field.handleBlur}
							/>
							{nameHint && (
								<p
									className={cn(
										"text-sm",
										nameHint.tier === "levenshtein" ? "text-muted-foreground" : "text-amber-600 font-medium",
									)}
								>
									{nameHint.message}
								</p>
							)}
							{field.state.meta.errors.length > 0 && (
								<p className="text-sm text-destructive">
									{field.state.meta.errors.map((e) => (typeof e === "string" ? e : "")).join(", ")}
								</p>
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
							<Label htmlFor={field.name}>Price (₹)</Label>
							<Input
								id={field.name}
								type="number"
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
								<p className="text-sm text-destructive">
									{field.state.meta.errors.map((e) => (typeof e === "string" ? e : "")).join(", ")}
								</p>
							)}
						</div>
					)}
				</form.Field>

				<form.Field name="kind">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>Type</Label>
							<Select
								value={field.state.value}
								onValueChange={(value) => field.handleChange(value as "base" | "modifier")}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="base">Base Dessert</SelectItem>
									<SelectItem value="modifier">Modifier (Add-on)</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Base desserts have inventory tracking. Modifiers are add-ons for combos.
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
								<p className="text-sm text-muted-foreground">For items like water that don't need inventory tracking</p>
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

				<div className="flex gap-2">
					<Button
						type="button"
						className={cn("flex-1", initialData ? "" : "invisible")}
						variant="outline"
						onClick={onDelete}
						disabled={submitControls.isBusy || submitControls.status === "success"}
					>
						Delete Dessert
					</Button>
					<SubmitButton type="submit" className="flex-1" />
				</div>
			</form>

			{/* Confirmation dialog for levenshtein soft hints */}
			<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Similar dessert exists</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						A similar dessert{nameHint?.tier === "levenshtein" ? ` "${nameHint.match}"` : ""} already exists. Are you
						sure you want to {initialData ? "update" : "create"} this dessert?
					</p>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => {
								setShowConfirmDialog(false);
								setPendingValues(null);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								setShowConfirmDialog(false);
								if (pendingValues) {
									await onSubmit(pendingValues);
									setPendingValues(null);
								}
							}}
						>
							Continue
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
