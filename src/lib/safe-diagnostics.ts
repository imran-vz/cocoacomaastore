import { causeChain } from "@/lib/errors";

type DiagnosticStatus = "ok" | "error";

type SafeDiagnosticInput = {
	operation: string;
	error?: unknown;
	status?: DiagnosticStatus;
	durationMs?: number;
	paramsCount?: number;
};

type SafeDiagnostic = {
	operation: string;
	code?: string;
	status?: DiagnosticStatus;
	durationMs?: number;
	paramsCount?: number;
};

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** The first error code in the cause chain that is safe to log (a Postgres SQLSTATE, `ECONNREFUSED`…). */
export function safeErrorCode(error: unknown): string | undefined {
	for (const link of causeChain(error)) {
		const code = (link as { code?: unknown }).code;
		if (typeof code === "string" && SAFE_CODE.test(code)) return code;
	}
	return undefined;
}

export function createSafeDiagnostic({
	operation,
	error,
	status,
	durationMs,
	paramsCount,
}: SafeDiagnosticInput): SafeDiagnostic {
	const diagnostic: SafeDiagnostic = { operation };
	const code = safeErrorCode(error);

	if (code !== undefined) diagnostic.code = code;
	if (status !== undefined) diagnostic.status = status;
	if (durationMs !== undefined && Number.isFinite(durationMs) && durationMs >= 0) {
		diagnostic.durationMs = Number(durationMs.toFixed(1));
	}
	if (paramsCount !== undefined && Number.isSafeInteger(paramsCount) && paramsCount >= 0) {
		diagnostic.paramsCount = paramsCount;
	}
	return diagnostic;
}
