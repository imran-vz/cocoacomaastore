"use client";

import { Plus, Trash2 } from "lucide-react";
import { use, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { EmailText } from "@/components/ui/email-text";
import { FormSheet, useFormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowTile, ListSection, RecordList, RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeader, PageHeaderAction, PageHeaderSkeleton } from "@/components/ui/page-header";
import { SectionHeadingSkeleton } from "@/components/ui/section-heading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREA_LABEL, type Area } from "@/features/access/area";
import { PASSWORD_HINT, PASSWORD_LENGTH } from "@/features/access/password";
import { usePageTitle } from "@/features/shell/use-page-chrome";
import { createStaffAccount, deleteStaffAccount } from "@/features/staff/actions";
import { staffAccountsQuery } from "@/features/staff/client";
import type { StaffAccount } from "@/features/staff/queries";
import { useRunAction } from "@/lib/action-result";
import { formatDate, formatInitials } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";

const EMPTY_FORM = { name: "", email: "", password: "", area: "manager" as Area };

/** Staff accounts: who can sign in, in which area, and adding or removing them. */
export function StaffPage({
	accounts,
	currentUserId,
}: {
	accounts: Promise<ServerSnapshot<StaffAccount[]>>;
	currentUserId: string;
}) {
	const { data: staff } = useSeededQuery(staffAccountsQuery, use(accounts));
	const [addOpen, setAddOpen] = useState(false);
	const title = usePageTitle();

	return (
		<div className="w-full">
			<AddStaffSheet open={addOpen} onOpenChange={setAddOpen} />

			<PageHeader
				title={title}
				description="Who can sign in to the counter."
				action={<PageHeaderAction icon={Plus} label="Add manager" onClick={() => setAddOpen(true)} />}
			/>

			<ListSection title="Accounts" count={staff.length}>
				<RecordList aria-label="Accounts">
					{staff.map((account) => {
						const isSelf = account.id === currentUserId;
						return (
							<ListRow
								key={account.id}
								leading={<ListRowTile>{formatInitials(account.name)}</ListRowTile>}
								title={isSelf ? `${account.name} (you)` : account.name}
								meta={
									<>
										<EmailText email={account.email} />
										<span className="block">
											{AREA_LABEL[account.area]} · Added {formatDate(account.createdAt)}
										</span>
									</>
								}
								action={isSelf ? null : <DeleteStaffButton account={account} />}
							/>
						);
					})}
				</RecordList>
			</ListSection>
		</div>
	);
}

function AddStaffSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title="Add manager"
			description="They sign in with this email and password."
			submitLabel="Add"
			savedLabel="Created"
		>
			<AddStaffFields />
		</FormSheet>
	);
}

function AddStaffFields() {
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const passwordHintId = useId();
	const areaId = useId();
	const [form, setForm] = useState(EMPTY_FORM);
	useFormSheet({
		dirty: (Object.keys(EMPTY_FORM) as (keyof typeof EMPTY_FORM)[]).some((key) => form[key] !== EMPTY_FORM[key]),
		onSave: () => createStaffAccount(form),
	});

	return (
		<>
			<div className="space-y-2">
				<Label htmlFor={nameId}>Name</Label>
				<Input
					id={nameId}
					value={form.name}
					onChange={(e) => setForm({ ...form, name: e.target.value })}
					autoComplete="off"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={emailId}>Email</Label>
				<Input
					id={emailId}
					type="email"
					value={form.email}
					onChange={(e) => setForm({ ...form, email: e.target.value })}
					autoComplete="off"
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={passwordId}>Password</Label>
				<Input
					id={passwordId}
					type="password"
					value={form.password}
					onChange={(e) => setForm({ ...form, password: e.target.value })}
					autoComplete="new-password"
					minLength={PASSWORD_LENGTH.min}
					maxLength={PASSWORD_LENGTH.max}
					aria-describedby={passwordHintId}
					required
				/>
				<p id={passwordHintId} className="text-meta text-muted-foreground">
					{PASSWORD_HINT}
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor={areaId}>Role</Label>
				<Select value={form.area} onValueChange={(value) => setForm({ ...form, area: value as Area })}>
					<SelectTrigger id={areaId} className="w-full">
						<SelectValue>{AREA_LABEL[form.area]}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="manager">{AREA_LABEL.manager}</SelectItem>
						<SelectItem value="admin">{AREA_LABEL.admin}</SelectItem>
					</SelectContent>
				</Select>
				<p className="text-meta text-muted-foreground">
					Managers sell, count stock and edit the catalog. Admins also see insights and settings.
				</p>
			</div>
		</>
	);
}

function DeleteStaffButton({ account }: { account: StaffAccount }) {
	const runAction = useRunAction();
	const [confirmOpen, setConfirmOpen] = useState(false);

	// The row disappears once the list refetches; that is the feedback.
	const handleDelete = () =>
		runAction(deleteStaffAccount(account.id), { fallback: "Couldn't delete this account. Try again." });

	return (
		<>
			<Button
				variant="ghost"
				size="icon-touch"
				className="text-muted-foreground hover:text-destructive"
				aria-label={`Delete ${account.name}`}
				onClick={() => setConfirmOpen(true)}
			>
				<Trash2 aria-hidden="true" />
			</Button>
			<ConfirmSheet
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={`Delete ${account.name}?`}
				description={`${account.email} can no longer sign in to the counter.`}
				confirmLabel={account.area === "admin" ? "Delete admin" : "Delete manager"}
				pendingLabel="Deleting…"
				onConfirm={handleDelete}
			/>
		</>
	);
}

/** The Managers page while it loads. */
export function StaffSkeleton() {
	return (
		<div aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-36" description action />
			<section>
				<SectionHeadingSkeleton width="w-24" />
				<RecordListSkeleton rows={5} leading metaLines={2} action="icon" />
			</section>
		</div>
	);
}
