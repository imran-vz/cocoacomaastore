"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
		<main className="min-h-app w-full max-w-sm mx-auto flex flex-col px-4 pt-10 pb-24 sm:justify-center sm:py-12">
			<Card>
				{showLoading ? (
					<CardContent>
						<LoadingState message={isSessionPending ? "Checking session…" : "Opening store…"} />
					</CardContent>
				) : (
					<>
						<CardHeader>
							<CardTitle className="text-lg">Sign in</CardTitle>
							<CardDescription>Use your staff account to open the store.</CardDescription>
						</CardHeader>
						<CardContent>
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
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={passwordID}>Password</Label>
									<Input
										id={passwordID}
										type="password"
										placeholder="Enter your password"
										value={password}
										onChange={(e) => {
											setPassword(e.target.value);
											setIsError(false);
										}}
										required
										disabled={isLoading}
										autoComplete="current-password"
									/>
								</div>
								<ReactiveButton
									type="submit"
									size="lg"
									isLoading={isLoading}
									isError={isError}
									loadingLabel="Signing in…"
									errorLabel="Invalid email or password"
									className="w-full"
								>
									Sign in
								</ReactiveButton>
							</form>
						</CardContent>
					</>
				)}
			</Card>

			<p className="mt-4 text-center text-xs text-muted-foreground">Trouble signing in? Ask your store manager.</p>
		</main>
	);
}
