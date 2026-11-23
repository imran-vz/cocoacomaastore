import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { seedFromServer } from "@/lib/use-seeded-query";

const KEY = ["things"];

describe("seedFromServer", () => {
	it("replaces a cached copy the server read before the page's copy", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(KEY, { data: "old", readAt: 100 });
		seedFromServer(queryClient, KEY, { data: "rendered", readAt: 200 });
		expect(queryClient.getQueryData(KEY)).toEqual({ data: "rendered", readAt: 200 });
	});

	it("keeps a cached copy the server read after the page's copy", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(KEY, { data: "refetched", readAt: 300 });
		seedFromServer(queryClient, KEY, { data: "rendered", readAt: 200 });
		expect(queryClient.getQueryData(KEY)).toEqual({ data: "refetched", readAt: 300 });
	});

	it("leaves an uncached query to start from the page's copy itself", () => {
		const queryClient = new QueryClient();
		seedFromServer(queryClient, KEY, { data: "rendered", readAt: 200 });
		expect(queryClient.getQueryData(KEY)).toBeUndefined();
	});
});
