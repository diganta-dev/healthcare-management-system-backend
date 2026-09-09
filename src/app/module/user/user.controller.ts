import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { UserService } from "./user.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
	}
	const userId = req.user?.userId as string;
	const user = await UserService.uploadProfileImage(req.file?.buffer, userId);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Profile image uploaded successfully",
		data: user,
	});
});

export const UserController = {
	uploadProfileImage,
};
