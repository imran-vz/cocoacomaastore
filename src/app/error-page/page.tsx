export const dynamic = "force-static";

export default function ErrorPage() {
	return (
		<main className="min-h-[calc(100vh-52px)] flex items-center justify-center p-4 md:p-6 lg:p-8">
			<div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
				<h1 className="text-lg font-semibold tracking-tight">
					Something went wrong
				</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Please try again. If the issue persists, contact an admin.
				</p>
				<div className="mt-6 flex gap-2">
					<a
						href="/"
						className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
					>
						Go home
					</a>
				</div>
			</div>
		</main>
	);
}
