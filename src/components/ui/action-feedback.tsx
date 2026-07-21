"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ActionFeedbackPhase = "idle" | "pending" | "success" | "error";

export type ActionFeedbackState = {
	phase: ActionFeedbackPhase;
	announcement?: string;
};

type ActionFeedbackEntry = {
	phase: Exclude<ActionFeedbackPhase, "idle">;
	announcement?: string;
};

type CompleteOptions = {
	duration?: number;
	onComplete?: () => void;
	announcement?: string;
	generation?: number;
};

const DEFAULT_SUCCESS_DURATION = 1500;
const DEFAULT_ERROR_DURATION = 2000;

export function useActionFeedback() {
	const [entries, setEntries] = useState<Record<string, ActionFeedbackEntry>>({});
	const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	const generationsRef = useRef(new Map<string, number>());
	const phasesRef = useRef(new Map<string, Exclude<ActionFeedbackPhase, "idle">>());

	const clearTimer = useCallback((key: string) => {
		const timer = timersRef.current.get(key);
		if (timer) clearTimeout(timer);
		timersRef.current.delete(key);
	}, []);

	const cancel = useCallback(
		(key: string, generation?: number) => {
			if (generation !== undefined && generationsRef.current.get(key) !== generation) return false;
			clearTimer(key);
			generationsRef.current.set(key, (generationsRef.current.get(key) ?? 0) + 1);
			phasesRef.current.delete(key);
			setEntries((current) => {
				if (!(key in current)) return current;
				const next = { ...current };
				delete next[key];
				return next;
			});
			return true;
		},
		[clearTimer],
	);

	const dismissSuccess = useCallback(
		(key: string) => {
			if (phasesRef.current.get(key) !== "success") return false;
			return cancel(key);
		},
		[cancel],
	);

	const cancelAll = useCallback(() => {
		for (const timer of timersRef.current.values()) clearTimeout(timer);
		timersRef.current.clear();
		generationsRef.current.clear();
		phasesRef.current.clear();
		setEntries({});
	}, []);

	const start = useCallback(
		(key: string) => {
			clearTimer(key);
			const generation = (generationsRef.current.get(key) ?? 0) + 1;
			generationsRef.current.set(key, generation);
			phasesRef.current.set(key, "pending");
			setEntries((current) => ({ ...current, [key]: { phase: "pending" } }));
			return generation;
		},
		[clearTimer],
	);

	const settle = useCallback(
		(key: string, phase: "success" | "error", options: CompleteOptions = {}) => {
			if (options.generation !== undefined && generationsRef.current.get(key) !== options.generation) {
				return false;
			}
			clearTimer(key);
			const generation = (generationsRef.current.get(key) ?? 0) + 1;
			generationsRef.current.set(key, generation);
			phasesRef.current.set(key, phase);
			setEntries((current) => ({
				...current,
				[key]: { phase, announcement: options.announcement },
			}));

			const timer = setTimeout(
				() => {
					if (generationsRef.current.get(key) !== generation) return;
					timersRef.current.delete(key);
					phasesRef.current.delete(key);
					setEntries((current) => {
						if (!(key in current)) return current;
						const next = { ...current };
						delete next[key];
						return next;
					});
					options.onComplete?.();
				},
				options.duration ?? (phase === "success" ? DEFAULT_SUCCESS_DURATION : DEFAULT_ERROR_DURATION),
			);
			timersRef.current.set(key, timer);
			return true;
		},
		[clearTimer],
	);

	const succeed = useCallback(
		(key: string, options: CompleteOptions = {}) => settle(key, "success", options),
		[settle],
	);

	const fail = useCallback((key: string, options: CompleteOptions = {}) => settle(key, "error", options), [settle]);

	useEffect(() => cancelAll, [cancelAll]);

	const getState = useCallback((key: string): ActionFeedbackState => entries[key] ?? { phase: "idle" }, [entries]);

	return { getState, start, succeed, fail, cancel, dismissSuccess, cancelAll };
}

function ActionFeedbackLiveStatus({ announcement, assertive }: { announcement?: string; assertive?: boolean }) {
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
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

/** Flashes a green check (success) or red X (error) over its positioned parent — for Switch-style hosts. */
export function ActionFeedbackCheckOverlay({
	phase,
	announcement,
	className,
}: {
	phase: ActionFeedbackPhase;
	announcement?: string;
	className?: string;
}) {
	const visible = phase === "success" || phase === "error";
	return (
		<>
			<motion.span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] text-white",
					phase === "error" ? "bg-red-500" : "bg-emerald-500",
					className,
				)}
				initial={false}
				animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96 }}
				transition={tweenFast}
			>
				{phase === "error" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
			</motion.span>
			<ActionFeedbackLiveStatus announcement={visible ? announcement : undefined} assertive={phase === "error"} />
		</>
	);
}
