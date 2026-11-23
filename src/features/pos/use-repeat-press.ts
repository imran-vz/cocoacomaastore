"use client";

import { type MouseEvent, type PointerEvent, useCallback, useEffect, useRef } from "react";

const HOLD_DELAY_MS = 300;
const REPEAT_INTERVAL_MS = 100;

/**
 * Button props that step once per click (pointer or keyboard) and keep stepping while a pointer holds
 * the button down. Repeating stops on release, when the pointer leaves, and once `disabled`.
 */
export function useRepeatPress(step: () => void, disabled = false) {
	const stepRef = useRef(step);
	useEffect(() => {
		stepRef.current = step;
	});
	const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
	// A hold already stepped; the click that ends it must not step again.
	const held = useRef(false);

	const stop = useCallback(() => {
		clearTimeout(timers.current.hold);
		clearInterval(timers.current.repeat);
		timers.current = {};
	}, []);

	useEffect(() => stop, [stop]);
	useEffect(() => {
		if (disabled) stop();
	}, [disabled, stop]);

	return {
		onPointerDown: (event: PointerEvent) => {
			if (event.button !== 0) return;
			stop();
			held.current = false;
			timers.current.hold = setTimeout(() => {
				held.current = true;
				stepRef.current();
				timers.current.repeat = setInterval(() => stepRef.current(), REPEAT_INTERVAL_MS);
			}, HOLD_DELAY_MS);
		},
		onPointerUp: stop,
		onPointerLeave: stop,
		onPointerCancel: stop,
		onClick: (event: MouseEvent) => {
			// A keyboard click has `detail` 0 and never ends a hold.
			const endsHold = held.current && event.detail !== 0;
			held.current = false;
			if (!endsHold) stepRef.current();
		},
		// Touch browsers open a context menu on a long press.
		onContextMenu: (event: MouseEvent) => event.preventDefault(),
	};
}
