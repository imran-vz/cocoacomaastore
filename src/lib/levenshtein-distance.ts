// Vendored Myers bit-parallel Levenshtein; the near-identical main-block and
// final-block passes are inherent to the algorithm.
// fallow-ignore-file code-duplication
const patternMatchVectors = new Uint32Array(0x10000);

const calculateDistanceShortStrings = (longerString: string, shorterString: string): number => {
	const longerLength = longerString.length;
	const shorterLength = shorterString.length;
	const finalBitMask = 1 << (longerLength - 1);

	let plusVerticalVector = -1;
	let minusVerticalVector = 0;
	let distanceScore = longerLength;
	let index = longerLength;

	while (index--) {
		patternMatchVectors[longerString.charCodeAt(index)] |= 1 << index;
	}

	for (index = 0; index < shorterLength; index++) {
		let matchMask = patternMatchVectors[shorterString.charCodeAt(index)];
		const combinedMatchMask = matchMask | minusVerticalVector;

		matchMask |= ((matchMask & plusVerticalVector) + plusVerticalVector) ^ plusVerticalVector;
		minusVerticalVector |= ~(matchMask | plusVerticalVector);
		plusVerticalVector &= matchMask;

		if (minusVerticalVector & finalBitMask) {
			distanceScore++;
		}
		if (plusVerticalVector & finalBitMask) {
			distanceScore--;
		}

		minusVerticalVector = (minusVerticalVector << 1) | 1;
		plusVerticalVector = (plusVerticalVector << 1) | ~(combinedMatchMask | minusVerticalVector);
		minusVerticalVector &= combinedMatchMask;
	}

	index = longerLength;
	while (index--) {
		patternMatchVectors[longerString.charCodeAt(index)] = 0;
	}

	return distanceScore;
};

const calculateDistanceLongStrings = (longerString: string, shorterString: string): number => {
	const shorterLength = shorterString.length;
	const longerLength = longerString.length;
	const minusHorizontalCols: number[] = [];
	const plusHorizontalCols: number[] = [];
	const numShorterBlocks = Math.ceil(shorterLength / 32);
	const numLongerBlocks = Math.ceil(longerLength / 32);

	for (let blockIndex = 0; blockIndex < numShorterBlocks; blockIndex++) {
		plusHorizontalCols[blockIndex] = -1;
		minusHorizontalCols[blockIndex] = 0;
	}

	let currentLongerBlock = 0;
	for (; currentLongerBlock < numLongerBlocks - 1; currentLongerBlock++) {
		let minusVerticalVector = 0;
		let plusVerticalVector = -1;
		const startBlockIndex = currentLongerBlock * 32;
		const blockEndIndex = Math.min(32, longerLength) + startBlockIndex;

		for (let k = startBlockIndex; k < blockEndIndex; k++) {
			patternMatchVectors[longerString.charCodeAt(k)] |= 1 << k;
		}

		for (let i = 0; i < shorterLength; i++) {
			const matchMask = patternMatchVectors[shorterString.charCodeAt(i)];
			const plusHorizontalBit = (plusHorizontalCols[(i / 32) | 0] >>> i) & 1;
			const minusHorizontalBit = (minusHorizontalCols[(i / 32) | 0] >>> i) & 1;
			const combinedMatchMask = matchMask | minusVerticalVector;
			const tempMatchMask =
				((((matchMask | minusHorizontalBit) & plusVerticalVector) + plusVerticalVector) ^ plusVerticalVector) |
				matchMask |
				minusHorizontalBit;

			let plusHorizontalVector = minusVerticalVector | ~(tempMatchMask | plusVerticalVector);
			let minusHorizontalVector = plusVerticalVector & tempMatchMask;

			if ((plusHorizontalVector >>> 31) ^ plusHorizontalBit) {
				plusHorizontalCols[(i / 32) | 0] ^= 1 << i;
			}
			if ((minusHorizontalVector >>> 31) ^ minusHorizontalBit) {
				minusHorizontalCols[(i / 32) | 0] ^= 1 << i;
			}

			plusHorizontalVector = (plusHorizontalVector << 1) | plusHorizontalBit;
			minusHorizontalVector = (minusHorizontalVector << 1) | minusHorizontalBit;
			plusVerticalVector = minusHorizontalVector | ~(combinedMatchMask | plusHorizontalVector);
			minusVerticalVector = plusHorizontalVector & combinedMatchMask;
		}

		for (let k = startBlockIndex; k < blockEndIndex; k++) {
			patternMatchVectors[longerString.charCodeAt(k)] = 0;
		}
	}

	let minusVerticalVector = 0;
	let plusVerticalVector = -1;
	const startBlockIndex = currentLongerBlock * 32;
	const blockEndIndex = Math.min(32, longerLength - startBlockIndex) + startBlockIndex;

	for (let k = startBlockIndex; k < blockEndIndex; k++) {
		patternMatchVectors[longerString.charCodeAt(k)] |= 1 << k;
	}

	let distanceScore = longerLength;
	for (let i = 0; i < shorterLength; i++) {
		const matchMask = patternMatchVectors[shorterString.charCodeAt(i)];
		const plusHorizontalBit = (plusHorizontalCols[(i / 32) | 0] >>> i) & 1;
		const minusHorizontalBit = (minusHorizontalCols[(i / 32) | 0] >>> i) & 1;
		const combinedMatchMask = matchMask | minusVerticalVector;
		const tempMatchMask =
			((((matchMask | minusHorizontalBit) & plusVerticalVector) + plusVerticalVector) ^ plusVerticalVector) |
			matchMask |
			minusHorizontalBit;

		let plusHorizontalVector = minusVerticalVector | ~(tempMatchMask | plusVerticalVector);
		let minusHorizontalVector = plusVerticalVector & tempMatchMask;

		distanceScore += (plusHorizontalVector >>> (longerLength - 1)) & 1;
		distanceScore -= (minusHorizontalVector >>> (longerLength - 1)) & 1;

		if ((plusHorizontalVector >>> 31) ^ plusHorizontalBit) {
			plusHorizontalCols[(i / 32) | 0] ^= 1 << i;
		}
		if ((minusHorizontalVector >>> 31) ^ minusHorizontalBit) {
			minusHorizontalCols[(i / 32) | 0] ^= 1 << i;
		}

		plusHorizontalVector = (plusHorizontalVector << 1) | plusHorizontalBit;
		minusHorizontalVector = (minusHorizontalVector << 1) | minusHorizontalBit;
		plusVerticalVector = minusHorizontalVector | ~(combinedMatchMask | plusHorizontalVector);
		minusVerticalVector = plusHorizontalVector & combinedMatchMask;
	}

	for (let k = startBlockIndex; k < blockEndIndex; k++) {
		patternMatchVectors[longerString.charCodeAt(k)] = 0;
	}

	return distanceScore;
};

const distance = (source: string, target: string): number => {
	let longerString = source;
	let shorterString = target;

	if (longerString.length < shorterString.length) {
		longerString = target;
		shorterString = source;
	}

	if (shorterString.length === 0) {
		return longerString.length;
	}

	if (longerString.length <= 32) {
		return calculateDistanceShortStrings(longerString, shorterString);
	}

	return calculateDistanceLongStrings(longerString, shorterString);
};

const closest = (target: string, choices: readonly string[]): string => {
	let minDistance = Infinity;
	let closestChoiceIndex = 0;

	for (let i = 0; i < choices.length; i++) {
		const currentDistance = distance(target, choices[i]);
		if (currentDistance < minDistance) {
			minDistance = currentDistance;
			closestChoiceIndex = i;
		}
	}

	return choices[closestChoiceIndex];
};

export { closest, distance };
