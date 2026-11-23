import type { Transition } from "motion/react";

/**
 * Transitions for Motion-driven animation. The lengths are the CSS duration tokens in
 * src/app/globals.css (`duration-fast`, `duration-enter`, `duration-sheet`), so both kinds of
 * animation keep time.
 */

/** Motion takes seconds; the CSS tokens are milliseconds. */
export const MOTION_MS = { fast: 150, enter: 200, sheet: 300 } as const;

/** Small in-layout elements: cart lines, list rows. */
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 40 };

/** Large surfaces: the cart sheet and its bar. */
export const springSheet: Transition = { type: "spring", stiffness: 400, damping: 35 };

export const tweenFast: Transition = { duration: MOTION_MS.fast / 1000, ease: "easeOut" };

/** Entrances: headers, one-per-load surfaces. */
export const tweenEnter: Transition = { duration: MOTION_MS.enter / 1000, ease: "easeOut" };
