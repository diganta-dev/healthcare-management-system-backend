import { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req, res) => {
	const data = req.body;
	const appointmentData = await AppointmentService.bookAppointment(data, req.user as RequestUser);
	sendResponse(res, {
		success: true,
		statusCode: 200,
		message: "Appointment Booked Successfully",
		data: appointmentData,
	});
});

const bookAppointmentPaymentCallback = catchAsync(async (req, res) => {
	const appointmentData =
		await AppointmentService.bookAppointmentPaymentCallback(req.query);
	const {  redirectUrl } = appointmentData;
	res.redirect(redirectUrl);
});

export const AppointmentController = {
	bookAppointment,

	bookAppointmentPaymentCallback,
};
