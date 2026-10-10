import { Context, Effect, Layer } from "effect";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";

export class NextCache extends Context.Service<
	NextCache,
	{
		readonly revalidateTags: (tags: readonly string[], profile?: "max") => Effect.Effect<void>;
		readonly updateTags: (tags: readonly string[]) => Effect.Effect<void>;
		readonly revalidatePaths: (paths: readonly string[]) => Effect.Effect<void>;
	}
>()("NextCache") {
	static readonly Live = Layer.succeed(this, {
		revalidateTags: (tags, profile = "max") =>
			Effect.sync(() => {
				for (const tag of tags) {
					revalidateTag(tag, profile);
				}
			}),
		updateTags: (tags) =>
			Effect.sync(() => {
				for (const tag of tags) {
					updateTag(tag);
				}
			}),
		revalidatePaths: (paths) =>
			Effect.sync(() => {
				for (const path of paths) {
					revalidatePath(path, "page");
				}
			}),
	});
}
