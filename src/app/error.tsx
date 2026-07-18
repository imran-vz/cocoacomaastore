"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<ErrorScreen
			error={error}
			reset={reset}
			mainClassName="min-h-app flex items-center justify-center p-4 md:p-6 lg:p-8"
		/>
	);
}
