"use client";

import "./globals.css";

import { ErrorScreen } from "@/features/shell/error-screen";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	return (
		<html lang="en">
			<body className="antialiased">
				<ErrorScreen error={error} retry={retry} />
			</body>
		</html>
	);
}
