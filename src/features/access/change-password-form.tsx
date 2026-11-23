"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { authClient, authFailureMessage, authRequest } from "@/features/access/auth-client";
import { PASSWORD_HINT, PASSWORD_LENGTH, passwordSchema } from "@/features/access/password";
import { cn } from "@/lib/utils";

/** Changes the signed-in user's password and signs out their other sessions. */
export function ChangePasswordForm() {
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
	});

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (passwordButton.status !== "idle") return;

		const invalidPassword = passwordSchema.safeParse(newPassword).error?.issues[0]?.message;
		if (invalidPassword) {
			passwordButton.setError(invalidPassword);
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
		const outcome = await authRequest(
			authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }),
		);
		if (!outcome.ok) {
			passwordButton.setError(authFailureMessage(outcome, "Failed to change password"), { token });
			return;
		}
		if (passwordButton.setSuccess(undefined, { token })) {
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		}
	};

	const mismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);

	return (
		<form onSubmit={handleChangePassword} className="surface-card space-y-4 p-4 md:p-5">
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
				minLength={PASSWORD_LENGTH.min}
				hintId={newHintId}
				hint={PASSWORD_HINT}
			/>
			<PasswordField
				id={confirmId}
				label="Confirm new password"
				value={confirmPassword}
				onChange={setConfirmPassword}
				autoComplete="new-password"
				minLength={PASSWORD_LENGTH.min}
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
					maxLength={PASSWORD_LENGTH.max}
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
					{visible ? <EyeOff className="size-5 md:size-4" /> : <Eye className="size-5 md:size-4" />}
				</button>
			</div>
			{hint ? (
				<p
					id={describedBy}
					className={cn("text-meta", hintTone === "error" ? "text-destructive" : "text-muted-foreground")}
				>
					{hint}
				</p>
			) : null}
		</div>
	);
}
