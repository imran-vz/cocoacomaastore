"use client";

import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dessertFormSchema } from "./form-schema/dessert";

type DessertFormValues = {
	name: string;
	description: string;
	price: number;
	isOutOfStock: boolean;
	hasUnlimitedStock: boolean;
};

type DessertFormProps = {
	initialData?: Dessert;
	onSubmit: (values: DessertFormValues) => Promise<void>;
	onDelete?: () => Promise<void>;
	isLoading?: boolean;
};

export function DessertForm({
	initialData,
	onSubmit,
	onDelete,
	isLoading,
}: DessertFormProps) {
	const form = useForm({
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			price: initialData?.price || 0,
			isOutOfStock: initialData?.isOutOfStock || false,
			hasUnlimitedStock: initialData?.hasUnlimitedStock || false,
		},
		validators: {
			onChange: dessertFormSchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	return (
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
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">
								{field.state.meta.errors
									.map((e) => (typeof e === "string" ? e : ""))
									.join(", ")}
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
								{field.state.meta.errors
									.map((e) => (typeof e === "string" ? e : ""))
									.join(", ")}
							</p>
						)}
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
							<Label
								htmlFor={field.name}
								className="font-normal cursor-pointer"
							>
								Unlimited stock
							</Label>
							<p className="text-sm text-muted-foreground">
								For items like water that don't need inventory tracking
							</p>
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
									className={cn(
										"font-normal cursor-pointer",
										hasUnlimitedStock && "text-muted-foreground",
									)}
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
					disabled={isLoading}
				>
					Delete Dessert
				</Button>
				<Button type="submit" className="flex-1" disabled={isLoading}>
					{initialData ? "Update Dessert" : "Add Dessert"}
				</Button>
			</div>
		</form>
	);
}
