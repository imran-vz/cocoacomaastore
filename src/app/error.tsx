"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { isDatabaseUnavailableError } from "@/lib/errors";

export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Keep the original error in the console for debugging/log aggregation.
		console.error(error);
	}, [error]);

	const isDbDown = isDatabaseUnavailableError(error);

	return (
		<main className="min-h-[calc(100vh-52px)] flex items-center justify-center p-4 md:p-6 lg:p-8">
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle>
						{isDbDown ? "Database unavailable" : "Something went wrong"}
					</CardTitle>
					<CardDescription>
						{isDbDown
							? "The app can’t reach the database right now. Please make sure the database is running and try again."
							: "An unexpected error occurred. Please try again."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error.digest ? (
						<p className="text-muted-foreground text-xs">
							Error ID: <span className="font-mono">{error.digest}</span>
						</p>
					) : null}
				</CardContent>
				<CardFooter className="gap-2">
					<Button onClick={() => reset()}>Retry</Button>
					<Button variant="secondary" onClick={() => window.location.reload()}>
						Reload
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
