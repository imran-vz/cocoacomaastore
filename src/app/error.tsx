"use client";

import { ErrorScreen } from "@/features/shell/error-screen";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	return <ErrorScreen error={error} retry={retry} />;
}
