"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signIn } from "@/lib/auth-client";

const SMIRKY_MESSAGES = [
	"Melting the chocolate...",
	"Preheating the oven...",
	"Sprinkling cocoa dust...",
	"Taste-testing the ganache...",
	"Whipping the cream...",
	"Tempering the couverture...",
	"Folding in the batter...",
	"Drizzling the caramel...",
	"Dusting the truffles...",
	"Checking the soufflé...",
	"Unmolding the mousse...",
	"Piping the frosting...",
];

function getRandomMessage(exclude?: string): string {
	const available = exclude ? SMIRKY_MESSAGES.filter((m) => m !== exclude) : SMIRKY_MESSAGES;
	return available[Math.floor(Math.random() * available.length)];
}

function redirectForRole(role: string | null | undefined, router: ReturnType<typeof useRouter>) {
	if (role === "admin") {
		router.replace("/admin");
	} else {
		router.replace("/manager");
	}
}

/**
 * Loading state rendered inside the card stack aesthetic.
 * Shown while checking session or redirecting after login.
 */
function CardLoadingState({ message }: { message?: string }) {
	const [smirky, setSmirky] = useState(() => getRandomMessage());

	useEffect(() => {
		const interval = setInterval(() => {
			setSmirky((prev) => getRandomMessage(prev));
		}, 2000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="flex min-h-[280px] flex-col items-center justify-center gap-5 text-center">
			<div className="relative">
				<div className="absolute inset-0 rounded-full bg-[#f0b25f]/30 blur-xl" />
				<Sparkles className="relative size-10 text-[#f0b25f]" />
			</div>
			<div className="space-y-1">
				<p className="text-sm font-semibold tracking-wide text-[#2c1810] animate-pulse">{message ?? smirky}</p>
				<p className="text-xs text-[#a89080]">{smirky}</p>
			</div>
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
		async (e: React.FormEvent) => {
			e.preventDefault();
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
							toast.error("Invalid email or password");
							setIsLoading(false);
						},
					},
				);
			} catch (error) {
				console.error("Login error:", error);
				toast.error("Invalid email or password");
				setIsLoading(false);
			}
		},
		[email, password, router],
	);

	const showLoading = isSessionPending || isRedirecting;

	return (
		<div className="relative h-[100dvh] overflow-hidden bg-[#f5efe6] text-[#2c1810]">
			{/* ── Fixed background ── */}
			<div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#e8d5c4]/60 blur-3xl" />
			<div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-[#d4a574]/25 blur-3xl" />
			<div className="absolute left-1/3 top-1/4 h-80 w-80 rounded-full bg-[#f0b25f]/10 blur-3xl" />
			<div className="absolute inset-0 opacity-[0.4] [background-image:radial-gradient(#c9a87c_1px,transparent_1px)] [background-size:24px_24px]" />

			{/* ── Scrollable content ── */}
			<div className="relative z-10 h-full overflow-y-auto overscroll-y-none scroll-smooth">
				{/*
					Mobile: content starts from top (pt-8) with generous bottom padding (pb-32)
					so the keyboard never covers inputs. No flex centering — the browser's native
					scroll-into-view handles focus without fighting layout.

					Desktop (sm+): vertically center with justify-center and normal padding.
				*/}
				<div className="mx-auto flex min-h-full w-full max-w-sm flex-col px-4 pt-8 pb-32 sm:justify-center sm:py-12 sm:pb-12">
					{/* Brand */}
					<div className="mb-8 text-center">
						<div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white shadow-lg shadow-[#2c1810]/5">
							<Image
								src="/logo.png"
								alt="Cocoa Comaa"
								width={36}
								height={36}
								className="size-9 object-contain"
								priority
							/>
						</div>
						<h1 className="text-xl font-bold tracking-tight text-[#2c1810]">Cocoa Comaa</h1>
						<p className="mt-1 text-sm text-[#8b6914]">Staff portal</p>
					</div>

					{/* Card stack */}
					<div className="relative">
						{/* Back card layers */}
						<div className="absolute -top-2 left-2 right-2 h-full rounded-2xl bg-[#e8d5c4]/60" />
						<div className="absolute -top-1 left-1 right-1 h-full rounded-2xl bg-[#f0b25f]/20" />

						{/* Main card */}
						<div className="relative rounded-2xl border border-[#c9a87c]/25 bg-white/80 p-6 shadow-xl shadow-[#2c1810]/5 backdrop-blur-sm sm:p-8">
							{showLoading ? (
								<CardLoadingState message={isSessionPending ? "Checking session…" : undefined} />
							) : (
								<>
									<div className="mb-6 flex items-center justify-between">
										<h2 className="text-lg font-bold text-[#2c1810]">Sign in</h2>
										<div className="flex h-7 items-center gap-1.5 rounded-full bg-[#f0b25f]/10 px-3 text-xs font-semibold text-[#8b6914]">
											<ShieldCheck className="size-3" />
											Secure
										</div>
									</div>

									<form onSubmit={handleSubmit} className="space-y-4">
										<div className="space-y-1.5">
											<Label
												htmlFor={emailID}
												className="text-xs font-semibold uppercase tracking-wider text-[#8b6914]"
											>
												Email
											</Label>
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
												className="h-12 rounded-xl border-[#c9a87c]/30 bg-[#faf8f5] text-[#2c1810] placeholder:text-[#a89080] focus-visible:border-[#b8956a] focus-visible:ring-[#b8956a]/20"
											/>
										</div>
										<div className="space-y-1.5">
											<Label
												htmlFor={passwordID}
												className="text-xs font-semibold uppercase tracking-wider text-[#8b6914]"
											>
												Password
											</Label>
											<Input
												id={passwordID}
												type="password"
												placeholder="••••••••"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
												required
												disabled={isLoading}
												autoComplete="current-password"
												className="h-12 rounded-xl border-[#c9a87c]/30 bg-[#faf8f5] text-[#2c1810] placeholder:text-[#a89080] focus-visible:border-[#b8956a] focus-visible:ring-[#b8956a]/20"
											/>
										</div>
										<Button
											type="submit"
											disabled={isLoading}
											className="h-12 w-full rounded-xl bg-[#2c1810] text-sm font-bold uppercase tracking-wider text-[#f5efe6] shadow-lg shadow-[#2c1810]/15 transition-transform hover:-translate-y-0.5 hover:bg-[#3d2218]"
										>
											{isLoading ? <Spinner className="text-white" /> : "Enter dashboard"}
										</Button>
									</form>
								</>
							)}
						</div>
					</div>

					<p className="mt-6 text-center text-xs text-[#a89080]">Trouble signing in? Ask your store manager.</p>
				</div>
			</div>
		</div>
	);
}
