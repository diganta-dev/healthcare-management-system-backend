import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";
import type { NextFunction, Request, Response } from "express";

export const validateRequest = (zodSchema: ZodTypeAny) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		let payload = req.body ?? {};

		if (typeof req.body?.data === "string") {
			try {
				payload = JSON.parse(req.body.data);
			} catch (err) {
				throw new Error("Invalid JSON format in data field");
			}
		}

		const result = await zodSchema.safeParseAsync(payload);
		if (!result.success) {
			const errorMessages = result.error.issues
				.map((issue) => issue.message)
				.join(", ");
			throw new Error(errorMessages);
		}
		req.body = result.data; 
		next();
	});
};
