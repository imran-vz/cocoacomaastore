import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_CACHE_TAGS } from "@/lib/cache-tags";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

const updateTag = vi.fn();
vi.doMock("next/cache", () => ({ updateTag, revalidateTag: vi.fn() }));
mockStaffSessions();

const { refreshAllData } = await import("@/features/shell/actions");

beforeEach(() => {
	updateTag.mockClear();
});

describe("Refresh data", () => {
	it("expires every cache tag for any signed-in staff member, and reports them for the client", async () => {
		await expect(asStaff({ id: "manager", area: "manager" }, refreshAllData)).resolves.toEqual({
			ok: true,
			data: undefined,
			refreshed: ALL_CACHE_TAGS,
		});
		expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual(ALL_CACHE_TAGS);
	});

	it("is refused to anyone signed out", async () => {
		await expect(asStaff(null, refreshAllData)).resolves.toMatchObject({ ok: false });
		expect(updateTag).not.toHaveBeenCalled();
	});
});
