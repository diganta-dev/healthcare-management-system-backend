import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req, res) => {
	const data = req.body;
	const appointmentData = await AppointmentService.bookAppointment(
		data,
		req.user as RequestUser,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment Payment Initiated Successfully",
		data: appointmentData,
	});
});
const payAppointment = catchAsync(async (req, res) => {
	const data = req.body;
	const appointmentData = await AppointmentService.payAppointment(
		data,
		req.user as RequestUser,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment Payment Initiated Successfully",
		data: appointmentData,
	});
});
const cancelAppointment = catchAsync(async (req, res) => {
	const data = req.body;
	const refundData = await AppointmentService.cancelAppointment(
		data,
		req.user as RequestUser,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment Cancelled Successfully and Refund ",
		data: refundData,
	});
});

const bookAppointmentPaymentCallback = catchAsync(async (req, res) => {
	const appointmentData =
		await AppointmentService.bookAppointmentPaymentCallback(req.query);
	const { redirectUrl } = appointmentData;
	res.redirect(redirectUrl);
});

export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
};
