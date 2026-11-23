/**
 * The admin sidebar's expanded/collapsed choice persists in this cookie, so the server renders
 * it the way it was left. A plain module: the server layout reads it, the client sidebar writes it.
 */
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The `document.cookie` assignment that remembers `open`. */
export function sidebarCookie(open: boolean): string {
	return `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

/** Whether the sidebar was left open, from the request's cookies; open until it is first collapsed. */
export function sidebarOpenFrom(cookies: { get(name: string): { value: string } | undefined }): boolean {
	return cookies.get(SIDEBAR_COOKIE_NAME)?.value !== "false";
}
