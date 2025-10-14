"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	createUpiAccount,
	deleteUpiAccount,
	getUpiAccounts,
	updateUpiAccount,
} from "./actions";
import { Spinner } from "@/components/ui/spinner";
import type { UpiAccount } from "@/db/schema";

export default function UpiPage() {
	const labelID = useId();
	const upiIdID = useId();
	const enabledID = useId();
	const [accounts, setAccounts] = useState<UpiAccount[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<UpiAccount | null>(null);
	const [formData, setFormData] = useState({
		label: "",
		upiId: "",
		enabled: true,
	});

	const loadAccounts = useCallback(async () => {
		setIsLoading(true);
		const data = await getUpiAccounts();
		setAccounts(data);
		setIsLoading(false);
	}, []);

	useEffect(() => {
		loadAccounts();
	}, [loadAccounts]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const result = editingAccount
			? await updateUpiAccount(editingAccount.id, formData)
			: await createUpiAccount(formData);

		if (result.success) {
			toast.success(
				editingAccount
					? "UPI account updated successfully"
					: "UPI account created successfully",
			);
			setIsDialogOpen(false);
			setEditingAccount(null);
			setFormData({ label: "", upiId: "", enabled: true });
			loadAccounts();
		} else {
			toast.error(result.error || "Failed to save UPI account");
		}
	};

	const handleEdit = (account: UpiAccount) => {
		setEditingAccount(account);
		setFormData({
			label: account.label,
			upiId: account.upiId,
			enabled: account.enabled,
		});
		setIsDialogOpen(true);
	};

	const handleDelete = async (id: UpiAccount["id"]) => {
		if (!confirm("Are you sure you want to delete this UPI account?")) {
			return;
		}

		const result = await deleteUpiAccount(id);

		if (result.success) {
			toast.success("UPI account deleted successfully");
			loadAccounts();
		} else {
			toast.error(result.error || "Failed to delete UPI account");
		}
	};

	const handleDialogClose = () => {
		setIsDialogOpen(false);
		setEditingAccount(null);
		setFormData({ label: "", upiId: "", enabled: true });
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">UPI Accounts</h1>
					<p className="text-muted-foreground">Manage UPI payment accounts</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
					<Button
						type="button"
						onClick={() => {
							console.log("clicked");
							setIsDialogOpen(true);
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add UPI Account
					</Button>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editingAccount ? "Edit UPI Account" : "Add New UPI Account"}
							</DialogTitle>
							<DialogDescription>
								{editingAccount
									? "Update UPI account details"
									: "Create a new UPI payment account"}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor={labelID}>Label</Label>
								<Input
									id={labelID}
									value={formData.label}
									onChange={(e) =>
										setFormData({ ...formData, label: e.target.value })
									}
									placeholder="e.g., Primary Account"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={upiIdID}>UPI ID</Label>
								<Input
									id={upiIdID}
									value={formData.upiId}
									onChange={(e) =>
										setFormData({ ...formData, upiId: e.target.value })
									}
									placeholder="e.g., username@upi"
									required
								/>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="checkbox"
									id={enabledID}
									checked={formData.enabled}
									onChange={(e) =>
										setFormData({ ...formData, enabled: e.target.checked })
									}
									className="h-4 w-4"
								/>
								<Label htmlFor={enabledID} className="cursor-pointer">
									Enabled
								</Label>
							</div>
							<Button type="submit" className="w-full">
								{editingAccount ? "Update UPI Account" : "Create UPI Account"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="flex justify-center items-center min-h-[calc(100vh-252px)]">
					<Spinner className="size-10" />
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Label</TableHead>
							<TableHead>UPI ID</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Created At</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{accounts.map((account) => (
							<TableRow key={account.id}>
								<TableCell className="font-medium">{account.label}</TableCell>
								<TableCell>{account.upiId}</TableCell>
								<TableCell>
									<Badge variant={account.enabled ? "default" : "secondary"}>
										{account.enabled ? "Enabled" : "Disabled"}
									</Badge>
								</TableCell>
								<TableCell>
									{new Date(account.createdAt).toLocaleDateString()}
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleEdit(account)}
										>
											<Edit className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDelete(account.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
