"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type ChangeEvent, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateShort, formatDayHeading, formatDayShort, formatMonth } from "@/lib/format";
import { formatLocalDateKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";

interface DateSwitcherProps {
	selectedDate: Date;
	onDateChange: (date: Date) => void;
	minDate?: Date;
	maxDate?: Date;
	className?: string;
}

/**
 * The stepper's label (decision 5: the stepper alone carries the date): `Today · 23 Nov`,
 * `Yesterday · 22 Nov`, otherwise `Sat, 21 Nov`. Read from the picker's local calendar day.
 * `compact` (phones, where the extra "Today" button shares the row) drops "Yesterday · " so the
 * date never truncates.
 */
function formatStepLabel(date: Date, today: Date, compact = false): string {
	const key = formatLocalDateKey(date);
	if (isSameDay(date, today)) return `Today · ${formatDateShort(key)}`;
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (!compact && isSameDay(date, yesterday)) return `Yesterday · ${formatDateShort(key)}`;
	return formatDayShort(key);
}

/** `Monday, 23 November 2026`: the accessible name of a calendar day. */
function formatFullDate(date: Date): string {
	return `${formatDayHeading(formatLocalDateKey(date))} ${date.getFullYear()}`;
}

/** Calendar icon + label: the stepper's centre, and the read-only date on manager Orders. */
function DateLabelContent({ label }: { label: string }) {
	return (
		<>
			<CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span className="truncate">{label}</span>
		</>
	);
}

/**
 * The same date label as the stepper, without arrows or a picker (decision 13): for screens
 * that only ever show one day, such as manager Orders. Pass a label rendered on the server
 * in shop time (`Today · 23 Nov`) so hydration never disagrees.
 */
export function DateDisplay({ label, className }: { label: string; className?: string }) {
	return (
		<p
			className={cn(
				"inline-flex h-9 items-center gap-2 text-[15px] font-semibold text-foreground tabular-nums",
				className,
			)}
		>
			<DateLabelContent label={label} />
		</p>
	);
}

function formatMonthDisplay(date: Date): string {
	return formatMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
}

function startOfDay(date: Date): Date {
	const nextDate = new Date(date);
	nextDate.setHours(0, 0, 0, 0);
	return nextDate;
}

function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

function isBeforeDay(date: Date, compareDate: Date): boolean {
	return startOfDay(date).getTime() < startOfDay(compareDate).getTime();
}

function isAfterDay(date: Date, compareDate: Date): boolean {
	return startOfDay(date).getTime() > startOfDay(compareDate).getTime();
}

function getCalendarDays(monthDate: Date): Date[] {
	const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const gridStart = new Date(firstDay);
	gridStart.setDate(firstDay.getDate() - firstDay.getDay());

	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(gridStart);
		date.setDate(gridStart.getDate() + index);
		return date;
	});
}

export function DateSwitcher({ selectedDate, onDateChange, minDate, maxDate, className }: DateSwitcherProps) {
	const today = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);
	const effectiveMaxDate = maxDate ?? today;
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [visibleMonth, setVisibleMonth] = useState(
		() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
	);

	useEffect(() => {
		if (!isCalendarOpen) {
			setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
		}
	}, [selectedDate, isCalendarOpen]);

	const isToday = isSameDay(selectedDate, today);

	const canGoNext = useMemo(() => {
		return isBeforeDay(selectedDate, effectiveMaxDate);
	}, [selectedDate, effectiveMaxDate]);

	const canGoPrev = useMemo(() => {
		if (!minDate) return true;
		return isAfterDay(selectedDate, minDate);
	}, [selectedDate, minDate]);

	const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

	const canGoPrevMonth = useMemo(() => {
		if (!minDate) return true;
		const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
		const lastDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
		return !isBeforeDay(lastDayOfPreviousMonth, minDate);
	}, [visibleMonth, minDate]);

	const canGoNextMonth = useMemo(() => {
		const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
		return !isAfterDay(nextMonth, effectiveMaxDate);
	}, [visibleMonth, effectiveMaxDate]);

	const isDateDisabled = useCallback(
		(date: Date) => {
			if (minDate && isBeforeDay(date, minDate)) return true;
			return isAfterDay(date, effectiveMaxDate);
		},
		[minDate, effectiveMaxDate],
	);

	const goToPreviousDay = useCallback(() => {
		const newDate = new Date(selectedDate);
		newDate.setDate(newDate.getDate() - 1);
		onDateChange(newDate);
	}, [selectedDate, onDateChange]);

	const goToNextDay = useCallback(() => {
		const newDate = new Date(selectedDate);
		newDate.setDate(newDate.getDate() + 1);
		onDateChange(newDate);
	}, [selectedDate, onDateChange]);

	const goToToday = useCallback(() => {
		onDateChange(today);
		setIsCalendarOpen(false);
	}, [today, onDateChange]);

	const handleDateInputChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			if (value) {
				const [year, month, day] = value.split("-").map(Number);
				const newDate = new Date(year, month - 1, day);
				newDate.setHours(0, 0, 0, 0);
				onDateChange(newDate);
				setIsCalendarOpen(false);
			}
		},
		[onDateChange],
	);

	const goToPreviousMonth = useCallback(() => {
		setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
	}, []);

	const goToNextMonth = useCallback(() => {
		setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
	}, []);

	const selectCalendarDate = useCallback(
		(date: Date) => {
			if (isDateDisabled(date)) return;
			const nextDate = startOfDay(date);
			onDateChange(nextDate);
			setIsCalendarOpen(false);
		},
		[isDateDisabled, onDateChange],
	);

	const isMobile = useIsMobile();
	// `Button` takes no ref, so focus returns to the trigger through its wrapper.
	const triggerWrapRef = useRef<HTMLSpanElement>(null);
	const selectedDayRef = useRef<HTMLButtonElement>(null);
	const stepLabel = formatStepLabel(selectedDate, today, isMobile);

	const calendar = (
		<CalendarPanel
			variant={isMobile ? "sheet" : "popover"}
			visibleMonth={visibleMonth}
			calendarDays={calendarDays}
			selectedDate={selectedDate}
			today={today}
			isToday={isToday}
			minDate={minDate}
			maxDate={effectiveMaxDate}
			canGoPrevMonth={canGoPrevMonth}
			canGoNextMonth={canGoNextMonth}
			isDateDisabled={isDateDisabled}
			onPreviousMonth={goToPreviousMonth}
			onNextMonth={goToNextMonth}
			onSelectDate={selectCalendarDate}
			onDateInputChange={handleDateInputChange}
			onToday={goToToday}
			selectedDayRef={selectedDayRef}
		/>
	);

	const triggerButton = (
		<Button
			variant="outline"
			aria-label={`Choose date, ${stepLabel}`}
			className="min-w-0 flex-1 justify-center gap-2 font-semibold tabular-nums md:min-w-44 md:flex-none"
			onClick={isMobile ? () => setIsCalendarOpen(true) : undefined}
		>
			<DateLabelContent label={stepLabel} />
		</Button>
	);

	return (
		<div className={cn("flex w-full items-center gap-2 md:w-auto", className)}>
			<Button variant="outline" size="icon" onClick={goToPreviousDay} disabled={!canGoPrev} aria-label="Previous day">
				<ChevronLeft aria-hidden="true" />
			</Button>

			{isMobile ? (
				<>
					<span ref={triggerWrapRef} className="contents">
						{triggerButton}
					</span>
					{/* Phones: a full-width bottom sheet with 44px day cells (decision 5). */}
					<Sheet open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
						<SheetContent
							side="bottom"
							initialFocus={selectedDayRef}
							finalFocus={() => triggerWrapRef.current?.querySelector("button") ?? true}
							className="gap-0 rounded-t-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
						>
							<SheetTitle className="flex min-h-11 items-center pr-12 text-[17px] font-bold">Choose date</SheetTitle>
							{calendar}
						</SheetContent>
					</Sheet>
				</>
			) : (
				<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
					<PopoverTrigger render={triggerButton} />
					<PopoverContent
						align="start"
						aria-label="Choose date"
						initialFocus={selectedDayRef}
						className="w-[min(20rem,calc(100vw-2rem))] p-3"
					>
						{calendar}
					</PopoverContent>
				</Popover>
			)}

			<Button variant="outline" size="icon" onClick={goToNextDay} disabled={!canGoNext} aria-label="Next day">
				<ChevronRight aria-hidden="true" />
			</Button>

			{!isToday && (
				<Button variant="ghost" onClick={goToToday} className="px-3 text-muted-foreground">
					Today
				</Button>
			)}
		</div>
	);
}

const WEEKDAY_HEADINGS = [
	{ short: "Sun", long: "Sunday" },
	{ short: "Mon", long: "Monday" },
	{ short: "Tue", long: "Tuesday" },
	{ short: "Wed", long: "Wednesday" },
	{ short: "Thu", long: "Thursday" },
	{ short: "Fri", long: "Friday" },
	{ short: "Sat", long: "Saturday" },
];

/**
 * Month header, a 7×6 day grid and the date field + Today footer. In the phone sheet the
 * seven columns are contiguous 44px cells; in the md+ popover they stay compact.
 */
function CalendarPanel({
	variant,
	visibleMonth,
	calendarDays,
	selectedDate,
	today,
	isToday,
	minDate,
	maxDate,
	canGoPrevMonth,
	canGoNextMonth,
	isDateDisabled,
	onPreviousMonth,
	onNextMonth,
	onSelectDate,
	onDateInputChange,
	onToday,
	selectedDayRef,
}: {
	variant: "sheet" | "popover";
	visibleMonth: Date;
	calendarDays: Date[];
	selectedDate: Date;
	today: Date;
	isToday: boolean;
	minDate?: Date;
	maxDate: Date;
	canGoPrevMonth: boolean;
	canGoNextMonth: boolean;
	isDateDisabled: (date: Date) => boolean;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
	onSelectDate: (date: Date) => void;
	onDateInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onToday: () => void;
	selectedDayRef: RefObject<HTMLButtonElement | null>;
}) {
	const isSheet = variant === "sheet";
	const selectedInView = calendarDays.some(
		(date) => isSameDay(date, selectedDate) && date.getMonth() === visibleMonth.getMonth(),
	);

	return (
		<div>
			<div className={cn("flex items-center justify-between gap-2", isSheet ? "mb-1" : "mb-2")}>
				<Button
					variant="ghost"
					size={isSheet ? "icon-touch" : "icon"}
					onClick={onPreviousMonth}
					disabled={!canGoPrevMonth}
					aria-label="Previous month"
				>
					<ChevronLeft aria-hidden="true" />
				</Button>
				<p className="text-[15px] font-semibold" aria-live="polite">
					{formatMonthDisplay(visibleMonth)}
				</p>
				<Button
					variant="ghost"
					size={isSheet ? "icon-touch" : "icon"}
					onClick={onNextMonth}
					disabled={!canGoNextMonth}
					aria-label="Next month"
				>
					<ChevronRight aria-hidden="true" />
				</Button>
			</div>

			<div
				className={cn(
					"grid grid-cols-7 text-center text-xs font-medium text-muted-foreground",
					isSheet ? "gap-0" : "gap-1",
				)}
			>
				{WEEKDAY_HEADINGS.map((day) => (
					<abbr key={day.short} title={day.long} className="py-1 no-underline">
						{day.short}
					</abbr>
				))}
			</div>
			<div className={cn("mt-1 grid grid-cols-7", isSheet ? "gap-0" : "gap-1")}>
				{calendarDays.map((date) => {
					const isSelected = isSameDay(date, selectedDate);
					const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
					const isCurrentDay = isSameDay(date, today);
					const disabled = isDateDisabled(date);
					// Focus lands on the selected day, or on the 1st when it is out of view.
					const takesInitialFocus = selectedInView
						? isSelected && !isOutsideMonth
						: date.getDate() === 1 && !isOutsideMonth;

					return (
						<button
							key={formatLocalDateKey(date)}
							ref={takesInitialFocus ? selectedDayRef : undefined}
							type="button"
							className={cn(
								"focus-ring flex items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
								isSheet ? "h-11 text-[15px]" : "h-8",
								isOutsideMonth && "text-muted-foreground/60",
								disabled && "cursor-not-allowed text-muted-foreground/40",
								!disabled && "hover:bg-muted",
								isCurrentDay && !isSelected && "font-semibold text-primary",
								isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
							)}
							disabled={disabled}
							onClick={() => onSelectDate(date)}
							aria-label={formatFullDate(date)}
							aria-current={isSelected ? "date" : undefined}
						>
							{date.getDate()}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
				<input
					type="date"
					aria-label="Date"
					value={formatLocalDateKey(selectedDate)}
					onChange={onDateInputChange}
					max={formatLocalDateKey(maxDate)}
					min={minDate ? formatLocalDateKey(minDate) : undefined}
					className="focus-ring h-11 min-w-0 rounded-lg border border-input bg-card px-2 text-base md:h-8 md:text-xs"
				/>
				<Button variant="ghost" onClick={onToday} disabled={isToday}>
					Today
				</Button>
			</div>
		</div>
	);
}
