import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { AnalyticsServices } from "./analytics.service";
import { sendResponse } from "../../utils/sendResponse";


const getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getPatientAnalytics(user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Patient Analytics Retrieved Successfully",
        data: result,
    });
});

const getDoctorAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getDoctorAnalytics(user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor Analytics Retrieved Successfully",
        data: result,
    });
});

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await AnalyticsServices.getAdminAnalytics();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin Analytics Retrieved Successfully",
        data: result,
    });
});

export const AnalyticsController = {
    getPatientAnalytics,
    getDoctorAnalytics,
    getAdminAnalytics,
};