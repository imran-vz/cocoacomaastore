"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { use, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AdminUpiAccount, createUpiAccount, deleteUpiAccount, updateUpiAccount } from "../actions";

const upiAccountsQueryKey = ["admin-upi-accounts"] as const;

function UpiAccountRow({
	account,
	onEdit,
	onDeleted,
}: {
	account: AdminUpiAccount;
	onEdit: (account: AdminUpiAccount) => void;
	onDeleted: () => Promise<void> | void;
}) {
	const [deleteButton, DeleteButton] = useReactiveButton({
		label: <Trash2 className="h-4 w-4" />,
		icon: null,
		loading: { label: "" },
		error: { label: "Failed" },
	});

	const handleDelete = async () => {
		if (deleteButton.status === "loading" || deleteButton.status === "success") return;
		if (!confirm("Are you sure you want to delete this UPI account?")) {
			return;
		}

		const token = deleteButton.setLoading();
		try {
			const result = await deleteUpiAccount(account.id);
			if (!result.success) {
				console.error("Failed to delete UPI account:", result.error);
				deleteButton.setError("Failed", { token });
				return;
			}
			// The row disappears on success — that is the feedback.
			await onDeleted();
		} catch (error) {
			console.error("Failed to delete UPI account:", error);
			deleteButton.setError("Failed", { token });
		}
	};

	return (
		<TableRow>
			<TableCell className="font-medium">{account.label}</TableCell>
			<TableCell>{account.upiId}</TableCell>
			<TableCell>
				<Badge variant={account.enabled ? "default" : "secondary"}>{account.enabled ? "Enabled" : "Disabled"}</Badge>
			</TableCell>
			<TableCell>{new Date(account.createdAt).toLocaleDateString()}</TableCell>
			<TableCell className="text-right">
				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
						<Edit className="h-4 w-4" />
					</Button>
					<DeleteButton variant="ghost" size="sm" onClick={handleDelete} />
				</div>
			</TableCell>
		</TableRow>
	);
}

async function fetchUpiAccounts(signal?: AbortSignal): Promise<AdminUpiAccount[]> {
	const response = await fetch("/api/admin/upi", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch UPI accounts (${response.status})`);
	}

	return response.json();
}

export default function UpiClientPage({ upiAccounts }: { upiAccounts: Promise<AdminUpiAccount[]> }) {
	const labelID = useId();
	const upiIdID = useId();
	const enabledID = useId();
	const initialAccounts = use(upiAccounts);
	const queryClient = useQueryClient();
	const { data: accounts, error } = useQuery({
		queryKey: upiAccountsQueryKey,
		queryFn: ({ signal }) => fetchUpiAccounts(signal),
		initialData: initialAccounts,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<AdminUpiAccount | null>(null);
	const [formData, setFormData] = useState({
		label: "",
		upiId: "",
		enabled: true,
	});

	const [submitButton, SubmitButton] = useReactiveButton({
		label: editingAccount ? "Update UPI Account" : "Create UPI Account",
		loading: { label: "Saving..." },
		success: { label: editingAccount ? "Updated" : "Created", duration: 900 },
	});

	const resetForm = () => {
		setEditingAccount(null);
		setFormData({ label: "", upiId: "", enabled: true });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitButton.status === "loading" || submitButton.status === "success") return;

		const wasEditing = Boolean(editingAccount);
		const token = submitButton.setLoading();
		try {
			const result = editingAccount
				? await updateUpiAccount(editingAccount.id, formData)
				: await createUpiAccount(formData);

			if (!result.success) {
				submitButton.setError(result.error || "Failed to save UPI account", { token });
				return;
			}

			await queryClient.invalidateQueries({ queryKey: upiAccountsQueryKey });
			submitButton.setSuccess(wasEditing ? "Updated" : "Created", {
				token,
				duration: 900,
				onComplete: () => {
					setIsDialogOpen(false);
					resetForm();
				},
			});
		} catch (error) {
			console.error("Failed to save UPI account:", error);
			submitButton.setError("Failed to save", { token });
		}
	};

	const handleEdit = (account: AdminUpiAccount) => {
		setEditingAccount(account);
		setFormData({
			label: account.label,
			upiId: account.upiId,
			enabled: account.enabled,
		});
		setIsDialogOpen(true);
	};

	const handleDeleted = async () => {
		await queryClient.invalidateQueries({ queryKey: upiAccountsQueryKey });
	};

	const handleDialogOpenChange = (open: boolean) => {
		setIsDialogOpen(open);
		if (!open && !submitButton.isBusy) {
			submitButton.reset();
			resetForm();
		}
	};

	if (error) {
		console.error("Failed to fetch UPI accounts:", error);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">UPI Accounts</h2>
					<p className="text-muted-foreground">Manage UPI payment accounts</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
					<Button
						type="button"
						onClick={() => {
							setIsDialogOpen(true);
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add UPI Account
					</Button>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{editingAccount ? "Edit UPI Account" : "Add New UPI Account"}</DialogTitle>
							<DialogDescription>
								{editingAccount ? "Update UPI account details" : "Create a new UPI payment account"}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor={labelID}>Label</Label>
								<Input
									id={labelID}
									value={formData.label}
									onChange={(e) => setFormData({ ...formData, label: e.target.value })}
									placeholder="e.g., Primary Account"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={upiIdID}>UPI ID</Label>
								<Input
									id={upiIdID}
									value={formData.upiId}
									onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
									placeholder="e.g., username@upi"
									required
								/>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="checkbox"
									id={enabledID}
									checked={formData.enabled}
									onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
									className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
								/>
								<Label htmlFor={enabledID} className="cursor-pointer">
									Enabled
								</Label>
							</div>
							<SubmitButton type="submit" className="w-full" />
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="rounded-md border">
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
							<UpiAccountRow key={account.id} account={account} onEdit={handleEdit} onDeleted={handleDeleted} />
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
