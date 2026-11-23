import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme's own type roles and layers (src/app/globals.css `@theme`), so tailwind-merge sorts
// `text-row` with font sizes rather than colours and `z-bar` with z-indexes.
const twMerge = extendTailwindMerge({
	extend: {
		theme: { text: ["row", "meta", "sheet-title"] },
		classGroups: { z: [{ z: ["bar", "overlay"] }] },
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
