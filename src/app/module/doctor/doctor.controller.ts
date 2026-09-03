import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorService } from "./doctor.service";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const applyDoctor = catchAsync(async (req, res) => {
	const files = req.files as
		| { [fieldname: string]: Express.Multer.File[] }
		| undefined;

	const resumeFile = files?.["resume"]?.[0];
	const additionalFiles = files?.["additionalFiles"] || [];

	if (!resumeFile) {
		throw new AppError(httpStatus.BAD_REQUEST, "Resume file is required");
	}
	if (!additionalFiles) {
		throw new AppError(httpStatus.BAD_REQUEST, "Additional files are required");
	}

	const applyDoctorResult = await DoctorService.applyDoctor(
		req.body,
		resumeFile,
		additionalFiles,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Application Submitted Successfully",
		data: applyDoctorResult,
	});
});

const verifyDoctorEmail = catchAsync(async (req, res) => {
	const payload = req.body;
	const verifyDoctorResult = await DoctorService.verifyDoctorEmail(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Verification Successful",
		data: verifyDoctorResult,
	});
});

const aproveDoctorApplication = catchAsync(async (req, res) => {
	const payload = req.body;
	const reviewer = req.user!;
	const aproveDoctorResult = await DoctorService.aproveDoctorApplication(
		payload,
		reviewer,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Application Updated Successfully",
		data: aproveDoctorResult,
	});
});
const getAllDoctors = catchAsync(async (req, res) => {
	const result = await DoctorService.getAllDoctors(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All Doctors retrieved successfully",
		meta: result.meta,
		data: result.data,
	});
});

export const DoctorController = {
	applyDoctor,
	verifyDoctorEmail,
	aproveDoctorApplication,
	getAllDoctors,
};
