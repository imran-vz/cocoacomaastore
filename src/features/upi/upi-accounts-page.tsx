"use client";

import { Plus, QrCode, Trash2 } from "lucide-react";
import { use, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet, useFormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowTile, ListSection, RecordList, RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeader, PageHeaderAction, PageHeaderSkeleton } from "@/components/ui/page-header";
import { SectionHeadingSkeleton } from "@/components/ui/section-heading";
import { Switch } from "@/components/ui/switch";
import { usePageTitle } from "@/features/shell/use-page-chrome";
import { createUpiAccount, deleteUpiAccount, updateUpiAccount } from "@/features/upi/actions";
import { upiAccountsQuery } from "@/features/upi/client";
import type { AdminUpiAccount } from "@/features/upi/shapes";
import { useRunAction } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";

/** The UPI accounts customers can pay to, and which of them checkout shows. */
export function UpiAccountsPage({ accounts }: { accounts: Promise<ServerSnapshot<AdminUpiAccount[]>> }) {
	const { data: upiAccounts } = useSeededQuery(upiAccountsQuery, use(accounts));
	const title = usePageTitle();
	const [sheet, setSheet] = useState<{ open: boolean; account: AdminUpiAccount | null }>({
		open: false,
		account: null,
	});
	const openEditor = (account: AdminUpiAccount | null) => setSheet({ open: true, account });

	return (
		<div className="w-full">
			<UpiAccountSheet
				account={sheet.account}
				open={sheet.open}
				onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
			/>

			<PageHeader
				title={title}
				description="Payment handles offered at checkout."
				action={<PageHeaderAction icon={Plus} label="Add UPI account" onClick={() => openEditor(null)} />}
			/>

			{upiAccounts.length > 0 ? (
				<ListSection title="Accounts" count={upiAccounts.length}>
					<RecordList aria-label="UPI accounts">
						{upiAccounts.map((account) => (
							<UpiAccountRow key={account.id} account={account} onEdit={openEditor} />
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

function UpiAccountSheet({
	account,
	open,
	onOpenChange,
}: {
	account: AdminUpiAccount | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={account ? "Edit UPI account" : "Add UPI account"}
			description={
				account ? "Change how this account appears at checkout." : "Customers pay to this UPI ID at checkout."
			}
			submitLabel={account ? "Save" : "Add"}
			savedLabel={account ? "Updated" : "Created"}
		>
			<UpiAccountFields account={account} />
		</FormSheet>
	);
}

function UpiAccountFields({ account }: { account: AdminUpiAccount | null }) {
	const labelId = useId();
	const upiIdId = useId();
	const enabledId = useId();
	const [initial] = useState(() =>
		account
			? { label: account.label, upiId: account.upiId, enabled: account.enabled }
			: { label: "", upiId: "", enabled: true },
	);
	const [form, setForm] = useState(initial);
	useFormSheet({
		dirty: form.label !== initial.label || form.upiId !== initial.upiId || form.enabled !== initial.enabled,
		onSave: () => (account ? updateUpiAccount(account.id, form) : createUpiAccount(form)),
	});

	return (
		<>
			<div className="space-y-2">
				<Label htmlFor={labelId}>Label</Label>
				<Input
					id={labelId}
					value={form.label}
					onChange={(e) => setForm({ ...form, label: e.target.value })}
					placeholder="PhonePe"
					autoComplete="off"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={upiIdId}>UPI ID</Label>
				<Input
					id={upiIdId}
					value={form.upiId}
					onChange={(e) => setForm({ ...form, upiId: e.target.value })}
					placeholder="name@bank"
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					required
				/>
			</div>
			<div className="flex min-h-11 items-center gap-3">
				<Switch
					id={enabledId}
					checked={form.enabled}
					onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
				/>
				<Label htmlFor={enabledId} className="cursor-pointer">
					Show at checkout
				</Label>
			</div>
		</>
	);
}

function UpiAccountRow({ account, onEdit }: { account: AdminUpiAccount; onEdit: (account: AdminUpiAccount) => void }) {
	const runAction = useRunAction();
	const [confirmOpen, setConfirmOpen] = useState(false);

	// The row disappears once the list refetches; that is the feedback.
	const handleDelete = () =>
		runAction(deleteUpiAccount(account.id), { fallback: "Couldn't delete this UPI account. Try again." });

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
					<span className="font-mono text-meta break-all">{account.upiId}</span>
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

/** The UPI accounts page while it loads. */
export function UpiAccountsSkeleton() {
	return (
		<div aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-36" description action />
			<section>
				<SectionHeadingSkeleton width="w-24" />
				<RecordListSkeleton rows={2} leading metaLines={2} chevron action="icon" />
			</section>
		</div>
	);
}
