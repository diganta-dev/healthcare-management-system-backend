import crypto from "crypto";

export default function generateRandomPassword(length = 10) {
	if (length < 8) {
		throw new Error("Length must be at least 8");
	}

	const lower = "abcdefghijklmnopqrstuvwxyz";
	const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const digits = "0123456789";
	const specials = "!@#$%^&*-_=+?";

	const all = lower + upper + digits + specials;

	const pick = (chars: string): string => chars[crypto.randomInt(chars.length)];

	// Ensure at least one of each type
	const chars = [pick(lower), pick(upper), pick(digits), pick(specials)];

	// Fill remaining characters
	for (let i = chars.length; i < length; i++) {
		chars.push(pick(all));
	}

	// Shuffle
	for (let i = chars.length - 1; i > 0; i--) {
		const j = crypto.randomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}

	return chars.join("");
}
