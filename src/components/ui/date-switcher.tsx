"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type ChangeEvent, type RefObject, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { OverlayContent, OverlayHeader, OverlayRoot } from "@/components/ui/overlay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/components/ui/use-mobile";
import { formatFullDate, formatMonth, formatRelativeDay, formatWeekday } from "@/lib/format";
import {
	addDays,
	addMonths,
	type DayKey,
	dayKeyParts,
	type MonthKey,
	monthFirstDay,
	monthKeyOf,
	parseDayKey,
} from "@/lib/shop-calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Six Sunday-first weeks covering `month`. */
function calendarDays(month: MonthKey): DayKey[] {
	const first = monthFirstDay(month);
	const gridStart = addDays(first, -dayKeyParts(first).weekday);
	return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function DateLabelContent({ label }: { label: string }) {
	return (
		<>
			<CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span className="truncate">{label}</span>
		</>
	);
}

/** The stepper's label for today (`Today · 23 Nov`) without arrows or a picker, for screens that only show today. */
export function DateDisplay({ today, className }: { today: DayKey; className?: string }) {
	return (
		<p className={cn("inline-flex h-9 items-center gap-2 text-row text-foreground tabular-nums", className)}>
			<DateLabelContent label={formatRelativeDay(today, today)} />
		</p>
	);
}

/**
 * Steps through shop days up to `today`, with a calendar for jumping further. `today` is the
 * server's shop day, so the switcher agrees with the data on screen.
 */
export function DateSwitcher({
	value,
	today,
	onChange,
}: {
	value: DayKey;
	today: DayKey;
	onChange: (day: DayKey) => void;
}) {
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	// The month paged to in the open calendar; otherwise the calendar shows the selected day's month.
	const [browsedMonth, setBrowsedMonth] = useState<MonthKey | null>(null);
	const visibleMonth = (isCalendarOpen ? browsedMonth : null) ?? monthKeyOf(value);
	const setCalendarOpen = (open: boolean) => {
		setIsCalendarOpen(open);
		setBrowsedMonth(null);
	};

	const isToday = value === today;

	const selectDay = (day: DayKey) => {
		if (day > today) return;
		onChange(day);
		setCalendarOpen(false);
	};

	const isMobile = useIsMobile();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const selectedDayRef = useRef<HTMLButtonElement>(null);
	// Phones fit the extra "Today" button on the same row, so the label stays short.
	const stepLabel = formatRelativeDay(value, today, { compact: isMobile });

	const calendar = (
		<CalendarPanel
			variant={isMobile ? "sheet" : "popover"}
			visibleMonth={visibleMonth}
			selectedDay={value}
			today={today}
			onPreviousMonth={() => setBrowsedMonth(addMonths(visibleMonth, -1))}
			onNextMonth={() => setBrowsedMonth(addMonths(visibleMonth, 1))}
			onSelectDay={selectDay}
			selectedDayRef={selectedDayRef}
		/>
	);

	const triggerButton = (
		<Button
			ref={triggerRef}
			variant="outline"
			aria-label={`Choose date, ${stepLabel}`}
			className="min-w-0 flex-1 justify-center gap-2 font-semibold tabular-nums md:min-w-44 md:flex-none"
			onClick={isMobile ? () => setCalendarOpen(true) : undefined}
		>
			<DateLabelContent label={stepLabel} />
		</Button>
	);

	return (
		<div className="flex w-full items-center gap-2 md:w-auto">
			<Button variant="outline" size="icon" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
				<ChevronLeft aria-hidden="true" />
			</Button>

			{isMobile ? (
				<>
					{triggerButton}
					<OverlayRoot open={isCalendarOpen} onOpenChange={setCalendarOpen}>
						<OverlayContent
							shape="sheet"
							initialFocus={selectedDayRef}
							finalFocus={() => triggerRef.current ?? true}
							className="pb-safe-4"
						>
							<OverlayHeader title="Choose date" />
							<div className="px-4">{calendar}</div>
						</OverlayContent>
					</OverlayRoot>
				</>
			) : (
				<Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
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

			<Button
				variant="outline"
				size="icon"
				onClick={() => onChange(addDays(value, 1))}
				disabled={value >= today}
				aria-label="Next day"
			>
				<ChevronRight aria-hidden="true" />
			</Button>

			{!isToday && (
				<Button variant="ghost" onClick={() => selectDay(today)} className="px-3 text-muted-foreground">
					Today
				</Button>
			)}
		</div>
	);
}

/** Loading placeholder with the shape of `DateSwitcher`: 44 · fill · 44 on phones, a 176px label from md. */
export function DateSwitcherSkeleton() {
	return (
		<div className="flex w-full items-center gap-2 md:w-auto">
			<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
			<Skeleton className="h-11 min-w-0 flex-1 rounded-lg md:h-9 md:w-44 md:flex-none" />
			<Skeleton className="size-11 shrink-0 rounded-lg md:size-9" />
		</div>
	);
}

/**
 * Month header, a 7×6 day grid and the date field + Today footer. In the phone sheet the
 * seven columns are contiguous 44px cells; in the popover they stay compact.
 */
function CalendarPanel({
	variant,
	visibleMonth,
	selectedDay,
	today,
	onPreviousMonth,
	onNextMonth,
	onSelectDay,
	selectedDayRef,
}: {
	variant: "sheet" | "popover";
	visibleMonth: MonthKey;
	selectedDay: DayKey;
	today: DayKey;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
	onSelectDay: (day: DayKey) => void;
	selectedDayRef: RefObject<HTMLButtonElement | null>;
}) {
	const isSheet = variant === "sheet";
	const focusDay = monthKeyOf(selectedDay) === visibleMonth ? selectedDay : monthFirstDay(visibleMonth);

	return (
		<div>
			<div className={cn("flex items-center justify-between gap-2", isSheet ? "mb-1" : "mb-2")}>
				<Button
					variant="ghost"
					size={isSheet ? "icon-touch" : "icon"}
					onClick={onPreviousMonth}
					aria-label="Previous month"
				>
					<ChevronLeft aria-hidden="true" />
				</Button>
				<p className="text-row" aria-live="polite">
					{formatMonth(visibleMonth)}
				</p>
				<Button
					variant="ghost"
					size={isSheet ? "icon-touch" : "icon"}
					onClick={onNextMonth}
					disabled={visibleMonth >= monthKeyOf(today)}
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
				{WEEKDAYS.map((weekday) => (
					<abbr key={weekday} title={formatWeekday(weekday, "long")} className="py-1 no-underline">
						{formatWeekday(weekday)}
					</abbr>
				))}
			</div>
			<div className={cn("mt-1 grid grid-cols-7", isSheet ? "gap-0" : "gap-1")}>
				{calendarDays(visibleMonth).map((day) => {
					const isSelected = day === selectedDay;
					const isOutsideMonth = monthKeyOf(day) !== visibleMonth;
					const disabled = day > today;

					return (
						<button
							key={day}
							ref={day === focusDay ? selectedDayRef : undefined}
							type="button"
							className={cn(
								"focus-ring flex items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
								isSheet ? "h-11 text-[15px]" : "h-8",
								isOutsideMonth && "text-muted-foreground/60",
								disabled && "cursor-not-allowed text-muted-foreground/40",
								!disabled && "hover:bg-muted",
								day === today && !isSelected && "font-semibold text-primary",
								isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
							)}
							disabled={disabled}
							onClick={() => onSelectDay(day)}
							aria-label={formatFullDate(day)}
							aria-current={isSelected ? "date" : undefined}
						>
							{dayKeyParts(day).day}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
				<input
					type="date"
					aria-label="Date"
					value={selectedDay}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						const day = parseDayKey(event.target.value);
						if (day) onSelectDay(day);
					}}
					max={today}
					className="focus-ring h-11 min-w-0 rounded-lg border border-input bg-card px-2 text-base md:h-8 md:text-xs"
				/>
				<Button variant="ghost" onClick={() => onSelectDay(today)} disabled={selectedDay === today}>
					Today
				</Button>
			</div>
		</div>
	);
}
