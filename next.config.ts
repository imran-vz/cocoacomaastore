import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	// Staff accounts and UPI accounts moved under Settings; old bookmarks still land there.
	redirects: async () => [
		{ source: "/admin/managers", destination: "/admin/settings/managers", permanent: true },
		{ source: "/admin/upi", destination: "/admin/settings/upi", permanent: true },
	],
	turbopack: {
		root: new URL(".", import.meta.url).pathname,
	},
};

export default nextConfig;
