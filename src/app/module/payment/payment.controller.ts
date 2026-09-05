import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { RequestUser } from "../../middleware/checkAuth";
import { PaymentService } from "./payment.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const getMypayment =catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as RequestUser;
    const paymentId = req.params.paymentId as string; 
    const payment = await PaymentService.getSinglePayment(paymentId, user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment fetched successfully",
        data: payment
    });
}); 

const getAllPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as RequestUser;
    const { page, limit, payments, totalPayments, totalPages } = await PaymentService.getAllPayments(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payments fetched successfully",
        data: {
            page,
            limit,
            payments,
            totalPayments,
            totalPages
        }
    });
});
const getSinglePayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as RequestUser;
    const paymentId = req.params.paymentId as string;
    const payment = await PaymentService.getSinglePayment(paymentId, user);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment fetched successfully",
        data: payment
    });
});

export const PaymentController = {
    getMypayment,
    getAllPayments,
    getSinglePayment
}