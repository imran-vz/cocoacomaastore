import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_MS, FeedbackStore } from "@/components/ui/feedback";

describe("FeedbackStore", () => {
	let store: FeedbackStore;

	beforeEach(() => {
		vi.useFakeTimers();
		store = new FeedbackStore();
	});
	afterEach(() => {
		store.dispose();
		vi.useRealTimers();
	});

	it("flashes a settled result, then returns to idle and reports completion", () => {
		const onComplete = vi.fn();
		const token = store.start("save");
		expect(store.get("save").status).toBe("loading");

		expect(store.settle("save", "success", "Saved", { token, duration: 500, onComplete })).toBe(true);
		expect(store.get("save")).toMatchObject({ status: "success", label: "Saved" });

		vi.advanceTimersByTime(499);
		expect(store.get("save").status).toBe("success");
		vi.advanceTimersByTime(1);
		expect(store.get("save").status).toBe("idle");
		expect(onComplete).toHaveBeenCalledOnce();
	});

	it("uses the named length for each result when none is given", () => {
		store.settle("save", "error", undefined);
		vi.advanceTimersByTime(FEEDBACK_MS.error - 1);
		expect(store.get("save").status).toBe("error");
		vi.advanceTimersByTime(1);
		expect(store.get("save").status).toBe("idle");
	});

	it("ignores a result whose token a newer start has replaced", () => {
		const first = store.start("save");
		const second = store.start("save");

		expect(store.settle("save", "success", undefined, { token: first })).toBe(false);
		expect(store.get("save").status).toBe("loading");
		expect(store.settle("save", "error", undefined, { token: second })).toBe(true);
		expect(store.get("save").status).toBe("error");
	});

	it("cuts a flash short when something else starts, without reporting completion", () => {
		const onComplete = vi.fn();
		store.settle("save", "success", undefined, { onComplete });

		store.start("save");
		vi.advanceTimersByTime(FEEDBACK_MS.success);

		expect(store.get("save").status).toBe("loading");
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("resets only a matching token and status", () => {
		const token = store.start("save");
		store.settle("save", "success", undefined, { token });
		const flashing = store.get("save").token;

		expect(store.reset("save", { ifStatus: "error" })).toBe(false);
		expect(store.reset("save", { token: token })).toBe(false);
		expect(store.get("save").status).toBe("success");
		expect(store.reset("save", { token: flashing, ifStatus: "success" })).toBe(true);
		expect(store.get("save").status).toBe("idle");
	});

	it("keeps each key separate and tells subscribers about every transition", () => {
		const listener = vi.fn();
		store.subscribe(listener);

		store.start("row-1");
		store.settle("row-2", "error", undefined);

		expect(store.get("row-1").status).toBe("loading");
		expect(store.get("row-2").status).toBe("error");
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
