"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow, ListRowTile, ListSection, RecordList } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { authClient } from "@/lib/auth-client";
import { formatInitials, roleLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SettingsPageProps {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
	};
	description?: string;
	/** Extra groups rendered above Account (admin: Managers, UPI accounts). */
	children?: React.ReactNode;
}

/**
 * Settings for both roles: page header, optional store groups, the Account record and
 * the Password form. Grouped inset lists with one left edge (DESIGN.md §Settings).
 */
export function SettingsPage({ user, description = "Your account and password.", children }: SettingsPageProps) {
	return (
		<div className="w-full">
			<PageHeader title="Settings" description={description} />
			<div className="space-y-6">
				{children}

				<ListSection title="Account" id="account">
					<RecordList aria-label="Account">
						<ListRow
							leading={<ListRowTile tone="brand">{formatInitials(user.name)}</ListRowTile>}
							title={user.name}
							meta={<EmailText email={user.email} />}
							trailingMeta={roleLabel(user.role)}
						/>
					</RecordList>
				</ListSection>

				<ListSection title="Password" id="password">
					<ChangePasswordForm />
				</ListSection>
			</div>
		</div>
	);
}

/** An email that wraps after the "@" (never mid-word) when the row is too narrow. */
function EmailText({ email }: { email: string }) {
	const at = email.indexOf("@");
	if (at === -1) return <span className="block break-words">{email}</span>;
	return (
		<span className="block break-words">
			{email.slice(0, at + 1)}
			<wbr />
			{email.slice(at + 1)}
		</span>
	);
}

function ChangePasswordForm() {
	const currentId = useId();
	const newId = useId();
	const newHintId = useId();
	const confirmId = useId();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordButton, SaveButton] = useReactiveButton({
		label: "Change password",
		loading: { label: "Changing password…" },
		success: { label: "Password changed" },
		feedbackStyle: "brand",
	});

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (passwordButton.status !== "idle") return;

		if (newPassword.length < 8) {
			passwordButton.setError("New password must be at least 8 characters");
			return;
		}

		if (newPassword !== confirmPassword) {
			passwordButton.setError("New passwords do not match");
			return;
		}

		if (currentPassword === newPassword) {
			passwordButton.setError("New password must be different from current password");
			return;
		}

		const token = passwordButton.setLoading();

		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});

			if (error) {
				passwordButton.setError(error.message || "Failed to change password", { token });
				return;
			}

			if (passwordButton.setSuccess(undefined, { token })) {
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
			}
		} catch (error) {
			console.error("Password change error:", error);
			passwordButton.setError("An unexpected error occurred", { token });
		}
	};

	const mismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);

	return (
		<form onSubmit={handleChangePassword} className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
			<PasswordField
				id={currentId}
				label="Current password"
				value={currentPassword}
				onChange={setCurrentPassword}
				autoComplete="current-password"
			/>
			<PasswordField
				id={newId}
				label="New password"
				value={newPassword}
				onChange={setNewPassword}
				autoComplete="new-password"
				minLength={8}
				hintId={newHintId}
				hint="At least 8 characters."
			/>
			<PasswordField
				id={confirmId}
				label="Confirm new password"
				value={confirmPassword}
				onChange={setConfirmPassword}
				autoComplete="new-password"
				minLength={8}
				invalid={mismatch}
				hint={mismatch ? "Passwords do not match" : undefined}
				hintTone="error"
			/>

			<SaveButton
				type="submit"
				size="lg"
				className="w-full md:w-auto"
				disabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
			/>
		</form>
	);
}

function PasswordField({
	id,
	label,
	value,
	onChange,
	autoComplete,
	minLength,
	hint,
	hintId,
	hintTone = "muted",
	invalid,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete: string;
	minLength?: number;
	hint?: string;
	hintId?: string;
	hintTone?: "muted" | "error";
	invalid?: boolean;
}) {
	const [visible, setVisible] = useState(false);
	const describedBy = hint ? (hintId ?? `${id}-hint`) : undefined;

	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<div className="relative">
				<Input
					id={id}
					type={visible ? "text" : "password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					required
					minLength={minLength}
					autoComplete={autoComplete}
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}
					className="pr-12"
				/>
				<button
					type="button"
					onClick={() => setVisible((v) => !v)}
					aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
					aria-pressed={visible}
					className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-offset-[-5px]"
				>
					{visible ? <IconEyeOff className="size-5 md:size-4" /> : <IconEye className="size-5 md:size-4" />}
				</button>
			</div>
			{hint ? (
				<p
					id={describedBy}
					className={cn("text-[13px]", hintTone === "error" ? "text-destructive" : "text-muted-foreground")}
				>
					{hint}
				</p>
			) : null}
		</div>
	);
}
