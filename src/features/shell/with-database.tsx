import { DatabaseUnavailableScreen } from "@/features/shell/error-screen";
import { isDatabaseUnavailableError } from "@/lib/errors";

/**
 * Renders `render(value)` once `read` settles, or the outage screen when the database can't be
 * reached. For a request's first database read (the session lookup), so an outage is named
 * rather than shown as a generic error.
 */
export async function withDatabase<T>(
	read: Promise<T>,
	render: (value: T) => React.ReactNode | Promise<React.ReactNode>,
): Promise<React.ReactNode> {
	let value: T;
	try {
		value = await read;
	} catch (error) {
		if (isDatabaseUnavailableError(error)) return <DatabaseUnavailableScreen />;
		throw error;
	}
	return render(value);
}
