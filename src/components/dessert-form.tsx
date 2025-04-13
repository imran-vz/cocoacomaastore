"use client";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	price: z.number().min(0, "Price must be a valid number"),
});

type DessertFormProps = {
	initialData?: Dessert;
	onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>;
	onDelete?: () => Promise<void>;
	isLoading?: boolean;
};

export function DessertForm({
	initialData,
	onSubmit,
	onDelete,
	isLoading,
}: DessertFormProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: initialData || { name: "", description: "", price: 0 },
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="price"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Price (in cents)</FormLabel>
							<FormControl>
								<Input
									type="number"
									{...field}
									onChange={(e) => {
										if (e.target.value === "") {
											field.onChange("");
											return;
										}
										field.onChange(Number(e.target.value));
									}}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
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
		</Form>
	);
}
