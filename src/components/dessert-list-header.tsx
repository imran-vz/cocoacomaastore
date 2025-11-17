"use client";

import { Edit3, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { useDessertStore } from "@/store/dessert-store";

interface DessertListHeaderProps {
	hasUnsavedChanges: boolean;
	isPending: boolean;
	onToggleEditMode: () => void;
	onSaveChanges: () => void;
	onCancelChanges: () => void;
}

export function DessertListHeader({
	hasUnsavedChanges,
	isPending,
	onToggleEditMode,
	onSaveChanges,
	onCancelChanges,
}: DessertListHeaderProps) {
	const { searchQuery, isEditMode, setSearchQuery } = useDessertStore();
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
				<div className="mb-6">
					<InputGroup>
						<InputGroupInput
							type="text"
							placeholder="Search desserts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
						<InputGroupAddon>
							<Search className="h-4 w-4" />
						</InputGroupAddon>
					</InputGroup>
				</div>
			)}
		</>
	);
}
