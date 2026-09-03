import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { BookAppointmentValidationZodSchema, UpdateAppointmentStatusValidationZodSchema } from "./appointment.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();
router.post(
	"/book-appointment",
	auth(Role.PATIENT),
	validateRequest(BookAppointmentValidationZodSchema),
	AppointmentController.bookAppointment,
);
router.post(
	"/pay-appointment",
	auth(Role.PATIENT),
	AppointmentController.payAppointment,
);
router.post(
	"/cancel-appointment",
	auth(Role.PATIENT),
	AppointmentController.cancelAppointment,
);
router.get(
	"/book-appointment/payment/callback",
	AppointmentController.bookAppointmentPaymentCallback,
);
router.patch(
	"/update-appointment-status/:appointmentId",
	auth(Role.DOCTOR),
	validateRequest(UpdateAppointmentStatusValidationZodSchema),
	AppointmentController.updateAppointmentStatus,
);
router.get(
	"/my-appointments",
	auth(Role.PATIENT),
	AppointmentController.getMyAppointments,
);
router.get(
	"/doctor-appointments",
	auth(Role.DOCTOR),
	AppointmentController.getDoctorAppointments,
);
router.get(
	"/all-appointments",
	auth(Role.ADMIN),
	AppointmentController.getAllAppointments,
);
router.get(
	"/:appointmentId",
	auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
	AppointmentController.getAppointmentById,
);	

export const AppointMentRoute = router;
