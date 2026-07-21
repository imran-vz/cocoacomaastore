"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { use, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { createManager, deleteManager, type ManagerRow } from "../actions";

const managersQueryKey = ["admin-managers"] as const;

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
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		role: "user" as "admin" | "user",
	});

	const [submitButton, SubmitButton] = useReactiveButton({
		label: "Create Manager",
		loading: { label: "Creating..." },
		success: { label: "Created" },
	});

	const resetForm = () => setFormData({ name: "", email: "", password: "", role: "user" });

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

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Managers</h2>
					<p className="text-muted-foreground">Manage admin and manager accounts</p>
				</div>
				<Dialog
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
				>
					<Button type="button" onClick={() => setIsDialogOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Add Manager
					</Button>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New Manager</DialogTitle>
							<DialogDescription>Create a new manager or admin account</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor={nameID}>Name</Label>
								<Input
									id={nameID}
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="user">User</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
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
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Created At</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{managersList.map((manager) => {
							const isSelf = session?.user.id === manager.id;
							const isLastAdmin =
								manager.role === "admin" && managersList.filter(({ role }) => role === "admin").length === 1;
							const deleteBlockedReason =
								isSessionPending || !session
									? "Delete unavailable until your session is available"
									: isSelf
										? "You cannot delete your own account"
										: isLastAdmin
											? "You cannot delete the sole administrator"
											: undefined;

							return (
								<TableRow key={manager.id}>
									<TableCell className="font-medium">{manager.name}</TableCell>
									<TableCell>{manager.email}</TableCell>
									<TableCell className="capitalize">
										<Badge variant={manager.role === "admin" ? "default" : "secondary"}>{manager.role}</Badge>
									</TableCell>
									<TableCell>{new Date(manager.createdAt).toLocaleDateString()}</TableCell>
									<TableCell className="text-right">
										<DeleteManagerButton
											manager={manager}
											disabledReason={deleteBlockedReason}
											onDeleted={() => queryClient.invalidateQueries({ queryKey: managersQueryKey })}
										/>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</div>
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
	const [deleteButton, DeleteButton] = useReactiveButton({
		label: "",
		icon: Trash2,
		loading: { label: "" },
		error: { label: "Failed" },
		feedbackStyle: "neutral",
	});

	const handleDelete = async () => {
		if (deleteButton.status !== "idle") return;
		if (!confirm(`Are you sure you want to delete ${manager.name}?`)) {
			return;
		}

		const token = deleteButton.setLoading();
		try {
			const result = await deleteManager(manager.id);
			if (!result.success) {
				console.error("Failed to delete manager:", result.error);
				deleteButton.setError("Failed", { token });
				return;
			}

			// Success: the row disappears once the list refetches — that is the feedback.
			await onDeleted();
		} catch (error) {
			console.error("Failed to delete manager:", error);
			deleteButton.setError("Failed", { token });
		}
	};

	return (
		<DeleteButton
			variant="ghost"
			size="sm"
			disabled={Boolean(disabledReason)}
			title={disabledReason}
			aria-label={disabledReason ?? `Delete ${manager.name}`}
			onClick={handleDelete}
		/>
	);
}
