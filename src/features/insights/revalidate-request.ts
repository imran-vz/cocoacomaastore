import { z } from "zod";

/**
 * How the analytics job, which runs outside Next.js, asks the running app to refresh its
 * compiled-analytics reads: a POST of a `RevalidateRequest` as JSON to this path, answered by
 * `revalidate-endpoint.ts`. The secret is the shared `REVALIDATE_SECRET`.
 */
export const REVALIDATE_ENDPOINT = "/api/revalidate";

export const revalidateRequestSchema = z.object({ secret: z.string() });

export type RevalidateRequest = z.infer<typeof revalidateRequestSchema>;
