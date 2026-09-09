import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";

/**
 * Validates req.query against the provided Zod schema.
 * Use this middleware for GET endpoints that accept query parameters.
 */
export const validateQuery = (zodSchema: ZodTypeAny) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const result = await zodSchema.safeParseAsync(req.query);
		if (!result.success) {
			const errorMessages = result.error.issues
				.map((issue) => issue.message)
				.join(", ");
			throw new Error(errorMessages);
		}
		// Normalise: write sanitised values back so controllers get clean data
		req.query = result.data as typeof req.query;
		next();
	});
};
