"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { use, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowTile, ListSection, RecordList } from "@/components/ui/list-row";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatInitials, roleLabel } from "@/lib/format";
import { createManager, deleteManager, type ManagerRow } from "../actions";

const managersQueryKey = ["admin-managers"] as const;
const MANAGER_FORM_ID = "add-manager-form";
const EMPTY_MANAGER_FORM = { name: "", email: "", password: "", role: "user" as "admin" | "user" };

async function fetchManagers(signal?: AbortSignal): Promise<ManagerRow[]> {
	const response = await fetch("/api/admin/managers", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch managers (${response.status})`);
	}

	return response.json();
}

export default function ManagerClientPage({ managers }: { managers: Promise<ManagerRow[]> }) {
	const nameID = useId();
	const emailID = useId();
	const passwordID = useId();
	const roleID = useId();
	const initialManagers = use(managers);
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const queryClient = useQueryClient();
	const { data: managersList, error } = useQuery({
		queryKey: managersQueryKey,
		queryFn: ({ signal }) => fetchManagers(signal),
		initialData: initialManagers,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const submitTokenRef = useRef<number | null>(null);
	const [formData, setFormData] = useState(EMPTY_MANAGER_FORM);
	const dirty = (Object.keys(EMPTY_MANAGER_FORM) as (keyof typeof EMPTY_MANAGER_FORM)[]).some(
		(key) => formData[key] !== EMPTY_MANAGER_FORM[key],
	);

	const [submitButton, SubmitButton] = useReactiveButton({
		label: "Add",
		loading: { label: "Adding…" },
		success: { label: "Created" },
	});

	const resetForm = () => setFormData(EMPTY_MANAGER_FORM);

	const handleSubmit = async (e: React.SubmitEvent) => {
		e.preventDefault();
		if (submitTokenRef.current !== null || submitButton.status !== "idle") return;

		const token = submitButton.setLoading();
		submitTokenRef.current = token;
		try {
			const result = await createManager(formData);
			if (!result.success) {
				if (submitButton.setError(result.error || "Failed to create", { token })) {
					submitTokenRef.current = null;
				}
				return;
			}

			await queryClient.invalidateQueries({ queryKey: managersQueryKey });
			if (submitTokenRef.current !== token) return;
			if (
				submitButton.setSuccess(undefined, {
					token,
					duration: 900,
					onComplete: () => {
						setIsDialogOpen(false);
						resetForm();
					},
				})
			) {
				submitTokenRef.current = null;
			}
		} catch (error) {
			console.error("Failed to create manager:", error);
			if (submitButton.setError("Failed to create", { token })) {
				submitTokenRef.current = null;
			}
		} finally {
			if (submitTokenRef.current === token) {
				submitTokenRef.current = null;
			}
		}
	};

	if (error) {
		console.error("Failed to fetch managers:", error);
	}

	const adminCount = managersList.filter(({ role }) => role === "admin").length;

	return (
		<div className="w-full">
			<FormSheet
				open={isDialogOpen}
				onOpenChange={(open) => {
					setIsDialogOpen(open);
					if (!open) {
						submitButton.reset();
						if (submitTokenRef.current === null) {
							resetForm();
						}
					}
				}}
				title="Add manager"
				description="They sign in with this email and password."
				dirty={dirty}
				busy={submitButton.isBusy}
				primary={<SubmitButton type="submit" form={MANAGER_FORM_ID} size="sm" />}
			>
				<form id={MANAGER_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={nameID}>Name</Label>
						<Input
							id={nameID}
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							autoComplete="off"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={emailID}>Email</Label>
						<Input
							id={emailID}
							type="email"
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
							autoComplete="off"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={passwordID}>Password</Label>
						<Input
							id={passwordID}
							type="password"
							value={formData.password}
							onChange={(e) => setFormData({ ...formData, password: e.target.value })}
							autoComplete="new-password"
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={roleID}>Role</Label>
						<Select
							value={formData.role}
							onValueChange={(value) =>
								setFormData({
									...formData,
									role: value as "user" | "admin",
								})
							}
						>
							<SelectTrigger id={roleID} className="w-full">
								<SelectValue>{roleLabel(formData.role)}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="user">Manager</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-[13px] text-muted-foreground">
							Managers sell, count stock and edit the catalog. Admins also see insights and settings.
						</p>
					</div>
				</form>
			</FormSheet>

			<PageHeader
				title="Managers"
				description="Who can sign in to the counter."
				action={<PageHeaderAction icon={Plus} label="Add manager" onClick={() => setIsDialogOpen(true)} />}
			/>

			<ListSection title="Accounts" count={managersList.length}>
				<RecordList aria-label="Accounts">
					{managersList.map((manager) => {
						const isSelf = session?.user.id === manager.id;
						const isLastAdmin = manager.role === "admin" && adminCount === 1;
						const deleteBlockedReason =
							isSessionPending || !session
								? "Delete unavailable until your session is available"
								: isSelf
									? "You cannot delete your own account"
									: isLastAdmin
										? "You cannot delete the sole administrator"
										: undefined;

						return (
							<ListRow
								key={manager.id}
								leading={<ListRowTile>{formatInitials(manager.name)}</ListRowTile>}
								title={isSelf ? `${manager.name} (you)` : manager.name}
								meta={
									<>
										<EmailText email={manager.email} />
										<span className="block">
											{roleLabel(manager.role)} · Added {formatDate(manager.createdAt)}
										</span>
									</>
								}
								action={
									isSelf ? null : (
										<DeleteManagerButton
											manager={manager}
											disabledReason={deleteBlockedReason}
											onDeleted={() => queryClient.invalidateQueries({ queryKey: managersQueryKey })}
										/>
									)
								}
							/>
						);
					})}
				</RecordList>
			</ListSection>
		</div>
	);
}

/** Lets a long address wrap before the "@" instead of mid-word. */
function EmailText({ email }: { email: string }) {
	const at = email.indexOf("@");
	if (at <= 0) return <span className="break-words">{email}</span>;
	return (
		<span className="break-words">
			{email.slice(0, at)}
			<wbr />
			{email.slice(at)}
		</span>
	);
}

function DeleteManagerButton({
	manager,
	disabledReason,
	onDeleted,
}: {
	manager: ManagerRow;
	disabledReason?: string;
	onDeleted: () => Promise<unknown>;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);

	/** Runs from the confirmation; a throw keeps it open with the message. */
	const handleDelete = async () => {
		let result: Awaited<ReturnType<typeof deleteManager>>;
		try {
			result = await deleteManager(manager.id);
		} catch (error) {
			console.error("Failed to delete manager:", error);
			throw new Error("Couldn't delete this account. Try again.");
		}
		if (!result.success) {
			console.error("Failed to delete manager:", result.error);
			throw new Error("Couldn't delete this account. Try again.");
		}
		// Success: the row disappears once the list refetches — that is the feedback.
		await onDeleted();
	};

	return (
		<>
			<Button
				variant="ghost"
				size="icon-touch"
				className="text-muted-foreground hover:text-destructive"
				disabled={Boolean(disabledReason)}
				title={disabledReason}
				aria-label={disabledReason ?? `Delete ${manager.name}`}
				onClick={() => setConfirmOpen(true)}
			>
				<Trash2 aria-hidden="true" />
			</Button>
			<ConfirmSheet
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={`Delete ${manager.name}?`}
				description={`${manager.email} can no longer sign in to the counter.`}
				confirmLabel={manager.role === "admin" ? "Delete admin" : "Delete manager"}
				pendingLabel="Deleting…"
				onConfirm={handleDelete}
			/>
		</>
	);
}
