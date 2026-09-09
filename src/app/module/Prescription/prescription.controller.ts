import { Request, Response } from "express";
import httpStatus from "http-status";
import { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IPrescriptionPayload } from "./prescription.interface";
import { PrescriptionService } from "./prescription.service";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
    const payload: IPrescriptionPayload = req.body;
    const user = req.user as RequestUser;
    const prescription = await PrescriptionService.createPrescription(payload, user);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Prescription Created Successfully",
        data: prescription,
    });
});

const getSinglePrescription = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as RequestUser;
    const appointmentId = req.params.appointmentId as string;
    const prescription = await PrescriptionService.getSinglePrescription(appointmentId, user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Prescription Fetched Successfully",
        data: prescription,
    });
});

export const PrescriptionController = {
    createPrescription,
    getSinglePrescription,
};