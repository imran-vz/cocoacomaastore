"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { sidebarCookie } from "@/components/ui/sidebar-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The admin's sidebar from md: an inset panel that collapses to an icon rail. Below md the
 * shell shows the top bar and tab bar instead, so the sidebar has no phone form.
 */

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
	state: "expanded" | "collapsed";
	toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
	const context = React.useContext(SidebarContext);
	if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
	return context;
}

function SidebarProvider({
	defaultOpen = true,
	className,
	style,
	children,
	...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
	const [open, setOpen] = React.useState(defaultOpen);

	const toggleSidebar = React.useCallback(() => {
		setOpen(!open);
		// biome-ignore lint/suspicious/noDocumentCookie: the server layout reads this cookie to render the sidebar as it was left
		document.cookie = sidebarCookie(!open);
	}, [open]);

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar]);

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({ state: open ? "expanded" : "collapsed", toggleSidebar }),
		[open, toggleSidebar],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<div
				data-slot="sidebar-wrapper"
				style={
					{
						"--sidebar-width": SIDEBAR_WIDTH,
						"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
						...style,
					} as React.CSSProperties
				}
				className={cn("flex min-h-svh w-full md:bg-sidebar", className)}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

function Sidebar({ className, children, ...props }: React.ComponentProps<"div">) {
	const { state } = useSidebar();

	return (
		<div
			className="group peer hidden text-sidebar-foreground md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? "icon" : ""}
			data-slot="sidebar"
		>
			<div
				data-slot="sidebar-gap"
				className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-enter ease-linear group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) p-2 transition-[left,right,width] duration-enter ease-linear group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)] md:flex",
					className,
				)}
				{...props}
			>
				<div data-sidebar="sidebar" data-slot="sidebar-inner" className="flex size-full flex-col bg-sidebar">
					{children}
				</div>
			</div>
		</div>
	);
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			className={className}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon />
			<span className="sr-only">Toggle sidebar</span>
		</Button>
	);
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
	const { toggleSidebar } = useSidebar();

	return (
		<button
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label="Toggle sidebar"
			tabIndex={-1}
			onClick={toggleSidebar}
			title="Toggle sidebar"
			className={cn(
				"absolute inset-y-0 -right-4 z-20 hidden w-4 -translate-x-1/2 cursor-w-resize transition-all ease-linear after:absolute after:inset-y-0 after:inset-s-1/2 after:w-0.5 hover:after:bg-sidebar-border group-data-[state=collapsed]:cursor-e-resize sm:flex",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn(
				"relative flex w-full flex-1 flex-col md:m-2 md:[--shell-chrome-y:1rem] md:ml-0 md:rounded-xl md:bg-background md:shadow-sm md:peer-data-[state=collapsed]:ml-2",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("flex flex-col gap-2 p-2", className)}
			{...props}
		/>
	);
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn(
				"no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
			{...props}
		/>
	);
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn("flex w-full min-w-0 flex-col gap-0", className)}
			{...props}
		/>
	);
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

/** Collapsed to the icon rail, a button shows its `tooltip` instead of its label. */
function SidebarMenuButton({
	render,
	isActive = false,
	size = "default",
	tooltip,
	className,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		isActive?: boolean;
		size?: "default" | "lg";
		tooltip?: string;
	}) {
	const { state } = useSidebar();
	const button = useRender({
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(
					"flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm focus-ring-inset transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:text-muted-foreground aria-disabled:pointer-events-none aria-disabled:text-muted-foreground data-active:bg-primary/10 data-active:font-semibold data-active:text-primary data-active:hover:bg-primary/15 data-active:hover:text-primary data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
					size === "lg" ? "h-12 group-data-[collapsible=icon]:p-0!" : "h-8",
					className,
				),
			},
			props,
		),
		render,
		state: { slot: "sidebar-menu-button", sidebar: "menu-button", size, active: isActive },
	});

	if (!tooltip) return button;

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent side="right" align="center" hidden={state !== "collapsed"}>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-sub-item"
			data-sidebar="menu-sub-item"
			className={cn("group/menu-sub-item relative", className)}
			{...props}
		/>
	);
}

function SidebarMenuSubButton({
	render,
	isActive = false,
	className,
	...props
}: useRender.ComponentProps<"a"> & React.ComponentProps<"a"> & { isActive?: boolean }) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"flex h-8 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground focus-ring-inset hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:text-muted-foreground aria-disabled:pointer-events-none aria-disabled:text-muted-foreground data-active:bg-primary/10 data-active:font-semibold data-active:text-primary group-data-[collapsible=icon]:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground data-active:[&>svg]:text-primary",
					className,
				),
			},
			props,
		),
		render,
		state: { slot: "sidebar-menu-sub-button", sidebar: "menu-sub-button", active: isActive },
	});
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
};
