import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	turbopack: {
		root: new URL(".", import.meta.url).pathname,
	},
};

export default nextConfig;
