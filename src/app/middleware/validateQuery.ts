import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../utils/AppError";

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
			// ✅ Use AppError so the global handler treats this as an operational error (no stack trace log)
			throw new AppError(httpStatus.BAD_REQUEST, errorMessages);
		}
		// Normalise: write sanitised values back so controllers get clean data
		Object.defineProperty(req, "query", {
			value: result.data,
			writable: true,
			enumerable: true,
			configurable: true,
		});
		next();
	});
};
