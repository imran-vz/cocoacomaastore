"use client";

import * as React from "react";

/**
 * Modal focus helpers (DESIGN.md §Overlays).
 *
 * - `useFocusTrap(containerRef, enabled)`: Tab / Shift+Tab wrap inside the container. Base UI
 *   modals (`Sheet`, `Dialog`, `ConfirmSheet`, `FormSheet`) hide the page from assistive tech
 *   and handle Escape and focus return, but its focus guards let Tab walk out to the page, so
 *   those primitives add this trap. Traps stack: only the innermost open overlay wraps focus,
 *   so a ConfirmSheet over a FormSheet keeps focus in the ConfirmSheet. Focus that has moved
 *   into a popup opened from the overlay (a menu, a select) is left alone.
 * - `useModalFocus(options)`: everything for a hand-built overlay (the POS cart sheet, which
 *   keeps its own drag gesture): the trap, a truly `inert` background, initial focus, Escape,
 *   and focus return with a fallback for when the trigger is gone.
 */

const TABBABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function tabbableIn(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter(
		(element) =>
			// tabIndex < 0 drops programmatic-only targets, e.g. the hidden native input behind a
			// Base UI Switch/Checkbox, which forwards focus back to its control and would loop Tab.
			element.tabIndex >= 0 &&
			!element.closest("[inert]") &&
			!element.closest('[aria-hidden="true"]') &&
			!element.hasAttribute("data-base-ui-focus-guard") &&
			element.getClientRects().length > 0,
	);
}

function isFocusable(element: HTMLElement | null | undefined): element is HTMLElement {
	return Boolean(element?.isConnected && !element.closest("[inert]") && element.getClientRects().length > 0);
}

// Innermost trap last.
const trapStack: HTMLElement[] = [];
let listening = false;

function onTrapKeyDown(event: KeyboardEvent) {
	if (event.key !== "Tab" || event.defaultPrevented) return;
	const container = trapStack[trapStack.length - 1];
	if (!container?.isConnected) return;

	const active = document.activeElement as HTMLElement | null;
	const inside = Boolean(active && container.contains(active));
	const stray =
		!active ||
		active === document.body ||
		active.hasAttribute("data-base-ui-focus-guard") ||
		active.closest("[aria-hidden=true]");
	// Focus is in a popup opened from the overlay (menu, select): let it manage itself.
	if (!inside && !stray) return;

	const items = tabbableIn(container);
	event.preventDefault();
	if (items.length === 0) {
		container.focus({ preventScroll: true });
		return;
	}
	const index = inside && active ? items.indexOf(active) : -1;
	const next = event.shiftKey
		? items[index <= 0 ? items.length - 1 : index - 1]
		: items[index === -1 || index === items.length - 1 ? 0 : index + 1];
	next.focus();
}

export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled = true) {
	React.useEffect(() => {
		const container = containerRef.current;
		if (!enabled || !container) return;
		trapStack.push(container);
		if (!listening) {
			document.addEventListener("keydown", onTrapKeyDown, true);
			listening = true;
		}
		return () => {
			const index = trapStack.lastIndexOf(container);
			if (index !== -1) trapStack.splice(index, 1);
			if (trapStack.length === 0 && listening) {
				document.removeEventListener("keydown", onTrapKeyDown, true);
				listening = false;
			}
		};
	}, [containerRef, enabled]);
}

/**
 * Render inside a Base UI `Portal`, next to the `Popup` whose ref is `containerRef`: it mounts
 * and unmounts with the popup, so the trap is live exactly while the overlay is shown.
 */
export function FocusTrap({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
	useFocusTrap(containerRef);
	return null;
}

export type ModalFocusOptions = {
	open: boolean;
	containerRef: React.RefObject<HTMLElement | null>;
	initialFocusRef?: React.RefObject<HTMLElement | null>;
	returnFocusRef?: React.RefObject<HTMLElement | null>;
	/** Where focus goes when neither the return target nor the opener is still on screen. */
	fallbackFocus?: () => HTMLElement | null | undefined;
	onEscape?: () => void;
};

/** Marks every sibling along the path from `container` up to `<body>` inert; returns an undo. */
function inertOutside(container: HTMLElement): () => void {
	const changed: HTMLElement[] = [];
	let node: HTMLElement | null = container;
	while (node && node !== document.body) {
		const parent: HTMLElement | null = node.parentElement;
		if (!parent) break;
		for (const sibling of Array.from(parent.children)) {
			if (sibling === node || !(sibling instanceof HTMLElement)) continue;
			if (sibling.inert || sibling.tagName === "SCRIPT" || sibling.tagName === "STYLE") continue;
			sibling.inert = true;
			changed.push(sibling);
		}
		node = parent;
	}
	return () => {
		for (const element of changed) element.inert = false;
	};
}

/**
 * Focus for a hand-built modal overlay. While `open`: the page outside `containerRef` is
 * `inert`, Tab wraps inside, Escape calls `onEscape`. On open, focus moves to
 * `initialFocusRef` (or the first tabbable element). On close, focus returns to
 * `returnFocusRef`, else the element focused when it opened, else `fallbackFocus()`.
 */
export function useModalFocus({
	open,
	containerRef,
	initialFocusRef,
	returnFocusRef,
	fallbackFocus,
	onEscape,
}: ModalFocusOptions) {
	const onEscapeRef = React.useRef(onEscape);
	const fallbackRef = React.useRef(fallbackFocus);
	React.useEffect(() => {
		onEscapeRef.current = onEscape;
		fallbackRef.current = fallbackFocus;
	});

	useFocusTrap(containerRef, open);

	React.useEffect(() => {
		if (!open) return;
		const container = containerRef.current;
		if (!container) return;

		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const undoInert = inertOutside(container);

		const frame = requestAnimationFrame(() => {
			const target = initialFocusRef?.current ?? tabbableIn(container)[0] ?? container;
			if (target === container && !container.hasAttribute("tabindex")) container.tabIndex = -1;
			target.focus({ preventScroll: true });
		});

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && onEscapeRef.current) {
				event.stopPropagation();
				onEscapeRef.current();
			}
		};
		document.addEventListener("keydown", onKeyDown, true);

		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", onKeyDown, true);
			undoInert();
			const candidates = [returnFocusRef?.current, opener, fallbackRef.current?.()];
			const next = candidates.find(isFocusable);
			// Restore after the overlay's own unmount work.
			requestAnimationFrame(() => next?.focus({ preventScroll: true }));
		};
	}, [open, containerRef, initialFocusRef, returnFocusRef]);
}
