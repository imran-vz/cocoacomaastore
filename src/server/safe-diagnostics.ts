type DiagnosticStatus = "ok" | "error" | number;

type SafeDiagnosticInput = {
	operation: string;
	error?: unknown;
	status?: DiagnosticStatus;
	durationMs?: number;
	paramsCount?: number;
};

export type SafeDiagnostic = {
	operation: string;
	code?: string;
	status?: DiagnosticStatus;
	durationMs?: number;
	paramsCount?: number;
};

const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

function findSafeErrorCode(error: unknown) {
	let current = error;
	for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
		const code = (current as { code?: unknown }).code;
		if (typeof code === "string" && SAFE_CODE.test(code)) return code;
		current = (current as { cause?: unknown }).cause;
	}
	return undefined;
}

function findSafeHttpStatus(error: unknown) {
	let current = error;
	for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
		const status = (current as { status?: unknown }).status;
		if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) return status;
		current = (current as { cause?: unknown }).cause;
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
	const code = findSafeErrorCode(error);
	const resolvedStatus = status ?? findSafeHttpStatus(error);

	if (code !== undefined) diagnostic.code = code;
	if (resolvedStatus !== undefined) diagnostic.status = resolvedStatus;
	if (durationMs !== undefined && Number.isFinite(durationMs) && durationMs >= 0) {
		diagnostic.durationMs = Number(durationMs.toFixed(1));
	}
	if (paramsCount !== undefined && Number.isSafeInteger(paramsCount) && paramsCount >= 0) {
		diagnostic.paramsCount = paramsCount;
	}
	return diagnostic;
}

export function logSafeServerError(operation: string, error: unknown) {
	console.error("[server] operation failed", createSafeDiagnostic({ operation, error, status: "error" }));
}
