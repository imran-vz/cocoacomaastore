import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;

	// Public paths that don't require authentication
	const publicPaths = [
		"/login",
		"/api/auth",
		"/api/revalidate",
		"/manifest.json",
		"/manifest.webmanifest",
	];
	const isPublicPath = publicPaths.some((p) => path.startsWith(p));

	if (isPublicPath) {
		return NextResponse.next();
	}

	// Check if user is authenticated by calling the session endpoint
	const sessionToken = request.cookies.get("better-auth.session_token");

	if (!sessionToken) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// For role-based checks, we need to fetch from the API route
	try {
		const sessionResponse = await fetch(
			new URL("/api/auth/get-session", request.url),
			{ headers: { cookie: request.headers.get("cookie") || "" } },
		);

		if (!sessionResponse.ok) {
			return NextResponse.redirect(new URL("/login", request.url));
		}

		const session = await sessionResponse.json();

		if (!session || !session.user) {
			return NextResponse.redirect(new URL("/login", request.url));
		}

		// Role-based access control
		const userRole = session.user.role || "manager";

		if (path === "/" && userRole === "admin") {
			return NextResponse.redirect(new URL("/admin", request.url));
		}
		// Admin-only routes
		if (path.startsWith("/admin") && userRole !== "admin") {
			return NextResponse.redirect(new URL("/", request.url));
		}

		return NextResponse.next();
	} catch (error) {
		console.error("Middleware auth check failed:", error);
		return NextResponse.redirect(new URL("/login", request.url));
	}
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sw.js, workbox-*.js (PWA files)
		 * - Static assets (images, fonts, etc.)
		 */
		"/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
	],
};
