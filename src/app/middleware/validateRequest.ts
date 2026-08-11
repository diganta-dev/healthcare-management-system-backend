import type z from "zod";
import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";

export const validateRequest = (zodSchema: z.ZodObject) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const payload = req.body ?? {};
		const result = zodSchema.safeParse(payload);
		if (!result.success) {
			const errorMessages = result.error.issues
				.map((issue) => issue.message)
				.join(", ");
			throw new Error(errorMessages);
		}
		req.body = result.data; // Update req.body with the validated data
		next();
	});
};
