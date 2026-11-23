import type * as React from "react";

/**
 * The async-action feedback model (DESIGN.md §Feedback): idle → loading → success | error →
 * idle, one screen-reader announcer and the named flash lengths. `useReactiveButton` drives one
 * button with it; a list drives a control per row by key (`FeedbackCheck` over each switch).
 */

export type FeedbackStatus = "idle" | "loading" | "success" | "error";

/** How long a success or error state shows before the control returns to idle, in ms. */
export const FEEDBACK_MS = {
	/** A Sell tile shaking off an add the cart refused. */
	reject: 700,
	/** A save whose sheet closes when the flash ends. */
	beforeClose: 900,
	/** Rows, tiles and the cart, where the next tap follows quickly. */
	inline: 1200,
	success: 1500,
	copied: 2000,
	error: 2500,
} as const;

export type FeedbackState = {
	status: FeedbackStatus;
	/** Label for the current status, overriding the configured one. */
	label?: React.ReactNode;
	token: number;
};

export type SettleOptions = {
	/** From `start`: the call is ignored when a newer transition happened since. */
	token?: number;
	duration?: number;
	/** Runs when the flash ends on its own, not when something interrupts it. */
	onComplete?: () => void;
	/** Read out by screen readers. */
	announcement?: string;
};

export type ResetOptions = { token?: number; ifStatus?: FeedbackStatus };

const IDLE: FeedbackState = { status: "idle", token: 0 };

/** Feedback states by key, so one owner can drive many controls (one per list row). */
export class FeedbackStore {
	private states = new Map<string, FeedbackState>();
	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private listeners = new Set<() => void>();
	private version = 0;

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getVersion = () => this.version;

	get(key: string): FeedbackState {
		return this.states.get(key) ?? IDLE;
	}

	/** Enters loading. Returns the token that guards the matching `settle`. */
	start(key: string, label?: React.ReactNode): number {
		this.clearTimer(key);
		const token = this.get(key).token + 1;
		this.set(key, { status: "loading", label, token });
		return token;
	}

	/** Shows success or error, then returns to idle. False when `options.token` is stale. */
	settle(key: string, status: "success" | "error", label: React.ReactNode, options: SettleOptions = {}): boolean {
		const current = this.get(key);
		if (options.token !== undefined && options.token !== current.token) return false;
		this.clearTimer(key);
		const token = current.token + 1;
		this.set(key, { status, label, token });
		if (options.announcement) announce(options.announcement, status === "error");
		const duration = options.duration ?? (status === "success" ? FEEDBACK_MS.success : FEEDBACK_MS.error);
		this.timers.set(
			key,
			setTimeout(() => {
				this.timers.delete(key);
				if (this.get(key).token !== token) return;
				this.set(key, { status: "idle", token: token + 1 });
				options.onComplete?.();
			}, duration),
		);
		return true;
	}

	/** Back to idle now. False when `token` is stale or the status isn't `ifStatus`. */
	reset(key: string, { token, ifStatus }: ResetOptions = {}): boolean {
		const current = this.get(key);
		if (token !== undefined && token !== current.token) return false;
		if (ifStatus !== undefined && ifStatus !== current.status) return false;
		if (current.status === "idle") return true;
		this.clearTimer(key);
		this.set(key, { status: "idle", token: current.token + 1 });
		return true;
	}

	dispose() {
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
	}

	private set(key: string, state: FeedbackState) {
		this.states.set(key, state);
		this.version += 1;
		for (const listener of this.listeners) listener();
	}

	private clearTimer(key: string) {
		const timer = this.timers.get(key);
		if (timer !== undefined) clearTimeout(timer);
		this.timers.delete(key);
	}
}

// Screen readers only announce changes to a live region that was already in the page, so the
// regions are created when the first feedback owner mounts, before anything is announced.
const regions: { polite?: HTMLElement; assertive?: HTMLElement } = {};
/** How long an announcement node stays in its region; a fresh node lets the same words be read again. */
const ANNOUNCEMENT_LIFETIME_MS = 7000;

export function ensureLiveRegions() {
	for (const politeness of ["polite", "assertive"] as const) {
		if (regions[politeness]?.isConnected) continue;
		const region = document.createElement("div");
		region.className = "sr-only";
		region.setAttribute("aria-live", politeness);
		region.setAttribute("aria-atomic", "false");
		document.body.append(region);
		regions[politeness] = region;
	}
}

/** Reads `message` out once through the app's live region. */
function announce(message: string, assertive = false) {
	if (typeof document === "undefined") return;
	ensureLiveRegions();
	const region = assertive ? regions.assertive : regions.polite;
	if (!region) return;
	const node = document.createElement("div");
	node.textContent = message;
	region.append(node);
	setTimeout(() => node.remove(), ANNOUNCEMENT_LIFETIME_MS);
}
