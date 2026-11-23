"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReactiveButton } from "@/components/ui/reactive-button";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signIn } from "@/lib/auth-client";

function redirectForRole(role: string | null | undefined, router: ReturnType<typeof useRouter>) {
	if (role === "admin") {
		router.replace("/admin");
	} else {
		router.replace("/manager");
	}
}

/** Shown while checking the session or redirecting after a successful login. */
function LoadingState({ message }: { message: string }) {
	return (
		<div className="flex min-h-56 flex-col items-center justify-center gap-3">
			<Spinner className="size-5 text-muted-foreground" />
			<output className="text-sm text-muted-foreground">{message}</output>
		</div>
	);
}

export default function LoginPage() {
	const router = useRouter();
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const emailID = useId();
	const passwordID = useId();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const [isRedirecting, setIsRedirecting] = useState(false);
	const hasRedirected = useRef(false);

	// Already logged in — show loading and redirect once
	useEffect(() => {
		if (session?.user?.id && !hasRedirected.current) {
			hasRedirected.current = true;
			setIsRedirecting(true);
			redirectForRole(session.user.role, router);
		}
	}, [session, router]);

	const handleSubmit = useCallback(
		async (e: React.SubmitEvent) => {
			e.preventDefault();
			setIsError(false);
			setIsLoading(true);

			try {
				await signIn.email(
					{ email, password, rememberMe: true },
					{
						onSuccess: (context) => {
							setIsRedirecting(true);
							const role = context.data?.user?.role;
							redirectForRole(role, router);
						},
						onError: (error) => {
							console.error("Login error:", error);
							setIsError(true);
							setIsLoading(false);
						},
					},
				);
			} catch (error) {
				console.error("Login error:", error);
				setIsError(true);
				setIsLoading(false);
			}
		},
		[email, password, router],
	);

	const showLoading = isSessionPending || isRedirecting;

	return (
		<main className="page-texture flex min-h-svh w-full flex-col [--texture-floor:0.4] [--texture-gutters:linear-gradient(to_right,black,transparent_calc(50%-15rem),transparent_calc(50%+15rem),black)] items-center justify-center px-4 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)]">
			<div className="w-full max-w-sm">
				<BrandLockup variant="stacked" className="mb-6" />

				<div className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
					{showLoading ? (
						<LoadingState message={isSessionPending ? "Checking session…" : "Opening store…"} />
					) : (
						<>
							<div className="mb-5 space-y-1">
								<h1 className="text-xl font-bold tracking-tight">Sign in</h1>
								<p className="text-sm text-muted-foreground">Use your staff account to open the store.</p>
							</div>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor={emailID}>Email</Label>
									<Input
										id={emailID}
										type="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => {
											setEmail(e.target.value);
											setIsError(false);
										}}
										required
										disabled={isLoading}
										autoComplete="email"
										inputMode="email"
										className="md:h-11 md:text-base"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={passwordID}>Password</Label>
									<Input
										id={passwordID}
										type="password"
										value={password}
										onChange={(e) => {
											setPassword(e.target.value);
											setIsError(false);
										}}
										required
										disabled={isLoading}
										autoComplete="current-password"
										className="md:h-11 md:text-base"
									/>
								</div>
								<ReactiveButton
									type="submit"
									size="lg"
									isLoading={isLoading}
									isError={isError}
									loadingLabel="Signing in…"
									errorLabel="Invalid email or password"
									className="mt-2 w-full md:h-11"
								>
									Sign in
								</ReactiveButton>
							</form>
						</>
					)}
				</div>

				<p className="mt-4 text-center text-[13px] text-muted-foreground">
					Trouble signing in? Ask your store manager.
				</p>
			</div>
		</main>
	);
}
