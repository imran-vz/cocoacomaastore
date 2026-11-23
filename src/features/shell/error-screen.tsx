"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * A full-screen failure notice. Server Component errors reach the client with a generic
 * message and a `digest` in production, so the notice never depends on the error's text;
 * conditions the server can recognise (the database being down) are rendered by the server.
 * Given the `error` an error boundary caught, it logs it and shows its digest.
 */
export function ErrorScreen({
	title = "Something went wrong",
	description = "An unexpected error occurred. Please try again.",
	error,
	retry,
}: {
	title?: string;
	description?: string;
	error?: Error & { digest?: string };
	retry?: () => void;
}) {
	useEffect(() => {
		if (error) console.error(error);
	}, [error]);
	const digest = error?.digest;

	return (
		<main className="flex min-h-svh items-center justify-center p-4 md:p-6 lg:p-8">
			<section aria-labelledby="error-title" className="surface-card w-full max-w-lg p-4 md:p-5">
				<h1 id="error-title" className="text-base font-semibold">
					{title}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				{digest ? (
					<p className="mt-4 text-xs text-muted-foreground">
						Error ID: <span className="font-mono">{digest}</span>
					</p>
				) : null}
				<div className="mt-4 flex gap-2">
					{retry ? <Button onClick={() => retry()}>Retry</Button> : null}
					<Button variant={retry ? "secondary" : "default"} onClick={() => window.location.reload()}>
						Reload
					</Button>
				</div>
			</section>
		</main>
	);
}

export function DatabaseUnavailableScreen() {
	return (
		<ErrorScreen
			title="Database unavailable"
			description="The app can’t reach the database right now. Please make sure the database is running and try again."
		/>
	);
}
