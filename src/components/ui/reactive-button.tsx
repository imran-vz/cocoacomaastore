"use client";

import { Check, CircleAlert } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { Button, type ButtonProps, buttonFeedbackClass } from "@/components/ui/button";
import type { FeedbackState, FeedbackStatus, ResetOptions, SettleOptions } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { useFeedbackStore } from "@/components/ui/use-feedback-store";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Icon component for a state. `null` renders the state without an icon. */
export type ReactiveButtonIcon = React.ComponentType<{ className?: string }> | null;

type StateContent = { label?: React.ReactNode; icon?: ReactiveButtonIcon };

export type ReactiveButtonConfig = {
	label: React.ReactNode;
	icon?: ReactiveButtonIcon;
	/** The icon defaults to a spinner and the label to the idle label. */
	loading?: StateContent;
	/** The icon defaults to a check; `duration` to `FEEDBACK_MS.success`. */
	success?: StateContent & { duration?: number };
	/** The icon defaults to an alert circle; `duration` to `FEEDBACK_MS.error`. */
	error?: StateContent & { duration?: number };
};

type ReactiveButtonControls = {
	status: FeedbackStatus;
	isBusy: boolean;
	/** Enters loading; returns the token that guards the matching success/error. */
	setLoading: (label?: React.ReactNode) => number;
	/** Flashes success, then returns to idle. False when `options.token` is stale. */
	setSuccess: (label?: React.ReactNode, options?: SettleOptions) => boolean;
	/** Flashes error, then returns to idle. False when `options.token` is stale. */
	setError: (label?: React.ReactNode, options?: SettleOptions) => boolean;
	reset: (options?: ResetOptions) => boolean;
};

type ReactiveButtonViewProps = Omit<ButtonProps, "children" | "render" | "busy" | "feedback"> & {
	/**
	 * A host element of its own (a `DropdownMenuItem`) that keeps its own look: it gets the
	 * animated content, the feedback tint and the disabled wiring, not the button styling.
	 */
	render?: React.ReactElement<{
		className?: string;
		children?: React.ReactNode;
		disabled?: boolean;
		"aria-busy"?: boolean;
	}>;
	/** `start`: icon and label sit at the host's left edge with the host's own gap (menu and list rows). */
	align?: "center" | "start";
};

type ReactiveButtonComponent = React.FunctionComponent<ReactiveButtonViewProps>;

const STATUSES = ["idle", "loading", "success", "error"] as const;
const KEY = "button";

function resolveSlot(config: ReactiveButtonConfig, state: FeedbackState, slot: FeedbackStatus) {
	const override = state.status === slot ? state.label : undefined;
	const pick = (content: StateContent | undefined, fallback: ReactiveButtonIcon) => ({
		icon: content?.icon === undefined ? fallback : content.icon,
		label: override ?? content?.label ?? config.label,
	});
	switch (slot) {
		case "idle":
			return { icon: config.icon ?? null, label: config.label };
		case "loading":
			return pick(config.loading, Spinner);
		case "success":
			return pick(config.success, Check);
		case "error":
			return pick(config.error, CircleAlert);
	}
}

function ReactiveButtonView({
	state,
	config,
	className,
	variant,
	size,
	disabled,
	render,
	align = "center",
	...props
}: ReactiveButtonViewProps & { state: FeedbackState; config: ReactiveButtonConfig }) {
	const content = (
		<span
			className={cn(
				"pointer-events-none inline-grid",
				align === "start" ? "items-center justify-items-start [gap:inherit]" : "place-items-center",
			)}
		>
			{STATUSES.map((slot) => {
				const { icon: Icon, label } = resolveSlot(config, state, slot);
				const isActive = state.status === slot;
				const entersFromBelow = slot === "success" || slot === "error";
				return (
					<motion.span
						key={slot}
						aria-hidden={!isActive}
						className={cn(
							"col-start-1 row-start-1 inline-flex items-center",
							align === "start" ? "justify-start [gap:inherit]" : "justify-center gap-1.5",
						)}
						initial={false}
						animate={{
							opacity: isActive ? 1 : 0,
							y: isActive ? 0 : entersFromBelow ? 2 : -2,
							scale: isActive ? 1 : 0.98,
						}}
						transition={tweenFast}
					>
						{Icon ? <Icon /> : null}
						{label}
					</motion.span>
				);
			})}
		</span>
	);

	const busy = state.status === "loading";
	const feedback = state.status === "success" || state.status === "error" ? state.status : undefined;
	const isDisabled = disabled || busy || state.status === "success";

	if (render) {
		return React.cloneElement(render, {
			...props,
			disabled: isDisabled,
			"aria-busy": busy || undefined,
			className: cn(buttonFeedbackClass(feedback, "neutral"), className, render.props.className),
			children: content,
		});
	}

	return (
		<Button
			{...props}
			variant={variant}
			size={size}
			className={className}
			disabled={isDisabled}
			busy={busy}
			feedback={feedback}
		>
			{content}
		</Button>
	);
}

function sameContent(a: StateContent | undefined, b: StateContent | undefined) {
	return a?.label === b?.label && a?.icon === b?.icon;
}

function sameConfig(a: ReactiveButtonConfig, b: ReactiveButtonConfig) {
	return (
		a.label === b.label &&
		a.icon === b.icon &&
		sameContent(a.loading, b.loading) &&
		sameContent(a.success, b.success) &&
		a.success?.duration === b.success?.duration &&
		sameContent(a.error, b.error) &&
		a.error?.duration === b.error?.duration
	);
}

/**
 * The caller's latest config, for the stable button component and the controls. It is set after
 * each render commits, since a ref written during render could hold an uncommitted render's config.
 */
class LatestConfig {
	private listeners = new Set<() => void>();

	constructor(private config: ReactiveButtonConfig) {}

	get = () => this.config;

	set(config: ReactiveButtonConfig) {
		if (sameConfig(this.config, config)) return;
		this.config = config;
		for (const listener of this.listeners) listener();
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
}

/**
 * A button with loading / success / error feedback (DESIGN.md §Feedback).
 *
 * ```tsx
 * const [button, SaveButton] = useReactiveButton({ label: "Place order", loading: { label: "Placing order…" } });
 * const token = button.setLoading();
 * button.setSuccess(`#${orderId} placed`, { token });
 * return <SaveButton onClick={placeOrder} />;
 * ```
 *
 * The returned component is referentially stable, disables itself while loading and during
 * the success flash, and announces string success/error labels to screen readers.
 */
export function useReactiveButton(config: ReactiveButtonConfig): [ReactiveButtonControls, ReactiveButtonComponent] {
	const store = useFeedbackStore();
	const [latestConfig] = React.useState(() => new LatestConfig(config));
	React.useLayoutEffect(() => latestConfig.set(config));

	const controls = React.useMemo(() => {
		const settle = (status: "success" | "error", label: React.ReactNode, options: SettleOptions = {}) => {
			const current = latestConfig.get();
			const configured = current[status];
			const shown = label ?? configured?.label ?? current.label;
			return store.settle(KEY, status, label, {
				duration: configured?.duration,
				announcement: typeof shown === "string" ? shown : undefined,
				...options,
			});
		};
		return {
			setLoading: (label?: React.ReactNode) => store.start(KEY, label),
			setSuccess: (label?: React.ReactNode, options?: SettleOptions) => settle("success", label, options),
			setError: (label?: React.ReactNode, options?: SettleOptions) => settle("error", label, options),
			reset: (options?: ResetOptions) => store.reset(KEY, options),
		};
	}, [store, latestConfig]);

	const { status } = store.get(KEY);
	const reactiveControls = React.useMemo<ReactiveButtonControls>(
		() => ({ status, isBusy: status === "loading", ...controls }),
		[status, controls],
	);

	const [BoundButton] = React.useState<ReactiveButtonComponent>(() => {
		function BoundReactiveButton(props: ReactiveButtonViewProps) {
			const state = React.useSyncExternalStore(
				store.subscribe,
				() => store.get(KEY),
				() => store.get(KEY),
			);
			const config = React.useSyncExternalStore(latestConfig.subscribe, latestConfig.get, latestConfig.get);
			return <ReactiveButtonView state={state} config={config} {...props} />;
		}
		return BoundReactiveButton;
	});

	return [reactiveControls, BoundButton];
}
