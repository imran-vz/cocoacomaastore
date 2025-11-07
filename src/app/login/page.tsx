"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
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
import { Spinner } from "@/components/ui/spinner";
import { authClient, signIn } from "@/lib/auth-client";

export default function LoginPage() {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const emailID = useId();
	const passwordID = useId();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (session?.user.id) {
			if (session.user.role === "admin") {
				router.replace("/admin");
			} else {
				router.replace("/");
			}
		}
	}, [router, session?.user]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			await signIn.email(
				{ email, password, rememberMe: true },
				{
					onSuccess: () => {
						toast.success("Logged in successfully");
						setIsLoading(false);
						router.refresh();
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
	};

	return (
		<div className="flex min-h-[calc(100vh-52px)] items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl font-bold">Login</CardTitle>
					<CardDescription>
						Enter your email and password to access your account
					</CardDescription>
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
			</Card>
		</div>
	);
}
