import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorService } from "./doctor.service";

const applyDoctor = catchAsync(async (req, res) => {
	const files = req.files as
		| { [fieldname: string]: Express.Multer.File[] }
		| undefined;

	const resumeFile = files?.["resume"]?.[0];
	const additionalFiles = files?.["additionalFiles"] || [];

	if (!resumeFile) {
		throw new Error("Resume file is required");
	}
  if(!additionalFiles){
    throw new Error("Additional files are required");
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





export const DoctorController = {
    applyDoctor
}