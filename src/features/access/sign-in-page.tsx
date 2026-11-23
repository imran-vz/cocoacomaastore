"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandLockup } from "@/components/ui/brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Spinner } from "@/components/ui/spinner";
import { areaOf, homeOf } from "@/features/access/area";
import { authClient, authFailureMessage, authRequest, signIn } from "@/features/access/auth-client";

/** Shown while checking the session or redirecting after a successful login. */
function LoadingState({ message }: { message: string }) {
	return (
		<div className="flex min-h-56 flex-col items-center justify-center gap-3">
			<Spinner className="size-5 text-muted-foreground" />
			<output className="text-sm text-muted-foreground">{message}</output>
		</div>
	);
}

/** The sign-in screen. A signed-in visitor goes straight to their area's home. */
export function SignInPage() {
	const router = useRouter();
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const emailID = useId();
	const passwordID = useId();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [signInButton, SignInButton] = useReactiveButton({
		label: "Sign in",
		loading: { label: "Signing in…" },
	});
	const isLoading = signInButton.isBusy;
	const [isRedirecting, setIsRedirecting] = useState(false);
	const hasRedirected = useRef(false);

	useEffect(() => {
		if (session?.user?.id && !hasRedirected.current) {
			hasRedirected.current = true;
			setIsRedirecting(true);
			router.replace(homeOf(areaOf(session.user.role)));
		}
	}, [session, router]);

	const handleSubmit = async (e: React.SubmitEvent) => {
		e.preventDefault();
		if (signInButton.isBusy) return;
		const token = signInButton.setLoading();
		const outcome = await authRequest(signIn.email({ email, password, rememberMe: true }));
		if (!outcome.ok) {
			signInButton.setError(authFailureMessage(outcome, "Sign-in isn't working right now. Try again shortly."), {
				token,
			});
			return;
		}
		setIsRedirecting(true);
		router.replace(homeOf(areaOf(outcome.data?.user?.role)));
	};

	const showLoading = isSessionPending || isRedirecting;

	return (
		<main className="page-texture flex min-h-svh w-full flex-col [--texture-floor:0.4] [--texture-gutters:linear-gradient(to_right,black,transparent_calc(50%-15rem),transparent_calc(50%+15rem),black)] items-center justify-center px-4 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)]">
			<div className="w-full max-w-sm">
				<BrandLockup className="mb-6" />

				<div className="surface-card p-5 text-card-foreground shadow-sm sm:p-6">
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
										onChange={(e) => setEmail(e.target.value)}
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
										onChange={(e) => setPassword(e.target.value)}
										required
										disabled={isLoading}
										autoComplete="current-password"
										className="md:h-11 md:text-base"
									/>
								</div>
								<SignInButton type="submit" size="lg" className="mt-2 w-full md:h-11" />
							</form>
						</>
					)}
				</div>

				<p className="mt-4 text-center text-meta text-muted-foreground">Trouble signing in? Ask your store manager.</p>
			</div>
		</main>
	);
}
