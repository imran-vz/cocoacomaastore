import redis from "@/db/cache";

const DESSERT_SEQUENCE_KEY = "dessert:sequence";

export async function getSequence(id: number): Promise<number> {
	const score = await redis.zscore(DESSERT_SEQUENCE_KEY, id.toString());
	return score ?? 0;
}

function chunkArray<T>(array: T[], size: number): T[][] {
	return array.reduce((acc, item, index) => {
		const chunkIndex = Math.floor(index / size);
		if (!acc[chunkIndex]) {
			acc[chunkIndex] = [];
		}
		acc[chunkIndex].push(item);
		return acc;
	}, [] as T[][]);
}

export async function getAllSequences(): Promise<Record<number, number>> {
	const items: number[] = await redis.zrange(DESSERT_SEQUENCE_KEY, 0, -1, {
		withScores: true,
	});
	const chunks = chunkArray(items, 2);
	return chunks.reduce(
		(acc, item) => {
			acc[item[0]] = item[1];
			return acc;
		},
		{} as Record<number, number>,
	);
}

export async function updateSequence(id: number, score: number): Promise<void> {
	await redis.zadd(DESSERT_SEQUENCE_KEY, { score, member: id.toString() });
}

export async function initializeSequence(id: number): Promise<void> {
	const maxScore = await redis.zrange(DESSERT_SEQUENCE_KEY, -1, -1, {
		withScores: true,
	});
	const chunks = chunkArray(maxScore, 2);
	const nextScore = chunks.length ? Number(chunks[0][1]) + 1 : 0;
	await updateSequence(id, nextScore);
}

export async function removeSequence(id: number): Promise<void> {
	await redis.zrem(DESSERT_SEQUENCE_KEY, id.toString());
}
