/**
 * The non-modal popups (menu, select, popover, tooltip) share one stacking layer and one
 * enter/exit motion. They sit on the overlay layer and render after it, so a popup opened
 * inside a sheet shows above the sheet.
 */
export const popupPositionerClassName = "isolate z-overlay outline-none";

export const popupMotionClassName =
	"origin-(--transform-origin) duration-fast data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 motion-reduce:animate-none";

/** The opaque surface of a menu, select list or popover. */
export const popupSurfaceClassName = `bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none ${popupMotionClassName}`;
