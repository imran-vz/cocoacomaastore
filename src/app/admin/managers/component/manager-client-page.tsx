"use client";

import { Plus, Trash2 } from "lucide-react";
import { use, useId, useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { User } from "@/db/schema";
import { createManager, deleteManager } from "../actions";

export default function ManagerClientPage({
	managers,
}: {
	managers: Promise<
		Pick<User, "id" | "name" | "email" | "role" | "createdAt">[]
	>;
}) {
	const nameID = useId();
	const emailID = useId();
	const passwordID = useId();
	const roleID = useId();
	const managersList = use(managers);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		role: "manager" as "admin" | "manager",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const result = await createManager(formData);

		if (result.success) {
			toast.success("Manager created successfully");
			setIsDialogOpen(false);
			setFormData({ name: "", email: "", password: "", role: "manager" });
		} else {
			toast.error(result.error || "Failed to create manager");
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this manager?")) {
			return;
		}

		const result = await deleteManager(id);

		if (result.success) {
			toast.success("Manager deleted successfully");
		} else {
			toast.error(result.error || "Failed to delete manager");
		}
	};

	return (
		<div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Managers</h2>
					<p className="text-muted-foreground">
						Manage admin and manager accounts
					</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<Button type="button" onClick={() => setIsDialogOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Add Manager
					</Button>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New Manager</DialogTitle>
							<DialogDescription>
								Create a new manager or admin account
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor={nameID}>Name</Label>
								<Input
									id={nameID}
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={emailID}>Email</Label>
								<Input
									id={emailID}
									type="email"
									value={formData.email}
									onChange={(e) =>
										setFormData({ ...formData, email: e.target.value })
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={passwordID}>Password</Label>
								<Input
									id={passwordID}
									type="password"
									value={formData.password}
									onChange={(e) =>
										setFormData({ ...formData, password: e.target.value })
									}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={roleID}>Role</Label>
								<Select
									value={formData.role}
									onValueChange={(value: "admin" | "manager") =>
										setFormData({ ...formData, role: value })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manager">Manager</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button type="submit" className="w-full">
								Create Manager
							</Button>
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
						{managersList.map((manager) => (
							<TableRow key={manager.id}>
								<TableCell className="font-medium">{manager.name}</TableCell>
								<TableCell>{manager.email}</TableCell>
								<TableCell className="capitalize">
									<Badge
										variant={manager.role === "admin" ? "default" : "secondary"}
									>
										{manager.role}
									</Badge>
								</TableCell>
								<TableCell>
									{new Date(manager.createdAt).toLocaleDateString()}
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleDelete(manager.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
