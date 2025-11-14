import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	devIndicators: false,
	webpack: (config) => {
		config.optimization = config.optimization || {};
		config.optimization.splitChunks = {
			...config.optimization.splitChunks,
			cacheGroups: {
				...config.optimization.splitChunks?.cacheGroups,
				framerMotion: {
					test: /[\\/]node_modules[\\/]framer-motion/,
					name: "framer-motion",
					chunks: "all",
					priority: 10,
				},
				pdfkit: {
					test: /[\\/]node_modules[\\/](pdfkit|blob-stream)/,
					name: "pdfkit",
					chunks: "all",
					priority: 10,
				},
			},
		};
		return config;
	},
};

export default nextConfig;
