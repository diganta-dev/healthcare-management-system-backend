import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();
router.post("/book-appointment",auth(Role.PATIENT), AppointmentController.bookAppointment);
router.get(
	"/book-appointment/payment/callback",
	AppointmentController.bookAppointmentPaymentCallback,
);

export const AppointMentRoute = router;
