import {
	type MouseEventHandler,
	type MouseEvent as ReactMouseEvent,
	type TouchEvent as ReactTouchEvent,
	type TouchEventHandler,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

type Coordinates = {
	x: number;
	y: number;
} | null;

export enum LongPressEventReason {
	// Triggered when mouse / touch was moved outside initial press area when `cancelOnMovement` is active
	CANCELED_BY_MOVEMENT = "canceled-by-movement",
	// Triggered when released click / tap before long press detection threshold
	CANCELED_BY_TIMEOUT = "canceled-by-timeout",
}
type LongPressEvent<Target = Element> =
	| ReactMouseEvent<Target>
	| ReactTouchEvent<Target>;
type LongPressCallbackMeta<Context = unknown> = {
	context?: Context;
	reason?: LongPressEventReason;
};
type LongPressCallback<Target = Element, Context = unknown> = (
	event: LongPressEvent<Target>,
	meta: LongPressCallbackMeta<Context>,
) => void;

export enum LongPressDetectEvents {
	BOTH = "both",
	MOUSE = "mouse",
	TOUCH = "touch",
}

type LongPressResult<
	Target,
	DetectType extends LongPressDetectEvents = LongPressDetectEvents.BOTH,
> = DetectType extends LongPressDetectEvents.BOTH
	? {
			onMouseDown: MouseEventHandler<Target>;
			onMouseUp: MouseEventHandler<Target>;
			onMouseMove: MouseEventHandler<Target>;
			onMouseLeave: MouseEventHandler<Target>;
			onTouchStart: TouchEventHandler<Target>;
			onTouchMove: TouchEventHandler<Target>;
			onTouchEnd: TouchEventHandler<Target>;
		}
	: DetectType extends LongPressDetectEvents.MOUSE
		? {
				onMouseDown: MouseEventHandler<Target>;
				onMouseUp: MouseEventHandler<Target>;
				onMouseMove: MouseEventHandler<Target>;
				onMouseLeave: MouseEventHandler<Target>;
			}
		: DetectType extends LongPressDetectEvents.TOUCH
			? {
					onTouchStart: TouchEventHandler<Target>;
					onTouchMove: TouchEventHandler<Target>;
					onTouchEnd: TouchEventHandler<Target>;
				}
			: never;
type EmptyObject = Record<string, never>;
type CallableContextResult<T, Context> = (context?: Context) => T;

interface LongPressOptions<Target = Element, Context = unknown> {
	threshold?: number;
	captureEvent?: boolean;
	detect?: LongPressDetectEvents;
	filterEvents?: (event: LongPressEvent<Target>) => boolean;
	cancelOnMovement?: boolean | number;
	onStart?: LongPressCallback<Target, Context>;
	onMove?: LongPressCallback<Target, Context>;
	onFinish?: LongPressCallback<Target, Context>;
	onCancel?: LongPressCallback<Target, Context>;
}

export function isTouchEvent<Target>(
	event: LongPressEvent<Target>,
): event is ReactTouchEvent<Target> {
	const { nativeEvent } = event;
	return window.TouchEvent
		? nativeEvent instanceof TouchEvent
		: "touches" in nativeEvent;
}

export function isMouseEvent<Target>(
	event: LongPressEvent<Target>,
): event is ReactMouseEvent<Target> {
	return event.nativeEvent instanceof MouseEvent;
}

export function getCurrentPosition<Target>(
	event: LongPressEvent<Target>,
): Coordinates {
	if (isTouchEvent(event)) {
		return {
			x: event.touches[0].pageX,
			y: event.touches[0].pageY,
		};
	}

	/* istanbul ignore else */
	if (isMouseEvent(event)) {
		return {
			x: event.pageX,
			y: event.pageY,
		};
	}

	/* istanbul ignore next */
	return null;
}

export function useLongPress<Target = Element, Context = unknown>(
	callback: null,
	options?: LongPressOptions<Target>,
): CallableContextResult<EmptyObject, Context>;
export function useLongPress<
	Target = Element,
	Callback extends LongPressCallback<
		Target,
		Context
	> = LongPressCallback<Target>,
	Context = unknown,
>(
	callback: Callback,
	options?: LongPressOptions<Target>,
): CallableContextResult<LongPressResult<Target>, Context>;
export function useLongPress<
	Target = Element,
	Callback extends LongPressCallback<
		Target,
		Context
	> = LongPressCallback<Target>,
	Context = unknown,
>(
	callback: Callback | null,
	options?: LongPressOptions<Target>,
): CallableContextResult<LongPressResult<Target> | EmptyObject, Context>;

/**
 * Detect click / tap and hold event
 *
 * @param callback <p>
 *   Function to call when long press event is detected
 *   (click or tap lasts for <i>threshold</i> amount of time or longer)
 *   </p>
 * @param options <ul>
 * <li><b>threshold</b>
 * - Period of time that must elapse after detecting click or tap in order to trigger <i>callback</i></li>
 * <li><b>captureEvent</b>
 * - If React Event will be supplied as first argument to all callbacks</li>
 * <li><b>detect</b>
 * - Which type of events should be detected ('mouse' | 'touch' | 'both' )
 * <li><b>cancelOnMovement</b>
 * - <p>If long press should be canceled on mouse / touch move.</p>
 * <p>You can use this option to turn it on / off or set specific move tolerance as follows:</p>
 * <ol><li><i>true</i> or <i>false</i> (by default) - when set to true tolerance value will default to <i>25px</i>
 * <li><i>number</i> - set a specific tolerance value (square size inside which movement won't cancel long press)</li></ol>
 * </li>
 * <li><b>onStart</b>
 * - Called right after detecting click / tap event (e.g. onMouseDown or onTouchStart)
 * <li><b>onFinish</b>
 * - Called (if long press <u>was triggered</u>)
 * on releasing click or tap (e.g. onMouseUp, onMouseLeave or onTouchEnd)
 * <li><b>onCancel</b>
 * - Called (if long press <u>was <b>not</b> triggered</u>)
 * on releasing click or tap (e.g. onMouseUp, onMouseLeave or onTouchEnd)
 * </ul>
 */
export function useLongPress<
	Target extends Element = Element,
	Callback extends LongPressCallback<
		Target,
		Context
	> = LongPressCallback<Target>,
	Context = undefined,
>(
	callback: Callback | null,
	{
		threshold = 400,
		captureEvent = false,
		detect = LongPressDetectEvents.BOTH,
		cancelOnMovement = false,
		filterEvents,
		onStart,
		onMove,
		onFinish,
		onCancel,
	}: LongPressOptions<Target, Context> = {},
): CallableContextResult<
	LongPressResult<Target, typeof detect> | Record<string, never>,
	Context
> {
	const isLongPressActive = useRef(false);
	const isPressed = useRef(false);
	const timer = useRef<NodeJS.Timeout>(null);
	const savedCallback = useRef(callback);
	const startPosition = useRef<Coordinates>(null);
	const lastTouchTime = useRef(0);

	const start = useCallback(
		(context?: Context) => (event: LongPressEvent<Target>) => {
			// Prevent multiple start triggers
			if (isPressed.current) {
				return;
			}

			// Ignore events other than mouse and touch
			if (!isMouseEvent(event) && !isTouchEvent(event)) {
				return;
			}

			// Dedup touch and mouse events on mobile
			if (isTouchEvent(event)) {
				lastTouchTime.current = Date.now();
			} else if (isMouseEvent(event)) {
				// Ignore mouse events within 500ms of touch event
				if (Date.now() - lastTouchTime.current < 500) {
					return;
				}
			}

			// If we don't want all events to trigger long press and provided event is filtered out
			if (filterEvents !== undefined && !filterEvents(event)) {
				return;
			}

			startPosition.current = getCurrentPosition(event);

			if (captureEvent) {
				event.persist();
			}

			const meta: LongPressCallbackMeta<Context> =
				context === undefined ? {} : { context };

			// When touched trigger onStart and start timer
			onStart?.(event, meta);
			isPressed.current = true;
			timer.current = setTimeout(() => {
				if (savedCallback.current) {
					savedCallback.current(event, meta);
					isLongPressActive.current = true;
				}
			}, threshold);
		},
		[captureEvent, filterEvents, onStart, threshold],
	);

	const cancel = useCallback(
		(context?: Context, reason?: LongPressEventReason) =>
			(event: LongPressEvent<Target>) => {
				// Ignore events other than mouse and touch
				if (!isMouseEvent(event) && !isTouchEvent(event)) {
					return;
				}

				// Deduplicate touch and mouse events on mobile
				if (isTouchEvent(event)) {
					lastTouchTime.current = Date.now();
				} else if (isMouseEvent(event)) {
					// Ignore mouse events within 500ms of touch event
					if (Date.now() - lastTouchTime.current < 500) {
						return;
					}
				}

				startPosition.current = null;

				if (captureEvent) {
					event.persist();
				}

				const meta: LongPressCallbackMeta<Context> =
					context === undefined ? {} : { context };

				// Trigger onFinish callback only if timer was active
				if (isLongPressActive.current) {
					onFinish?.(event, meta);
				} else if (isPressed.current) {
					// Otherwise, if not active trigger onCancel
					onCancel?.(event, {
						...meta,
						reason: reason ?? LongPressEventReason.CANCELED_BY_TIMEOUT,
					});
				}
				isLongPressActive.current = false;
				isPressed.current = false;
				timer.current !== undefined && clearTimeout(timer.current || undefined);
			},
		[captureEvent, onFinish, onCancel],
	);

	const handleMove = useCallback(
		(context?: Context) => (event: LongPressEvent<Target>) => {
			onMove?.(event, { context });
			if (cancelOnMovement && startPosition.current) {
				const currentPosition = getCurrentPosition(event);
				/* istanbul ignore else */
				if (currentPosition) {
					const moveThreshold =
						cancelOnMovement === true ? 25 : cancelOnMovement;
					const movedDistance = {
						x: Math.abs(currentPosition.x - startPosition.current.x),
						y: Math.abs(currentPosition.y - startPosition.current.y),
					};

					// If moved outside move tolerance box then cancel long press
					if (
						movedDistance.x > moveThreshold ||
						movedDistance.y > moveThreshold
					) {
						cancel(context, LongPressEventReason.CANCELED_BY_MOVEMENT)(event);
					}
				}
			}
		},
		[cancel, cancelOnMovement, onMove],
	);

	useEffect(
		() => (): void => {
			// Clear timeout on unmount
			timer.current !== undefined && clearTimeout(timer.current || undefined);
		},
		[],
	);

	useEffect(() => {
		savedCallback.current = callback;
	}, [callback]);

	return useMemo(() => {
		function result(context?: Context) {
			const mouseHandlers = {
				onMouseDown: start(context) as MouseEventHandler<Target>,
				onMouseMove: handleMove(context) as MouseEventHandler<Target>,
				onMouseUp: cancel(context) as MouseEventHandler<Target>,
				onMouseLeave: cancel(context) as MouseEventHandler<Target>,
			};

			const touchHandlers = {
				onTouchStart: start(context) as TouchEventHandler<Target>,
				onTouchMove: handleMove(context) as TouchEventHandler<Target>,
				onTouchEnd: cancel(context) as TouchEventHandler<Target>,
			};

			if (callback === null) {
				return {};
			}

			if (detect === LongPressDetectEvents.MOUSE) {
				return mouseHandlers;
			}

			if (detect === LongPressDetectEvents.TOUCH) {
				return touchHandlers;
			}

			return { ...mouseHandlers, ...touchHandlers };
		}

		return result;
	}, [callback, cancel, detect, handleMove, start]);
}
