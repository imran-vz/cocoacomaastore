"use client";

import { IconEye, IconEyeOff, IconKey, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface SettingsPageProps {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
	};
}

export function SettingsPage({ user }: SettingsPageProps) {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.slice(0, 2)
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();

		if (newPassword.length < 8) {
			toast.error("New password must be at least 8 characters");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match");
			return;
		}

		if (currentPassword === newPassword) {
			toast.error("New password must be different from current password");
			return;
		}

		setIsLoading(true);

		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});

			if (error) {
				toast.error(error.message || "Failed to change password");
				return;
			}

			toast.success("Password changed successfully");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (error) {
			console.error("Password change error:", error);
			toast.error("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Account Info Card */}
			<Card>
				<CardHeader className="pb-4">
					<div className="flex items-center gap-3">
						<IconUser className="size-5 text-muted-foreground" />
						<div>
							<CardTitle className="text-lg">Account</CardTitle>
							<CardDescription>Your account information</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center gap-4">
						<Avatar className="size-16">
							<AvatarFallback className="text-lg bg-primary/10 text-primary">
								{getInitials(user.name)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-base truncate">{user.name}</p>
							<p className="text-sm text-muted-foreground truncate">
								{user.email}
							</p>
							<p className="text-xs text-muted-foreground mt-1 capitalize">
								Role: {user.role}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Change Password Card */}
			<Card>
				<CardHeader className="pb-4">
					<div className="flex items-center gap-3">
						<IconKey className="size-5 text-muted-foreground" />
						<div>
							<CardTitle className="text-lg">Change Password</CardTitle>
							<CardDescription>
								Update your password to keep your account secure
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<Separator />
				<CardContent className="pt-6">
					<form onSubmit={handleChangePassword} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="current-password">Current Password</Label>
							<div className="relative">
								<Input
									id="current-password"
									type={showCurrentPassword ? "text" : "password"}
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									placeholder="Enter current password"
									required
									autoComplete="current-password"
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowCurrentPassword(!showCurrentPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									tabIndex={-1}
								>
									{showCurrentPassword ? (
										<IconEyeOff className="size-4" />
									) : (
										<IconEye className="size-4" />
									)}
								</button>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="new-password">New Password</Label>
							<div className="relative">
								<Input
									id="new-password"
									type={showNewPassword ? "text" : "password"}
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="Enter new password (min 8 characters)"
									required
									minLength={8}
									autoComplete="new-password"
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowNewPassword(!showNewPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									tabIndex={-1}
								>
									{showNewPassword ? (
										<IconEyeOff className="size-4" />
									) : (
										<IconEye className="size-4" />
									)}
								</button>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="confirm-password">Confirm New Password</Label>
							<div className="relative">
								<Input
									id="confirm-password"
									type={showConfirmPassword ? "text" : "password"}
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Confirm new password"
									required
									minLength={8}
									autoComplete="new-password"
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowConfirmPassword(!showConfirmPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									tabIndex={-1}
								>
									{showConfirmPassword ? (
										<IconEyeOff className="size-4" />
									) : (
										<IconEye className="size-4" />
									)}
								</button>
							</div>
						</div>

						{newPassword &&
							confirmPassword &&
							newPassword !== confirmPassword && (
								<p className="text-sm text-destructive">
									Passwords do not match
								</p>
							)}

						<Button
							type="submit"
							className="w-full"
							disabled={
								isLoading ||
								!currentPassword ||
								!newPassword ||
								!confirmPassword ||
								newPassword !== confirmPassword
							}
						>
							{isLoading ? (
								<>
									<Spinner className="size-4" />
									Changing Password...
								</>
							) : (
								"Change Password"
							)}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
