"use client";

import { Edit3, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DessertListHeaderProps {
	isEditMode: boolean;
	hasUnsavedChanges: boolean;
	isPending: boolean;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	onToggleEditMode: () => void;
	onSaveChanges: () => void;
	onCancelChanges: () => void;
}

export function DessertListHeader({
	isEditMode,
	hasUnsavedChanges,
	isPending,
	searchQuery,
	onSearchChange,
	onToggleEditMode,
	onSaveChanges,
	onCancelChanges,
}: DessertListHeaderProps) {
	return (
		<>
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-2xl font-bold">Our Desserts</h2>
				<div className="flex items-center gap-2">
					{isEditMode ? (
						<>
							{hasUnsavedChanges && (
								<Button
									onClick={onCancelChanges}
									variant="outline"
									size="sm"
									className="flex items-center gap-2"
									disabled={isPending}
								>
									<X className="h-4 w-4" />
									Cancel
								</Button>
							)}
							<Button
								onClick={onSaveChanges}
								variant="default"
								size="sm"
								className="flex items-center gap-2"
								disabled={isPending}
							>
								<Save className="h-4 w-4" />
								{isPending ? "Saving..." : "Done"}
							</Button>
						</>
					) : (
						<Button
							onClick={onToggleEditMode}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<Edit3 className="h-4 w-4" />
							Edit Order
						</Button>
					)}
				</div>
			</div>

			{/* Search input - only shown when not in edit mode */}
			{!isEditMode && (
				<div className="relative mb-6">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search desserts..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						className="pl-10"
					/>
				</div>
			)}
		</>
	);
}
