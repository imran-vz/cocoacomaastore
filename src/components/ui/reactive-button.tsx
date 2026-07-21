"use client";

import { Check, CircleAlert, Loader2Icon } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ReactiveButtonStatus = "idle" | "loading" | "success" | "error";

/** Icon component for a state. Pass `null` to render the state without an icon. */
export type ReactiveButtonIcon = React.ComponentType<{ className?: string }> | null;

export type ReactiveButtonStateContent = {
	label?: React.ReactNode;
	icon?: ReactiveButtonIcon;
};

export type ReactiveButtonConfig = {
	/** Idle label. */
	label: React.ReactNode;
	/** Idle icon. */
	icon?: ReactiveButtonIcon;
	/** Loading state content. Icon defaults to a spinner. Label falls back to the idle label. */
	loading?: ReactiveButtonStateContent;
	/** Success state content and auto-reset duration (default 1500ms). Icon defaults to a check. */
	success?: ReactiveButtonStateContent & { duration?: number };
	/** Error state content and auto-reset duration (default 2500ms). Icon defaults to an alert circle. */
	error?: ReactiveButtonStateContent & { duration?: number };
	/**
	 * Success/error tint. Defaults to "brand" (primary tint) for the default button
	 * variant and "neutral" (emerald tint) for every other variant.
	 */
	feedbackStyle?: "brand" | "neutral";
};

export type ReactiveButtonTransitionOptions = {
	/** Auto-reset delay override for this transition. */
	duration?: number;
	/** Called when the state auto-resets back to idle (not called if interrupted). */
	onComplete?: () => void;
	/** Token from `setLoading`; the transition is ignored if a newer transition happened since. */
	token?: number;
};

export type ReactiveButtonControls = {
	/** Current status (reactive — re-renders the owner when it changes). */
	status: ReactiveButtonStatus;
	/** True while loading. */
	isBusy: boolean;
	/** Enter the loading state. Returns a token that can guard later transitions against races. */
	setLoading: (label?: React.ReactNode) => number;
	/** Flash the success state, then auto-reset to idle. Returns false if a stale token was given. */
	setSuccess: (label?: React.ReactNode, options?: ReactiveButtonTransitionOptions) => boolean;
	/** Flash the error state, then auto-reset to idle. Returns false if a stale token was given. */
	setError: (label?: React.ReactNode, options?: ReactiveButtonTransitionOptions) => boolean;
	/** Return to idle immediately. `ifStatus` limits the reset to a specific current status. */
	reset: (options?: { token?: number; ifStatus?: ReactiveButtonStatus }) => boolean;
};

const SUCCESS_DURATION = 1500;
const ERROR_DURATION = 2500;

const feedbackNeutralClass =
	"data-[feedback=success]:border-emerald-200 data-[feedback=success]:bg-emerald-50 data-[feedback=success]:text-emerald-700 data-[feedback=success]:opacity-100 data-[feedback=success]:hover:bg-emerald-50 dark:data-[feedback=success]:border-emerald-800 dark:data-[feedback=success]:bg-emerald-950/40 dark:data-[feedback=success]:text-emerald-300 motion-reduce:transition-none";

const feedbackBrandClass =
	"data-[feedback=success]:border-primary/30 data-[feedback=success]:bg-primary/15 data-[feedback=success]:text-primary data-[feedback=success]:opacity-100 data-[feedback=success]:hover:bg-primary/20 motion-reduce:transition-none";

const feedbackErrorClass =
	"data-[feedback=error]:border-destructive/30 data-[feedback=error]:bg-destructive/10 data-[feedback=error]:text-destructive data-[feedback=error]:opacity-100 data-[feedback=error]:hover:bg-destructive/10 dark:data-[feedback=error]:bg-destructive/20";

type ReactiveState = {
	status: ReactiveButtonStatus;
	/** Runtime label override for the active status, from a transition call. */
	label?: React.ReactNode;
	token: number;
};

type ReactiveStore = {
	get: () => ReactiveState;
	set: (next: ReactiveState) => void;
	subscribe: (listener: () => void) => () => void;
};

function createReactiveStore(): ReactiveStore {
	let state: ReactiveState = { status: "idle", token: 0 };
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set: (next) => {
			state = next;
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

function DefaultLoadingIcon({ className }: { className?: string }) {
	return <Loader2Icon aria-hidden="true" className={cn("animate-spin", className)} />;
}

const STATUSES = ["idle", "loading", "success", "error"] as const;

function resolveSlot(
	config: ReactiveButtonConfig,
	state: ReactiveState,
	slot: ReactiveButtonStatus,
): { icon: ReactiveButtonIcon; label: React.ReactNode } {
	const overrideLabel = state.status === slot ? state.label : undefined;
	switch (slot) {
		case "idle":
			return { icon: config.icon ?? null, label: config.label };
		case "loading":
			return {
				icon: config.loading?.icon === undefined ? DefaultLoadingIcon : config.loading.icon,
				label: overrideLabel ?? config.loading?.label ?? config.label,
			};
		case "success":
			return {
				icon: config.success?.icon === undefined ? Check : config.success.icon,
				label: overrideLabel ?? config.success?.label ?? config.label,
			};
		case "error":
			return {
				icon: config.error?.icon === undefined ? CircleAlert : config.error.icon,
				label: overrideLabel ?? config.error?.label ?? config.label,
			};
	}
}

function ReactiveLiveStatus({ announcement, assertive }: { announcement?: string; assertive?: boolean }) {
	const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		setPortalTarget(document.body);
	}, []);

	if (!portalTarget) return null;

	return createPortal(
		<span className="sr-only" aria-live={assertive ? "assertive" : "polite"} aria-atomic="true">
			{announcement}
		</span>,
		portalTarget,
	);
}

export type ReactiveButtonViewProps = Omit<React.ComponentProps<typeof Button>, "children" | "render"> & {
	/**
	 * Custom host element (e.g. `<motion.button />`, `<DropdownMenuItem />`). The element is
	 * cloned with the animated content, feedback classes, and aria/disabled wiring — design-system
	 * button styling is NOT applied, so the host keeps its own look.
	 */
	render?: React.ReactElement<{ className?: string; children?: React.ReactNode }>;
};

function ReactiveButtonView({
	state,
	config,
	className,
	variant = "default",
	size,
	disabled,
	render,
	...props
}: ReactiveButtonViewProps & { state: ReactiveState; config: ReactiveButtonConfig }) {
	const feedbackStyle = config.feedbackStyle ?? (variant === "default" ? "brand" : "neutral");
	const feedbackClass = cn(feedbackStyle === "brand" ? feedbackBrandClass : feedbackNeutralClass, feedbackErrorClass);

	const active = resolveSlot(config, state, state.status);
	const announcement =
		(state.status === "success" || state.status === "error") && typeof active.label === "string"
			? active.label
			: undefined;

	const content = (
		<>
			<span className="pointer-events-none inline-grid place-items-center">
				{STATUSES.map((slot) => {
					const { icon: Icon, label } = resolveSlot(config, state, slot);
					const isActive = state.status === slot;
					const entersFromBelow = slot === "success" || slot === "error";
					return (
						<motion.span
							key={slot}
							aria-hidden={!isActive}
							className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
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
			<ReactiveLiveStatus announcement={announcement} assertive={state.status === "error"} />
		</>
	);

	const sharedProps = {
		"data-feedback": state.status,
		"aria-busy": state.status === "loading" || undefined,
		disabled: disabled || state.status === "loading" || state.status === "success",
	};

	if (render) {
		return React.cloneElement(render, {
			...props,
			...sharedProps,
			className: cn(feedbackClass, className, render.props.className),
			children: content,
		});
	}

	return (
		<Button variant={variant} size={size} className={cn(feedbackClass, className)} {...sharedProps} {...props}>
			{content}
		</Button>
	);
}

export type ReactiveButtonComponent = React.FunctionComponent<ReactiveButtonViewProps>;

/**
 * Reactive action button with built-in loading / success / error feedback.
 *
 * ```tsx
 * const [button, SaveButton] = useReactiveButton({
 *   label: "Place order",
 *   icon: ShoppingBag,
 *   loading: { label: "Placing order..." },
 *   success: { label: "Order placed" },
 * });
 *
 * button.setLoading();
 * button.setSuccess(`#${orderId} placed`);
 * button.setError("Could not place order");
 *
 * return <SaveButton className="h-10" onClick={placeOrder} />;
 * ```
 *
 * The returned component is referentially stable, renders the design-system `Button`
 * (or a custom host via `render`), animates state changes, disables itself while
 * loading, and announces success/error to screen readers. Success and error states
 * auto-reset to idle.
 */
export function useReactiveButton(config: ReactiveButtonConfig): [ReactiveButtonControls, ReactiveButtonComponent] {
	const storeRef = React.useRef<ReactiveStore | null>(null);
	if (storeRef.current === null) storeRef.current = createReactiveStore();
	const store = storeRef.current;

	const configRef = React.useRef(config);
	configRef.current = config;
	const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = React.useCallback(() => {
		if (timerRef.current !== null) clearTimeout(timerRef.current);
		timerRef.current = null;
	}, []);

	React.useEffect(() => clearTimer, [clearTimer]);

	const setLoading = React.useCallback(
		(label?: React.ReactNode) => {
			clearTimer();
			const token = store.get().token + 1;
			store.set({ status: "loading", label, token });
			return token;
		},
		[clearTimer, store],
	);

	const settle = React.useCallback(
		(status: "success" | "error", label?: React.ReactNode, options: ReactiveButtonTransitionOptions = {}): boolean => {
			if (options.token !== undefined && options.token !== store.get().token) return false;
			clearTimer();
			const token = store.get().token + 1;
			store.set({ status, label, token });
			const configured = status === "success" ? configRef.current.success?.duration : configRef.current.error?.duration;
			const fallback = status === "success" ? SUCCESS_DURATION : ERROR_DURATION;
			timerRef.current = setTimeout(
				() => {
					timerRef.current = null;
					if (store.get().token !== token) return;
					store.set({ status: "idle", token: token + 1 });
					options.onComplete?.();
				},
				options.duration ?? configured ?? fallback,
			);
			return true;
		},
		[clearTimer, store],
	);

	const setSuccess = React.useCallback(
		(label?: React.ReactNode, options?: ReactiveButtonTransitionOptions) => settle("success", label, options),
		[settle],
	);

	const setError = React.useCallback(
		(label?: React.ReactNode, options?: ReactiveButtonTransitionOptions) => settle("error", label, options),
		[settle],
	);

	const reset = React.useCallback(
		(options: { token?: number; ifStatus?: ReactiveButtonStatus } = {}) => {
			const current = store.get();
			if (options.token !== undefined && options.token !== current.token) return false;
			if (options.ifStatus !== undefined && options.ifStatus !== current.status) return false;
			if (current.status === "idle") return true;
			clearTimer();
			store.set({ status: "idle", token: current.token + 1 });
			return true;
		},
		[clearTimer, store],
	);

	const state = React.useSyncExternalStore(store.subscribe, store.get, store.get);

	const controls = React.useMemo<ReactiveButtonControls>(
		() => ({
			status: state.status,
			isBusy: state.status === "loading",
			setLoading,
			setSuccess,
			setError,
			reset,
		}),
		[state.status, setLoading, setSuccess, setError, reset],
	);

	const [BoundButton] = React.useState<ReactiveButtonComponent>(() => {
		function BoundReactiveButton(props: ReactiveButtonViewProps) {
			const snapshot = React.useSyncExternalStore(store.subscribe, store.get, store.get);
			return <ReactiveButtonView state={snapshot} config={configRef.current} {...props} />;
		}
		return BoundReactiveButton;
	});

	return [controls, BoundButton];
}

export type ReactiveButtonProps = ReactiveButtonViewProps & {
	/** Idle label. */
	children: React.ReactNode;
	/** Idle icon. */
	icon?: ReactiveButtonIcon;
	/**
	 * Drives the loading state. When it turns off, the button flashes success
	 * (if `successLabel` is set and `isError` is false) or error (if `isError` is true),
	 * then auto-resets.
	 */
	isLoading?: boolean;
	/** Marks the last action as failed; shows the error flash when loading ends (or immediately when toggled on while idle). */
	isError?: boolean;
	/** Fully controlled status. Takes precedence over `isLoading`/`isError`. */
	status?: ReactiveButtonStatus;
	loadingLabel?: React.ReactNode;
	loadingIcon?: ReactiveButtonIcon;
	successLabel?: React.ReactNode;
	successIcon?: ReactiveButtonIcon;
	successDuration?: number;
	errorLabel?: React.ReactNode;
	errorIcon?: ReactiveButtonIcon;
	errorDuration?: number;
	feedbackStyle?: "brand" | "neutral";
};

/**
 * Declarative variant of `useReactiveButton` — same machine and visuals, driven by props.
 *
 * ```tsx
 * <ReactiveButton isLoading={isSaving} loadingLabel="Placing order..." successLabel="Order placed">
 *   Place order
 * </ReactiveButton>
 * ```
 */
export function ReactiveButton({
	children,
	icon,
	isLoading,
	isError,
	status,
	loadingLabel,
	loadingIcon,
	successLabel,
	successIcon,
	successDuration,
	errorLabel,
	errorIcon,
	errorDuration,
	feedbackStyle,
	...viewProps
}: ReactiveButtonProps) {
	const [button, BoundButton] = useReactiveButton({
		label: children,
		icon,
		loading: { label: loadingLabel, icon: loadingIcon },
		success: { label: successLabel, icon: successIcon, duration: successDuration },
		error: { label: errorLabel, icon: errorIcon, duration: errorDuration },
		feedbackStyle,
	});

	const { setLoading, setSuccess, setError, reset } = button;
	const wasLoadingRef = React.useRef(Boolean(isLoading));

	React.useEffect(() => {
		if (status !== undefined) return;
		const wasLoading = wasLoadingRef.current;
		wasLoadingRef.current = Boolean(isLoading);

		if (isLoading && !wasLoading) {
			setLoading();
		} else if (!isLoading && wasLoading) {
			if (isError) setError();
			else if (successLabel !== undefined) setSuccess();
			else reset();
		} else if (!isLoading && isError) {
			setError();
		}
	}, [status, isLoading, isError, successLabel, setLoading, setSuccess, setError, reset]);

	React.useEffect(() => {
		if (status === undefined) return;
		if (status === "loading") setLoading();
		else if (status === "success") setSuccess();
		else if (status === "error") setError();
		else reset();
	}, [status, setLoading, setSuccess, setError, reset]);

	return <BoundButton {...viewProps} />;
}
