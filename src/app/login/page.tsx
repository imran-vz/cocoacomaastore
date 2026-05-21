"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function RedirectingState() {
	const [message, setMessage] = useState(() => getRandomMessage());

	useEffect(() => {
		const interval = setInterval(() => {
			setMessage((prev) => getRandomMessage(prev));
		}, 2000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="flex flex-col items-center justify-center py-8 gap-4">
			<Spinner className="size-8 text-primary" />
			<p className="text-sm text-muted-foreground animate-pulse">{message}</p>
		</div>
	);
}

function redirectForRole(role: string | null | undefined, router: ReturnType<typeof useRouter>) {
	if (role === "admin") {
		router.replace("/admin");
	} else {
		router.replace("/manager");
	}
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

	// While checking existing session, show nothing (prevents form flash)
	if (isSessionPending) {
		return (
			<div className="flex min-h-[calc(100vh-52px)] items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardContent className="py-8">
						<div className="flex items-center justify-center">
							<Spinner className="size-6 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-[calc(100vh-52px)] items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				{isRedirecting ? (
					<CardContent>
						<RedirectingState />
					</CardContent>
				) : (
					<>
						<CardHeader className="space-y-1">
							<CardTitle className="text-2xl font-bold">Login</CardTitle>
							<CardDescription>Enter your email and password to access your account</CardDescription>
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
										onChange={(e) => setEmail(e.target.value)}
										required
										disabled={isLoading}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor={passwordID}>Password</Label>
									<Input
										id={passwordID}
										type="password"
										placeholder="••••••••"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										disabled={isLoading}
									/>
								</div>
								<Button type="submit" className="w-full" disabled={isLoading}>
									{isLoading ? <Spinner /> : "Login"}
								</Button>
							</form>
						</CardContent>
					</>
				)}
			</Card>
		</div>
	);
}
