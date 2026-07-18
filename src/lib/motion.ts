// Shared Framer Motion transition configs. Use these instead of inline
// stiffness/damping/duration literals in components.

import type { Transition } from "framer-motion";

/** Snappy spring for small in-layout elements (cart lines, list rows). */
export const springSnappy: Transition = {
	type: "spring",
	stiffness: 500,
	damping: 40,
};

/** Softer spring for large surfaces (bottom sheets, drawers, FABs). */
export const springSheet: Transition = {
	type: "spring",
	stiffness: 400,
	damping: 35,
};

/** Fast fade/entrance tween for UI elements. */
export const tweenFast: Transition = { duration: 0.15, ease: "easeOut" };

/** Standard entrance tween (headers, one-per-load surfaces). */
export const tweenEnter: Transition = { duration: 0.2, ease: "easeOut" };
