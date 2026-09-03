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
const updateAppointmentStatus = catchAsync(async (req, res) => {
	const payload = req.body;
	const appointmentId = req.params.appointmentId as string;
	const appointmentData = await AppointmentService.updateAppointmentStatus(
		
		req.user as RequestUser,
		payload,
		appointmentId

	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment Status Updated Successfully",
		data: appointmentData,
	});
});
const getMyAppointments = catchAsync(async (req, res) => {
	const query = req.query;
	const appointments = await AppointmentService.getMyAppointments(
		req.user as RequestUser,
		query,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointments fetched successfully",
		data: appointments,
	});
});
const getDoctorAppointments = catchAsync(async (req, res) => {
	const query = req.query;
	const appointments = await AppointmentService.getDoctorAppointments(
		req.user as RequestUser,
		query,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointments fetched successfully",
		data: appointments,
	});
});
const getAllAppointments = catchAsync(async (req, res) => {
	const query = req.query;
	const appointments = await AppointmentService.getAllAppointments(
		query,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointments fetched successfully",
		data: appointments,
	});
});
const getAppointmentById = catchAsync(async (req, res) => {
	const appointmentId = req.params.appointmentId as string;
	const appointment = await AppointmentService.getSingleAppointment(
		req.user as RequestUser,
		appointmentId,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment fetched successfully",
		data: appointment,
	});
});

export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentPaymentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getDoctorAppointments,
	getAllAppointments,
	getAppointmentById
};
