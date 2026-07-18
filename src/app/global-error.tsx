"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html lang="en">
			<body className="antialiased bg-[url(/bg-grid.svg)]">
				<ErrorScreen
					error={error}
					reset={reset}
					mainClassName="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8"
				/>
			</body>
		</html>
	);
}
