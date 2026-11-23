"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { use, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowTile, ListSection, RecordList } from "@/components/ui/list-row";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { type AdminUpiAccount, createUpiAccount, deleteUpiAccount, updateUpiAccount } from "../actions";

const upiAccountsQueryKey = ["admin-upi-accounts"] as const;
const UPI_FORM_ID = "upi-account-form";

function UpiAccountRow({
	account,
	onEdit,
	onDeleted,
}: {
	account: AdminUpiAccount;
	onEdit: (account: AdminUpiAccount) => void;
	onDeleted: () => Promise<void> | void;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);

	/** Runs from the confirmation; a throw keeps it open with the message. */
	const handleDelete = async () => {
		let result: Awaited<ReturnType<typeof deleteUpiAccount>>;
		try {
			result = await deleteUpiAccount(account.id);
		} catch (error) {
			console.error("Failed to delete UPI account:", error);
			throw new Error("Couldn't delete this UPI account. Try again.");
		}
		if (!result.success) {
			console.error("Failed to delete UPI account:", result.error);
			throw new Error("Couldn't delete this UPI account. Try again.");
		}
		// The row disappears on success — that is the feedback.
		await onDeleted();
	};

	return (
		<ListRow
			leading={
				<ListRowTile>
					<QrCode aria-hidden="true" />
				</ListRowTile>
			}
			title={account.label}
			meta={
				<>
					<span className="font-mono text-[13px] break-all">{account.upiId}</span>
					<span className="block">Added {formatDate(account.createdAt)}</span>
				</>
			}
			trailingMeta={account.enabled ? null : <Badge variant="destructive">Disabled</Badge>}
			onClick={() => onEdit(account)}
			rowLabel={`Edit ${account.label}`}
			action={
				<>
					<Button
						variant="ghost"
						size="icon-touch"
						aria-label={`Delete ${account.label}`}
						className="text-muted-foreground hover:text-destructive"
						onClick={() => setConfirmOpen(true)}
					>
						<Trash2 aria-hidden="true" />
					</Button>
					<ConfirmSheet
						open={confirmOpen}
						onOpenChange={setConfirmOpen}
						title={`Delete ${account.label}?`}
						description={`${account.upiId} no longer shows at checkout.`}
						confirmLabel="Delete UPI account"
						pendingLabel="Deleting…"
						onConfirm={handleDelete}
					/>
				</>
			}
		/>
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
	const initialForm = editingAccount
		? { label: editingAccount.label, upiId: editingAccount.upiId, enabled: editingAccount.enabled }
		: { label: "", upiId: "", enabled: true };
	const dirty =
		formData.label !== initialForm.label ||
		formData.upiId !== initialForm.upiId ||
		formData.enabled !== initialForm.enabled;

	const [submitButton, SubmitButton] = useReactiveButton({
		label: editingAccount ? "Save" : "Add",
		loading: { label: "Saving…" },
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
		<div className="w-full">
			<FormSheet
				open={isDialogOpen}
				onOpenChange={handleDialogOpenChange}
				title={editingAccount ? "Edit UPI account" : "Add UPI account"}
				description={
					editingAccount ? "Change how this account appears at checkout." : "Customers pay to this UPI ID at checkout."
				}
				dirty={dirty}
				busy={submitButton.isBusy}
				primary={<SubmitButton type="submit" form={UPI_FORM_ID} size="sm" />}
			>
				<form id={UPI_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={labelID}>Label</Label>
						<Input
							id={labelID}
							value={formData.label}
							onChange={(e) => setFormData({ ...formData, label: e.target.value })}
							placeholder="PhonePe"
							autoComplete="off"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={upiIdID}>UPI ID</Label>
						<Input
							id={upiIdID}
							value={formData.upiId}
							onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
							placeholder="name@bank"
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							required
						/>
					</div>
					<div className="flex min-h-11 items-center gap-3">
						<Switch
							id={enabledID}
							checked={formData.enabled}
							onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
						/>
						<Label htmlFor={enabledID} className="cursor-pointer">
							Show at checkout
						</Label>
					</div>
				</form>
			</FormSheet>

			<PageHeader
				title="UPI accounts"
				description="Payment handles offered at checkout."
				action={<PageHeaderAction icon={Plus} label="Add UPI account" onClick={() => setIsDialogOpen(true)} />}
			/>

			{accounts.length > 0 ? (
				<ListSection title="Accounts" count={accounts.length}>
					<RecordList aria-label="UPI accounts">
						{accounts.map((account) => (
							<UpiAccountRow key={account.id} account={account} onEdit={handleEdit} onDeleted={handleDeleted} />
						))}
					</RecordList>
				</ListSection>
			) : (
				<EmptyState
					variant="block"
					title="No UPI accounts yet"
					description="Add one so the cart can show a UPI QR code."
				/>
			)}
		</div>
	);
}
